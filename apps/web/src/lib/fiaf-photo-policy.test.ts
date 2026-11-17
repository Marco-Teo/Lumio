import { describe, expect, it } from 'vitest';
import { previewFiafEdition } from './fiaf-preview';
import {
  editionSchema,
  editionWriteSchema,
  emptyEdition,
} from './competitions';
import {
  fiafPhotoPolicyId,
  fiafPhotoPolicyIssues,
  sectionPhotoRules,
  sectionPhotoRulesLabel,
} from './fiaf-photo-policy';

function configuration(target = 'patrocinio', type = 'DIG') {
  const profileId = `fiaf-2027-${target}-v1`;
  return {
    ...emptyEdition('Foto', 'foto', '2027'),
    regulatoryProfile: { id: profileId },
    regulatoryPhotoPolicy: { id: fiafPhotoPolicyId, profileId },
    regulatorySections: {
      profileId,
      sections: [{ sectionCode: 'A', sectionType: type, themeCode: 'LB' }],
    },
    sections: [
      {
        name: 'Foto',
        code: 'A',
        description: '',
        theme: '',
        type: 'single' as const,
        minImages: 1,
        maxImages: 1,
        feeCents: 0,
        specificRules: '',
      },
    ],
  };
}
describe('versioned per-section ordinary photo policy', () => {
  it('resolves DIG and IS independently without mutating general settings', () => {
    const config = configuration();
    config.imageRules.formats = ['jpeg', 'png'];
    config.regulatorySections.sections.push({
      sectionCode: 'B',
      sectionType: 'IS',
      themeCode: 'LB',
    });
    const before = structuredClone(config);
    expect(sectionPhotoRules(config, 'A')).toMatchObject({
      formats: ['jpeg'],
      colorProfile: 'srgb',
      exactLongEdge: 2500,
    });
    expect(sectionPhotoRules(config, 'B')).toMatchObject({
      formats: ['jpeg', 'png'],
      colorProfile: 'any',
      exactLongEdge: 2500,
    });
    expect(config).toEqual(before);
    expect(sectionPhotoRulesLabel(config, 'A')).toContain('2.500 px');
  });
  it.each(['BN', 'CLP', 'PORTFOLIO'])(
    'does not infer digital rules for %s',
    (type) => {
      const config = configuration('patrocinio', type);
      expect(sectionPhotoRules(config, 'A')).toMatchObject(config.imageRules);
      expect(sectionPhotoRules(config, 'A')).not.toHaveProperty(
        'exactLongEdge',
      );
    },
  );
  it('does not inherit Patrocinio requirements into Raccomandazione', () => {
    const config = configuration('raccomandazione');
    expect(sectionPhotoRules(config, 'A')).toMatchObject(config.imageRules);
    expect(sectionPhotoRules(config, 'A')).not.toHaveProperty('exactLongEdge');
  });
  it('keeps historical configurations, snapshot rules and independent behavior unchanged', () => {
    const { regulatoryPhotoPolicy: omitted, ...legacy } = configuration();
    void omitted;
    expect(editionSchema.parse(legacy)).toEqual(legacy);
    expect(sectionPhotoRules(legacy, 'A')).toEqual(legacy.imageRules);
    expect(editionWriteSchema.safeParse(legacy).success).toBe(true);
    expect(fiafPhotoPolicyIssues(legacy).join(' ')).toContain('conferma');
    expect(fiafPhotoPolicyIssues(emptyEdition('Foto', 'foto', '2027'))).toEqual(
      [],
    );
  });
  it.each(['minWidth', 'minHeight', 'maxLongEdge'] as const)(
    'allows an incomplete draft but blocks incompatible %s',
    (field) => {
      const config = configuration();
      config.imageRules[field] = field === 'maxLongEdge' ? 2499 : 2501;
      expect(editionWriteSchema.safeParse(config).success).toBe(true);
      expect(fiafPhotoPolicyIssues(config).join(' ')).toContain('2.500');
      config.imageRules[field] = 2500;
      expect(fiafPhotoPolicyIssues(config)).toEqual([]);
    },
  );
  it('does not broaden configured formats and rejects mismatched, extra or future identifiers on writes', () => {
    const config = configuration();
    config.imageRules.formats = ['png'];
    expect(fiafPhotoPolicyIssues(config).join(' ')).toContain('JPEG');
    for (const policy of [
      { ...config.regulatoryPhotoPolicy, id: 'future' },
      {
        ...config.regulatoryPhotoPolicy,
        profileId: 'fiaf-2027-raccomandazione-v1',
      },
      { ...config.regulatoryPhotoPolicy, exactLongEdge: 1 },
    ])
      expect(
        editionWriteSchema.safeParse({
          ...config,
          regulatoryPhotoPolicy: policy,
        }).success,
      ).toBe(false);
    expect(
      editionSchema.safeParse({
        ...config,
        regulatoryPhotoPolicy: { id: 'future', profileId: 'future' },
      }).success,
    ).toBe(true);
  });
  it('does not silently fall back for unknown policies or ambiguous section associations', () => {
    const config = configuration();
    const unknown = {
      ...config,
      regulatoryPhotoPolicy: { ...config.regulatoryPhotoPolicy, id: 'future' },
    };
    expect(() => sectionPhotoRules(unknown, 'A')).toThrow(
      'UNSUPPORTED_PHOTO_POLICY',
    );
    expect(sectionPhotoRulesLabel(unknown, 'A')).toContain('non disponibile');
    expect(() =>
      previewFiafEdition(editionSchema.parse(unknown)),
    ).not.toThrow();
    config.regulatorySections.sections.push({
      ...config.regulatorySections.sections[0],
    });
    expect(() => sectionPhotoRules(config, 'A')).toThrow(
      'INVALID_PHOTO_POLICY_SECTION',
    );
    expect(sectionPhotoRulesLabel(config, 'A')).toContain('Completa');
    expect(() => fiafPhotoPolicyIssues(config)).not.toThrow();
    config.regulatorySections.sections = [];
    expect(sectionPhotoRulesLabel(config, 'A')).toContain('Completa');
    expect(() => fiafPhotoPolicyIssues(config)).not.toThrow();
  });
});
