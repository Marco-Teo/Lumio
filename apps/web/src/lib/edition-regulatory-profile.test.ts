import { describe, expect, it } from 'vitest';
import {
  editionSchema,
  editionWriteSchema,
  emptyEdition,
} from './competitions';
import { regulatoryCatalog } from './regulatory-profiles';

describe('edition regulatory association', () => {
  const independent = emptyEdition('Indipendente', 'indipendente', '2027');
  it('reads historical independent configurations without adding properties', () => {
    expect(editionSchema.parse(independent)).toEqual(independent);
    expect(editionWriteSchema.parse(independent)).not.toHaveProperty(
      'regulatoryProfile',
    );
  });
  for (const profile of regulatoryCatalog.profiles) {
    it(`round trips ${profile.id} without applying rules or changing other fields`, () => {
      const configuration = {
        ...independent,
        regulatoryProfile: { id: profile.id },
      };
      const saved = editionWriteSchema.parse(configuration);
      expect(editionSchema.parse(JSON.parse(JSON.stringify(saved)))).toEqual(
        configuration,
      );
      const { regulatoryProfile, ...rest } = saved;
      expect(regulatoryProfile?.id).toBe(profile.id);
      expect(rest).toEqual(independent);
    });
  }
  it('preserves unavailable historical IDs but rejects them on writes', () => {
    const configuration = {
      ...independent,
      regulatoryProfile: { id: 'unavailable-profile' },
    };
    expect(editionSchema.parse(configuration)).toEqual(configuration);
    expect(editionWriteSchema.safeParse(configuration).success).toBe(false);
  });
  it('rejects altered definitions, inexact IDs and invalid photo limits', () => {
    const id = regulatoryCatalog.profiles[0].id;
    for (const regulatoryProfile of [
      { id: `${id} ` },
      { id, normativeVersion: 'invented' },
    ])
      expect(
        editionWriteSchema.safeParse({ ...independent, regulatoryProfile })
          .success,
      ).toBe(false);
    for (const imageRules of [
      { ...independent.imageRules, maxBytes: 26_214_401 },
      { ...independent.imageRules, minWidth: 10000, minHeight: 4001 },
    ])
      expect(
        editionWriteSchema.safeParse({
          ...independent,
          regulatoryProfile: { id },
          imageRules,
        }).success,
      ).toBe(false);
  });
});
