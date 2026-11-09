import { describe, expect, it } from 'vitest';
import { maxPhotoBytes } from '@lumio/media/limits';
import {
  editionWriteSchema,
  editionSchema,
  emptyEdition,
  publicationIssues,
} from './competitions';

const section = {
  name: 'Libero',
  code: 'A',
  description: '',
  theme: '',
  type: 'single' as const,
  minImages: 1,
  maxImages: 1,
  feeCents: 0,
  specificRules: '',
};
describe('edition configuration', () => {
  it('allows an incomplete draft but lists publication requirements', () => {
    const draft = editionSchema.parse(
      emptyEdition('Edizione 2027', 'edizione-2027', '2027'),
    );
    expect(publicationIssues(draft)).toHaveLength(8);
  });
  it('rejects invalid dates, duplicate sections and incompatible image dimensions', () => {
    const draft = emptyEdition('Edizione 2027', 'edizione-2027', '2027');
    expect(
      editionSchema.safeParse({
        ...draft,
        opensAt: '2027-05-01T10:00:00.000Z',
        closesAt: '2027-04-01T10:00:00.000Z',
      }).success,
    ).toBe(false);
    expect(
      editionSchema.safeParse({ ...draft, sections: [section, section] })
        .success,
    ).toBe(false);
    expect(
      editionSchema.safeParse({
        ...draft,
        imageRules: { ...draft.imageRules, minWidth: 3000, maxLongEdge: 2000 },
      }).success,
    ).toBe(false);
  });
  it('validates portfolio bounds, integer fees and free editions', () => {
    const draft = emptyEdition('Edizione 2027', 'edizione-2027', '2027');
    expect(
      editionSchema.safeParse({
        ...draft,
        sections: [
          { ...section, type: 'portfolio', minImages: 5, maxImages: 2 },
        ],
      }).success,
    ).toBe(false);
    expect(
      editionSchema.safeParse({
        ...draft,
        sections: [{ ...section, feeCents: 1.5 }],
      }).success,
    ).toBe(false);
    expect(
      editionSchema.safeParse({
        ...draft,
        sections: [{ ...section, feeCents: 500 }],
      }).success,
    ).toBe(false);
    expect(
      editionSchema.safeParse({
        ...draft,
        paymentMode: 'manual',
        sections: [
          {
            ...section,
            type: 'portfolio',
            minImages: 3,
            maxImages: 8,
            feeCents: 500,
          },
        ],
      }).success,
    ).toBe(true);
  });
  it('rejects fields that could bypass state or tenant validation', () => {
    expect(
      editionSchema.safeParse({
        ...emptyEdition('Edizione', 'edizione', '2027'),
        organizationId: 'other',
        status: 'published',
      }).success,
    ).toBe(false);
  });
});

describe('current photo configuration writes versus historical reads', () => {
  const draft = emptyEdition('Edizione', 'edizione', '2027');
  const config = (rules: Partial<typeof draft.imageRules>) => ({
    ...draft,
    imageRules: { ...draft.imageRules, ...rules },
  });
  it.each([1, 5_000_000, maxPhotoBytes])('accepts %i bytes', (maxBytes) => {
    expect(editionWriteSchema.safeParse(config({ maxBytes })).success).toBe(
      true,
    );
  });
  it.each([maxPhotoBytes + 1, 1_000_000_000])(
    'reads legacy %i bytes but blocks new writes',
    (maxBytes) => {
      expect(editionSchema.safeParse(config({ maxBytes })).success).toBe(true);
      expect(editionWriteSchema.safeParse(config({ maxBytes })).success).toBe(
        false,
      );
    },
  );
  it('accepts exactly 40 megapixels including compatible edge limits', () => {
    expect(
      editionWriteSchema.safeParse(
        config({
          minWidth: 8000,
          minHeight: 5000,
          maxLongEdge: 8000,
          maxShortEdge: 5000,
        }),
      ).success,
    ).toBe(true);
  });
  it('reads legacy dimensions above 40 megapixels but rejects writing them', () => {
    const legacy = config({ minWidth: 8000, minHeight: 5001 });
    expect(editionSchema.safeParse(legacy).success).toBe(true);
    expect(editionWriteSchema.safeParse(legacy).success).toBe(false);
  });
  it.each([
    { minWidth: 8000, minHeight: 5000, maxLongEdge: 7999 },
    { minWidth: 8000, minHeight: 5000, maxShortEdge: 4999 },
    { maxShortEdge: 6000, maxLongEdge: 5000 },
  ])('rejects incompatible configured edges: %j', (rules) => {
    expect(editionWriteSchema.safeParse(config(rules)).success).toBe(false);
  });
});
