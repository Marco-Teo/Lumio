import { z } from 'zod';
export const imageRulesSchema = z
  .object({
    formats: z.array(z.enum(['jpeg', 'png', 'tiff'])),
    maxBytes: z.number().positive(),
    minWidth: z.number().nullable(),
    minHeight: z.number().nullable(),
    maxLongEdge: z.number().nullable(),
    maxShortEdge: z.number().nullable(),
    colorProfile: z.enum(['any', 'srgb']),
    // Optional for backward compatibility with immutable pre-policy revisions.
    exactLongEdge: z.number().int().positive().optional(),
    validationVersion: z.literal(1).optional(),
  })
  .strict();
export type ImageRules = z.infer<typeof imageRulesSchema>;

// Independent version: never change the semantics of this ID for future profiles.
export const fiafPhotoPolicyId = 'fiaf-2027-ordinary-photo-v1' as const;
const supportedProfiles = [
  'fiaf-2027-patrocinio-v1',
  'fiaf-2027-raccomandazione-v1',
] as const;
export const regulatoryPhotoPolicySchema = z
  .object({
    id: z.string().min(1).max(200),
    profileId: z.string().min(1).max(200),
  })
  .strict();

export function supportedPhotoPolicy(config: PhotoPolicyContext) {
  return (
    config.regulatoryPhotoPolicy?.id === fiafPhotoPolicyId &&
    config.regulatoryPhotoPolicy.profileId === config.regulatoryProfile?.id &&
    supportedProfiles.some((id) => id === config.regulatoryProfile?.id)
  );
}

/** Only the frozen registration configuration may resolve upload rules.
 * Missing policy means legacy semantics, including pending photo revisions.
 */
export function sectionPhotoRules(
  config: PhotoPolicyContext,
  sectionCode: string,
) {
  const base = config.imageRules;
  if (!config.regulatoryPhotoPolicy) return base;
  if (!supportedPhotoPolicy(config))
    throw new Error('UNSUPPORTED_PHOTO_POLICY');
  const classifications =
    config.regulatorySections &&
    config.regulatorySections.profileId === config.regulatoryProfile?.id
      ? config.regulatorySections.sections.filter(
          (row) => row.sectionCode === sectionCode,
        )
      : [];
  const classification = classifications[0];
  if (
    classifications.length !== 1 ||
    !classification ||
    !['BN', 'CLP', 'DIG', 'PORTFOLIO', 'IS'].includes(
      classification.sectionType,
    )
  )
    throw new Error('INVALID_PHOTO_POLICY_SECTION');
  const patro = config.regulatoryProfile?.id === supportedProfiles[0];
  const digital = patro && classification?.sectionType === 'DIG';
  const exact = patro && (digital || classification?.sectionType === 'IS');
  return {
    ...base,
    validationVersion: 1 as const,
    ...(digital
      ? {
          formats: base.formats.filter((format) => format === 'jpeg'),
          colorProfile: 'srgb' as const,
        }
      : {}),
    ...(exact ? { exactLongEdge: 2500 } : {}),
  };
}

export const photoPolicyContextSchema = z.object({
  sectionCode: z.string().min(1),
  regulatoryProfile: z.object({ id: z.string() }).strict().optional(),
  regulatoryPhotoPolicy: regulatoryPhotoPolicySchema.optional(),
  regulatorySections: z
    .object({
      profileId: z.string(),
      sections: z.array(
        z.object({ sectionCode: z.string(), sectionType: z.string() }),
      ),
    })
    .optional(),
});
export type PhotoPolicyContext = Omit<
  z.infer<typeof photoPolicyContextSchema>,
  'sectionCode'
> & { imageRules: ImageRules };
