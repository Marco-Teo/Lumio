import { describe, it, expect } from 'vitest';
import {
  editionSchema,
  editionWriteSchema,
  emptyEdition,
} from './competitions';
import { regulatoryCatalog } from './regulatory-profiles';

const profile = regulatoryCatalog.profiles[0];
const section = {
  name: 'Tema libero',
  code: 'LOCAL-1',
  description: '',
  theme: 'Paesaggi italiani',
  type: 'single' as const,
  minImages: 1,
  maxImages: 1,
  feeCents: 0,
  specificRules: '',
};
const independent = {
  ...emptyEdition('Edizione', 'edizione', '2027'),
  sections: [section],
};
const mapped = {
  ...independent,
  regulatoryProfile: { id: profile.id },
  regulatorySections: {
    profileId: profile.id,
    sections: [
      {
        sectionCode: section.code,
        sectionType: 'DIG',
        themeCode: 'PA',
        category: 'TRAD',
      },
    ],
  },
};
describe('versioned FIAF section classifications', () => {
  it('preserves independent and historical configurations without adding defaults', () => {
    expect(editionWriteSchema.parse(independent)).toEqual(independent);
    expect(editionSchema.parse(independent)).not.toHaveProperty(
      'regulatorySections',
    );
    const historical = {
      ...mapped,
      regulatorySections: {
        ...mapped.regulatorySections,
        sections: [
          {
            sectionCode: 'old',
            sectionType: 'future',
            themeCode: 'unknown',
            category: 'future',
          },
        ],
      },
    };
    expect(editionSchema.parse(historical)).toEqual(historical);
    expect(editionWriteSchema.safeParse(historical).success).toBe(false);
  });
  it.each(['BN', 'CLP', 'DIG', 'PORTFOLIO', 'IS'])(
    'round trips explicit section type %s without guessing local code, theme or work composition',
    (sectionType) => {
      const configuration = {
        ...mapped,
        regulatorySections: {
          ...mapped.regulatorySections,
          sections: [
            { sectionCode: section.code, sectionType, themeCode: 'LB' },
          ],
        },
      };
      expect(
        editionSchema.parse(
          JSON.parse(JSON.stringify(editionWriteSchema.parse(configuration))),
        ),
      ).toEqual(configuration);
      expect(configuration.sections).toEqual(independent.sections);
    },
  );
  it.each([
    'LB',
    'VR',
    'VRA',
    'CL',
    'BN',
    'NA',
    'NW',
    'CR',
    'AE',
    'SM',
    'PN',
    'PA',
    'ST',
    'RF',
    'AR',
    'SL',
    'NU',
    'SP',
    'RP',
    'TR',
  ])(
    'accepts documented theme %s independently from free text',
    (themeCode) => {
      const configuration = {
        ...mapped,
        regulatorySections: {
          ...mapped.regulatorySections,
          sections: [
            { sectionCode: section.code, sectionType: 'DIG', themeCode },
          ],
        },
      };
      expect(editionWriteSchema.parse(configuration).sections[0].theme).toBe(
        'Paesaggi italiani',
      );
    },
  );
  it('accepts a multi-letter VR suffix as a technical extension, not an explicit normative example', () => {
    expect(
      editionWriteSchema.safeParse({
        ...mapped,
        regulatorySections: {
          ...mapped.regulatorySections,
          sections: [
            {
              sectionCode: section.code,
              sectionType: 'DIG',
              themeCode: 'VRBC',
            },
          ],
        },
      }).success,
    ).toBe(true);
  });
  it('distinguishes theme NW from the NAW heading and rejects invented classifications and extra fields', () => {
    for (const change of [
      { sectionType: 'single' },
      { themeCode: 'NAW' },
      { themeCode: 'VR1' },
      { category: 'invented' },
      { maxWorksPerAuthor: 4 },
    ]) {
      const configuration = {
        ...mapped,
        regulatorySections: {
          ...mapped.regulatorySections,
          sections: [{ ...mapped.regulatorySections.sections[0], ...change }],
        },
      };
      expect(editionWriteSchema.safeParse(configuration).success).toBe(false);
    }
  });
  it('rejects orphan, duplicate, removed or renamed references while historical reads remain possible', () => {
    for (const configuration of [
      { ...mapped, sections: [] },
      { ...mapped, sections: [{ ...section, code: 'RENAMED' }] },
      { ...mapped, sections: [section, section] },
      {
        ...mapped,
        regulatorySections: {
          ...mapped.regulatorySections,
          sections: [
            ...mapped.regulatorySections.sections,
            ...mapped.regulatorySections.sections,
          ],
        },
      },
    ])
      expect(editionWriteSchema.safeParse(configuration).success).toBe(false);
    const renamed = {
      ...mapped,
      sections: [{ ...section, code: 'NEW' }],
      regulatorySections: {
        ...mapped.regulatorySections,
        sections: [
          { ...mapped.regulatorySections.sections[0], sectionCode: 'NEW' },
        ],
      },
    };
    expect(editionWriteSchema.parse(renamed)).toEqual(renamed);
  });
  it('requires an explicit matching profile and preserves incompatible reads', () => {
    for (const regulatoryProfile of [
      undefined,
      { id: regulatoryCatalog.profiles[1].id },
      { id: 'unknown' },
    ]) {
      const configuration = { ...mapped, regulatoryProfile };
      expect(editionSchema.safeParse(configuration).success).toBe(true);
      expect(editionWriteSchema.safeParse(configuration).success).toBe(false);
    }
  });
  it('rejects only documented TRAD exclusions, without imposing quotas or presets', () => {
    for (const change of [
      { sectionType: 'IS' },
      ...['NA', 'NW', 'RP', 'TR'].map((themeCode) => ({ themeCode })),
    ])
      expect(
        editionWriteSchema.safeParse({
          ...mapped,
          regulatorySections: {
            ...mapped.regulatorySections,
            sections: [{ ...mapped.regulatorySections.sections[0], ...change }],
          },
        }).success,
      ).toBe(false);
    const portfolio = {
      ...mapped,
      sections: [{ ...section, type: 'portfolio', minImages: 2, maxImages: 5 }],
      regulatorySections: {
        ...mapped.regulatorySections,
        sections: [{ sectionCode: section.code, sectionType: 'PORTFOLIO' }],
      },
    };
    expect(editionWriteSchema.safeParse(portfolio).success).toBe(true);
    expect(
      editionWriteSchema.safeParse({
        ...mapped,
        imageRules: { ...mapped.imageRules, maxBytes: 26_214_401 },
      }).success,
    ).toBe(false);
    expect(
      editionWriteSchema.safeParse({
        ...mapped,
        imageRules: { ...mapped.imageRules, minWidth: 10000, minHeight: 4001 },
      }).success,
    ).toBe(false);
  });
});
