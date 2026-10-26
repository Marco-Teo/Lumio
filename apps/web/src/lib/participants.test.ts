import { expect, it } from 'vitest';
import {
  emptyProfile,
  profileSchema,
  profileStatus,
  registrationOpen,
} from './participants';
import { safeReturnTo } from './return-to';
it('allows a partial profile and derives status without confirming an entry', () => {
  expect(profileStatus(profileSchema.parse(emptyProfile))).toBe(
    'profile_incomplete',
  );
  expect(
    profileStatus({
      ...emptyProfile,
      firstName: 'Marco',
      lastName: 'Rossi',
      country: 'IT',
    }),
  ).toBe('entries_incomplete');
});
it('rejects invalid birth dates and injected account or tenant fields', () => {
  expect(
    profileSchema.safeParse({ ...emptyProfile, birthDate: '2025-02-30' })
      .success,
  ).toBe(false);
  expect(
    profileSchema.safeParse({ ...emptyProfile, birthDate: '2999-01-01' })
      .success,
  ).toBe(false);
  expect(
    profileSchema.safeParse({
      ...emptyProfile,
      userId: 'other',
      organizationId: 'other',
    }).success,
  ).toBe(false);
});
it('opens at the opening instant and closes at the closing instant', () => {
  const config = {
    opensAt: '2026-01-01T00:00:00.000Z',
    closesAt: '2026-02-01T00:00:00.000Z',
  };
  expect(registrationOpen(config, Date.parse(config.opensAt) - 1)).toBe(false);
  expect(registrationOpen(config, Date.parse(config.opensAt))).toBe(true);
  expect(registrationOpen(config, Date.parse(config.closesAt))).toBe(false);
});
it('preserves only allowlisted internal login destinations', () => {
  expect(
    safeReturnTo('/editions/11111111-1111-4111-8111-111111111111'),
  ).toContain('/editions/');
  for (const path of [
    'https://other.invalid',
    '//other.invalid',
    '/editions/../platform',
    '/api/profile',
  ])
    expect(safeReturnTo(path)).toBe('/account');
});
