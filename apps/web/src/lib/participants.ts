import { z } from 'zod';
const text = (max: number) => z.string().trim().max(max);
export const profileSchema = z
  .object({
    firstName: text(100),
    lastName: text(100),
    phone: text(40),
    birthDate: z
      .union([z.iso.date(), z.literal('')])
      .refine(
        (value) => !value || value <= new Date().toISOString().slice(0, 10),
        'La data di nascita non può essere futura.',
      ),
    address: text(200),
    city: text(120),
    province: text(80),
    postalCode: text(20),
    country: z.union([
      z
        .string()
        .regex(
          /^[A-Z]{2}$/,
          'Usa il codice paese di due lettere, ad esempio IT.',
        ),
      z.literal(''),
    ]),
  })
  .strict();
export type ParticipantProfile = z.infer<typeof profileSchema>;
export const registrationSnapshotSchema = profileSchema.extend({
  email: z.email(),
});
export function snapshotProfile(value: unknown) {
  const { email, ...profile } = registrationSnapshotSchema.parse(value);
  return { email, profile };
}
export const emptyProfile: ParticipantProfile = {
  firstName: '',
  lastName: '',
  phone: '',
  birthDate: '',
  address: '',
  city: '',
  province: '',
  postalCode: '',
  country: '',
};
export function profileStatus(profile: ParticipantProfile) {
  return profile.firstName && profile.lastName && profile.country
    ? 'entries_incomplete'
    : 'profile_incomplete';
}
export function registrationOpen(
  config: { opensAt: string | null; closesAt: string | null },
  now = Date.now(),
) {
  return Boolean(
    config.opensAt &&
    config.closesAt &&
    new Date(config.opensAt).getTime() <= now &&
    now < new Date(config.closesAt).getTime(),
  );
}
export const registrationStatusLabels: Record<string, string> = {
  profile_incomplete: 'Dati personali da completare',
  entries_incomplete: 'Opere da aggiungere',
};
