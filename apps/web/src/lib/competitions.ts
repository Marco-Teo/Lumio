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
        path: ['maxImages'],
        message: 'Il massimo immagini deve essere almeno uguale al minimo.',
      });
    if (
      section.type === 'single' &&
      (section.minImages !== 1 || section.maxImages !== 1)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['type'],
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
    const fail = (message: string, path: Array<string | number>) =>
      ctx.addIssue({ code: 'custom', message, path });
    edition.sections.forEach((section, index) => {
      if (
        edition.sections.some(
          (other, otherIndex) =>
            otherIndex < index && other.code === section.code,
        )
      )
        fail(
          'Questo codice è già usato da un’altra sezione. Scegli un codice diverso.',
          ['sections', index, 'code'],
        );
      if (edition.paymentMode === 'free' && section.feeCents > 0)
        fail(
          'Imposta la quota a 0 per un’edizione gratuita, oppure scegli il pagamento manuale.',
          ['sections', index, 'feeCents'],
        );
    });
    const dateFields = ['opensAt', 'closesAt', 'juryAt', 'awardsAt'] as const;
    const dateLabels = {
      opensAt: 'Apertura iscrizioni',
      closesAt: 'Chiusura iscrizioni',
      juryAt: 'Data giuria',
      awardsAt: 'Data premiazione',
    };
    let previous: (typeof dateFields)[number] | undefined;
    for (const key of dateFields) {
      const value = edition[key];
      if (!value) continue;
      if (previous && value <= edition[previous]!)
        fail(
          `Scegli una data e un’ora successive a «${dateLabels[previous]}».`,
          [key],
        );
      previous = key;
    }
    const rules = edition.imageRules;
    if (
      rules.maxShortEdge &&
      rules.maxLongEdge &&
      rules.maxShortEdge > rules.maxLongEdge
    )
      fail('Il lato corto massimo non può superare il lato lungo massimo.', [
        'imageRules',
        'maxShortEdge',
      ]);
    if (
      rules.maxLongEdge &&
      [rules.minWidth, rules.minHeight].some(
        (min) => min !== null && min > rules.maxLongEdge!,
      )
    )
      fail(
        'Il lato lungo massimo deve essere almeno uguale alle dimensioni minime impostate.',
        ['imageRules', 'maxLongEdge'],
      );
    if (
      rules.maxShortEdge &&
      rules.minWidth &&
      rules.minHeight &&
      Math.min(rules.minWidth, rules.minHeight) > rules.maxShortEdge
    )
      fail(
        'Il lato corto massimo è inferiore alle dimensioni minime impostate.',
        ['imageRules', 'maxShortEdge'],
      );
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
