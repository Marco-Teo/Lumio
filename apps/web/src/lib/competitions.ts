import { z } from 'zod';

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const contestSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema,
    description: z.string().trim().max(5000),
  })
  .strict();

const optionalDate = z.iso.datetime().nullable();
const pixels = z.number().int().min(1).max(100000).nullable();
export const sectionSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    code: z
      .string()
      .trim()
      .min(1)
      .max(20)
      .regex(/^[A-Z0-9-]+$/),
    description: z.string().trim().max(5000),
    theme: z.string().trim().max(500),
    type: z.enum(['single', 'portfolio']),
    minImages: z.number().int().min(1).max(100),
    maxImages: z.number().int().min(1).max(100),
    feeCents: z.number().int().min(0).max(10000000),
    specificRules: z.string().trim().max(5000),
  })
  .strict()
  .superRefine((section, ctx) => {
    if (section.minImages > section.maxImages)
      ctx.addIssue({
        code: 'custom',
        message: 'Il minimo immagini supera il massimo.',
      });
    if (
      section.type === 'single' &&
      (section.minImages !== 1 || section.maxImages !== 1)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Una fotografia singola contiene una sola immagine.',
      });
  });

export const editionSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema,
    identifier: z.string().trim().min(1).max(40),
    description: z.string().trim().max(5000),
    opensAt: optionalDate,
    closesAt: optionalDate,
    juryAt: optionalDate,
    awardsAt: optionalDate,
    regulations: z.string().trim().max(30000),
    privacy: z.string().trim().max(30000),
    imageRules: z
      .object({
        formats: z
          .array(z.enum(['jpeg', 'png', 'tiff']))
          .min(1)
          .max(3),
        maxBytes: z.number().int().positive().max(1000000000),
        minWidth: pixels,
        minHeight: pixels,
        maxLongEdge: pixels,
        maxShortEdge: pixels,
        colorProfile: z.enum(['any', 'srgb']),
      })
      .strict(),
    paymentMode: z.enum(['free', 'manual']),
    currency: z.enum(['EUR', 'USD', 'GBP']),
    votingMethod: z.enum([
      '1-5',
      '1-10',
      'yes-no',
      'admission',
      'shortlist',
      'ranking',
    ]),
    sections: z.array(sectionSchema).max(100),
  })
  .strict()
  .superRefine((edition, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (
      new Set(edition.sections.map((s) => s.code)).size !==
      edition.sections.length
    )
      fail('I codici delle sezioni devono essere unici.');
    if (
      edition.paymentMode === 'free' &&
      edition.sections.some((s) => s.feeCents > 0)
    )
      fail('Una edizione gratuita non può avere quote di sezione.');
    const dates = [
      edition.opensAt,
      edition.closesAt,
      edition.juryAt,
      edition.awardsAt,
    ].filter((date): date is string => date !== null);
    if (dates.some((date, index) => index > 0 && date <= dates[index - 1]))
      fail(
        'Le date devono seguire l’ordine apertura, chiusura, giuria, premiazione.',
      );
    const rules = edition.imageRules;
    if (
      rules.maxShortEdge &&
      rules.maxLongEdge &&
      rules.maxShortEdge > rules.maxLongEdge
    )
      fail('Il lato corto massimo supera il lato lungo massimo.');
    if (
      rules.maxLongEdge &&
      [rules.minWidth, rules.minHeight].some(
        (min) => min !== null && min > rules.maxLongEdge!,
      )
    )
      fail('Le dimensioni minime superano il lato lungo massimo.');
    if (
      rules.maxShortEdge &&
      rules.minWidth &&
      rules.minHeight &&
      Math.min(rules.minWidth, rules.minHeight) > rules.maxShortEdge
    )
      fail('Le dimensioni minime superano il lato corto massimo.');
  });

export type EditionConfiguration = z.infer<typeof editionSchema>;
export type SectionConfiguration = z.infer<typeof sectionSchema>;
export function publicationIssues(config: EditionConfiguration): string[] {
  return [
    !config.description && 'Inserisci la descrizione dell’edizione.',
    !config.opensAt && 'Imposta l’apertura delle iscrizioni.',
    !config.closesAt && 'Imposta la chiusura delle iscrizioni.',
    !config.juryAt && 'Imposta la data della giuria.',
    !config.awardsAt && 'Imposta la data della premiazione.',
    !config.regulations && 'Inserisci il regolamento.',
    !config.privacy && 'Inserisci l’informativa privacy.',
    config.sections.length === 0 && 'Aggiungi almeno una sezione.',
  ].filter((issue): issue is string => typeof issue === 'string');
}
export function emptyEdition(
  name: string,
  slug: string,
  identifier: string,
): EditionConfiguration {
  return {
    name,
    slug,
    identifier,
    description: '',
    opensAt: null,
    closesAt: null,
    juryAt: null,
    awardsAt: null,
    regulations: '',
    privacy: '',
    imageRules: {
      formats: ['jpeg'],
      maxBytes: 5000000,
      minWidth: null,
      minHeight: null,
      maxLongEdge: null,
      maxShortEdge: null,
      colorProfile: 'any',
    },
    paymentMode: 'free',
    currency: 'EUR',
    votingMethod: '1-5',
    sections: [],
  };
}
