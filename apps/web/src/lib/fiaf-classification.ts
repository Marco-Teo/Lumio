import { z } from 'zod';

// FIAF 2027 definitive, 1.5.3–7 (p.8), 1.5.11 (pp.8–9), 1.5.13 (p.9).
// Classification vocabulary only: no quotas, presets or image validation.
export const fiaf2027SectionTypes = [
  'BN',
  'CLP',
  'DIG',
  'PORTFOLIO',
  'IS',
] as const;
export type Fiaf2027SectionType = (typeof fiaf2027SectionTypes)[number];
export const fiaf2027Themes = [
  ['LB', 'Libero'],
  ['VR', 'Obbligato, scelto dall’organizzatore'],
  ['CL', 'Libero colore'],
  ['BN', 'Libero bianconero'],
  ['NA', 'Natura'],
  ['NW', 'Natura Wildlife'],
  ['CR', 'Creatività'],
  ['AE', 'Fotografia aerea'],
  ['SM', 'Smartphone'],
  ['PN', 'Panoramica'],
  ['PA', 'Paesaggio'],
  ['ST', 'Street photography'],
  ['RF', 'Ritratto e figura ambientata'],
  ['AR', 'Architettura'],
  ['SL', 'Still life'],
  ['NU', 'Nudo e glamour'],
  ['SP', 'Sport'],
  ['RP', 'Reportage / Fotogiornalismo'],
  ['TR', 'Viaggio / Travel'],
] as const;
const themeCodes = fiaf2027Themes.map(([code]) => code);
export function fiaf2027TradAllowed(classification: {
  sectionType: string;
  themeCode?: string;
}) {
  return (
    fiaf2027SectionTypes.some((type) => type === classification.sectionType) &&
    (classification.themeCode === undefined ||
      themeCodes.some((code) => code === classification.themeCode) ||
      /^VR[A-Z]+$/.test(classification.themeCode)) &&
    classification.sectionType !== 'IS' &&
    !['NA', 'NW', 'RP', 'TR'].includes(classification.themeCode ?? '')
  );
}

// Reads preserve stored identifiers even if a later implementation rejects writes.
export const regulatorySectionsSchema = z
  .object({
    profileId: z.string().min(1).max(200),
    sections: z
      .array(
        z
          .object({
            sectionCode: z.string().min(1).max(20),
            sectionType: z.string().min(1).max(40),
            themeCode: z.string().min(1).max(40).optional(),
            category: z.string().min(1).max(40).optional(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();

export const fiaf2027SectionClassificationSchema = z
  .object({
    sectionCode: z.string().regex(/^[A-Z0-9-]{1,20}$/),
    sectionType: z.enum(fiaf2027SectionTypes),
    themeCode: z
      .string()
      .refine(
        (value) =>
          themeCodes.some((code) => code === value) || /^VR[A-Z]+$/.test(value),
        'Scegli un codice tema FIAF 2027; per i temi obbligati usa VR o VRA, VRB…',
      )
      .optional(),
    category: z.literal('TRAD').optional(),
  })
  .strict()
  .superRefine((classification, ctx) => {
    if (
      classification.category === 'TRAD' &&
      !fiaf2027TradAllowed(classification)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['category'],
        message:
          'La categoria TRAD non è prevista per IS, Natura, Wildlife, Reportage o Viaggio (art. 1.5.13).',
      });
  });

export type RegulatorySections = z.infer<typeof regulatorySectionsSchema>;
export type SectionClassification = RegulatorySections['sections'][number];
