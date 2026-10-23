import { describe, expect, it } from 'vitest';
import { editionSchema, emptyEdition, publicationIssues } from './competitions';

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
