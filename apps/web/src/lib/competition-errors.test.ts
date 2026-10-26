import { expect, it } from 'vitest';
import { contestSchema, editionSchema, emptyEdition } from './competitions';
import { competitionFormIssues } from './competition-errors';
it('explains the invalid contest slug once with a usable example', () => {
  const result = contestSchema.safeParse({
    name: 'Concorso',
    slug: 'A',
    description: '',
  });
  if (result.success) throw new Error('Expected invalid slug');
  const issues = competitionFormIssues(result.error, 'contest');
  expect(issues.filter((issue) => issue.path === 'slug')).toHaveLength(1);
  expect(issues[0].label).toBe('Slug concorso');
  expect(issues[0].message).toContain('concorso-2027');
});
it('points to the exact duplicate section and fee in a free edition', () => {
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
  const result = editionSchema.safeParse({
    ...emptyEdition('Edizione', 'edizione', '2027'),
    sections: [section, { ...section, feeCents: 500 }],
  });
  if (result.success) throw new Error('Expected invalid section');
  const issues = competitionFormIssues(result.error);
  expect(issues.find((issue) => issue.path === 'sections.1.code')?.label).toBe(
    'Sezione 2 · Codice sezione',
  );
  expect(
    issues.find((issue) => issue.path === 'sections.1.feeCents')?.message,
  ).toContain('quota a 0');
});
it('attaches date errors to the date that must be moved', () => {
  const result = editionSchema.safeParse({
    ...emptyEdition('Edizione', 'edizione', '2027'),
    opensAt: '2027-02-01T10:00:00.000Z',
    closesAt: '2027-01-01T10:00:00.000Z',
  });
  if (result.success) throw new Error('Expected invalid dates');
  expect(competitionFormIssues(result.error)).toContainEqual({
    path: 'closesAt',
    label: 'Chiusura iscrizioni',
    message: 'Scegli una data e un’ora successive a «Apertura iscrizioni».',
  });
});
it('explains formats and file size with display units', () => {
  const result = editionSchema.safeParse({
    ...emptyEdition('Edizione', 'edizione', '2027'),
    imageRules: {
      formats: [],
      maxBytes: 0,
      minWidth: null,
      minHeight: null,
      maxLongEdge: null,
      maxShortEdge: null,
      colorProfile: 'any',
    },
  });
  if (result.success) throw new Error('Expected image errors');
  const issues = competitionFormIssues(result.error);
  expect(
    issues.find((issue) => issue.path === 'imageRules.formats')?.message,
  ).toContain('almeno un formato');
  expect(
    issues.find((issue) => issue.path === 'imageRules.maxBytes')?.message,
  ).toContain('1000 MB');
});
