import { describe, expect, it } from 'vitest';
import {
  editionSchema,
  editionWriteSchema,
  emptyEdition,
  type EditionConfiguration,
} from './competitions';
import { previewFiafEdition } from './fiaf-preview';
import { regulatoryCatalog } from './regulatory-profiles';

const profiles = regulatoryCatalog.profiles.filter(
  (profile) => profile.normativeVersion === '2027',
);
const patronage = profiles.find(
  (profile) => profile.target === 'patrocinio',
)!.id;
const recommendation = profiles.find(
  (profile) => profile.target === 'raccomandazione',
)!.id;
function draft(type = 'DIG', profileId = patronage): EditionConfiguration {
  const config = emptyEdition('Edizione', 'edizione', '2027');
  return {
    ...config,
    regulatoryProfile: { id: profileId },
    regulatorySections: {
      profileId,
      sections: [{ sectionCode: 'LOCAL', sectionType: type, themeCode: 'LB' }],
    },
    sections: [
      {
        name: 'Locale',
        code: 'LOCAL',
        description: '',
        theme: '',
        type: type === 'PORTFOLIO' ? 'portfolio' : 'single',
        minImages: type === 'PORTFOLIO' ? 8 : 1,
        maxImages: type === 'PORTFOLIO' ? 12 : 1,
        feeCents: 0,
        specificRules: '',
      },
    ],
  };
}
function results(config: EditionConfiguration, ruleSuffix: string) {
  return previewFiafEdition(config).results.filter(
    (result) => result.ruleId === `fiaf.2027.${ruleSuffix}`,
  );
}
describe('informational FIAF preview', () => {
  it('does not evaluate independent editions or silently resolve unknown IDs', () => {
    expect(previewFiafEdition(emptyEdition('Nome', 'nome', '2027'))).toEqual({
      kind: 'independent',
      results: [],
    });
    for (const id of ['fiaf-2028-patrocinio-v1', `${patronage} `, 'unknown'])
      expect(previewFiafEdition(draft('DIG', id))).toEqual({
        kind: 'unavailable',
        results: [],
      });
  });
  it('uses only items associated with the exact selected profile', () => {
    for (const profile of profiles) {
      const preview = previewFiafEdition(draft('DIG', profile.id));
      expect(preview.kind).toBe('available');
      expect(new Set(preview.results.map((result) => result.id)).size).toBe(
        preview.results.length,
      );
      for (const result of preview.results) {
        expect(profile.itemIds).toContain(result.ruleId);
        expect(result.references.length).toBeGreaterThan(0);
        expect(result.action).not.toBe('');
        expect(result.references).toEqual(
          regulatoryCatalog.items.find((item) => item.id === result.ruleId)!
            .references,
        );
      }
    }
    expect(results(draft('DIG'), 'dig-format')).toHaveLength(1);
    expect(results(draft('DIG', recommendation), 'dig-format')).toHaveLength(0);
    expect(
      results(draft('IS', recommendation), 'digital-long-edge'),
    ).toHaveLength(0);
    expect(
      results(draft('PORTFOLIO', recommendation), 'portfolio-composition')[0]
        .state,
    ).toBe('satisfied');
  });
  it('requires explicit mapping and theme codes rather than inferring from local names', () => {
    const config = draft();
    delete config.regulatorySections;
    config.sections[0].code = 'DIG';
    config.sections[0].theme = 'LB';
    expect(results(config, 'separate-synthesis')[0].state).toBe(
      'configuration',
    );
    expect(results(config, 'dig-format')).toHaveLength(0);
    const incomplete = draft();
    delete incomplete.regulatorySections!.sections[0].themeCode;
    expect(results(incomplete, 'separate-synthesis')[0].state).toBe(
      'configuration',
    );
    expect(results(draft(), 'separate-synthesis')[0].state).toBe('satisfied');
    expect(results(draft(), 'separate-synthesis').at(-1)!.state).toBe('manual');
  });
  it('reports mismatched, orphan, duplicate and invalid historical classifications without changing them', () => {
    const changes = [
      (config: EditionConfiguration) => {
        config.regulatorySections!.profileId = recommendation;
      },
      (config: EditionConfiguration) => {
        config.regulatorySections!.sections[0].sectionCode = 'missing';
      },
      (config: EditionConfiguration) => {
        config.regulatorySections!.sections.push({
          ...config.regulatorySections!.sections[0],
        });
      },
      (config: EditionConfiguration) => {
        config.regulatorySections!.sections[0].themeCode = 'invented';
      },
      (config: EditionConfiguration) => {
        config.regulatorySections!.sections[0].category = 'TRAD';
        config.regulatorySections!.sections[0].sectionType = 'IS';
      },
    ];
    for (const change of changes) {
      const config = draft();
      change(config);
      const historical = editionSchema.parse(config);
      const before = structuredClone(historical);
      expect(
        results(historical, 'separate-synthesis').some(
          (row) => row.state === 'correction',
        ),
      ).toBe(true);
      expect(historical).toEqual(before);
    }
  });
  it.each([7, 8, 12, 13])(
    'evaluates %i photographs per Portfolio, not works per author',
    (count) => {
      const config = draft('PORTFOLIO');
      config.sections[0].minImages = count;
      config.sections[0].maxImages = count;
      const result = results(config, 'portfolio-composition')[0];
      expect(result.state).toBe(
        count >= 8 && count <= 12 ? 'satisfied' : 'correction',
      );
      expect(result.action).toContain('non il massimo di opere per autore');
      expect(results(config, 'portfolio-composition')[1].state).toBe('manual');
      // The preview is not a write validator: even 7/13 remain savable drafts.
      expect(editionWriteSchema.safeParse(config).success).toBe(true);
    },
  );
  it('checks Portfolio intervals and work type without converting unclassified works', () => {
    const config = draft('PORTFOLIO');
    config.sections[0].minImages = 12;
    config.sections[0].maxImages = 8;
    expect(results(config, 'portfolio-composition')[0].state).toBe(
      'correction',
    );
    config.sections[0].minImages = Number.NaN;
    expect(results(config, 'portfolio-composition')[0].state).toBe(
      'configuration',
    );
    config.sections[0] = {
      ...config.sections[0],
      minImages: 1,
      maxImages: 1,
      type: 'single',
    };
    expect(results(config, 'portfolio-composition')[0].state).toBe(
      'correction',
    );
    config.sections[0].type = 'portfolio';
    delete config.regulatorySections;
    expect(results(config, 'portfolio-composition')[0].state).toBe(
      'configuration',
    );
    config.regulatorySections = draft('DIG').regulatorySections;
    expect(results(config, 'portfolio-composition')[0].state).toBe('manual');
  });
  it('checks JPEG/sRGB only for mapped DIG, and exposes the global policy limitation', () => {
    const config = draft();
    expect(results(config, 'dig-format')[0].state).toBe('correction');
    config.imageRules.colorProfile = 'srgb';
    config.imageRules.formats = ['jpeg'];
    expect(results(config, 'dig-format')[0].state).toBe('satisfied');
    config.imageRules.formats.push('png');
    expect(results(config, 'dig-format')[0].state).toBe('correction');
    config.imageRules.formats = ['jpeg'];
    config.sections.push({ ...config.sections[0], code: 'OTHER' });
    expect(results(config, 'dig-format')[0].state).toBe('manual');
    for (const type of ['IS', 'PORTFOLIO', 'BN', 'CLP'])
      expect(results(draft(type), 'dig-format')).toHaveLength(0);
  });
  it('never equates a maximum long edge with an exact size or grants a size exception', () => {
    for (const type of ['DIG', 'IS']) {
      const config = draft(type);
      for (const maximum of [null, 2500, 3000]) {
        config.imageRules.maxLongEdge = maximum;
        expect(results(config, 'digital-long-edge')[0].state).toBe('manual');
      }
      config.imageRules.maxLongEdge = 2000;
      expect(results(config, 'digital-long-edge')[0].state).toBe('correction');
      config.imageRules.maxLongEdge = null;
      config.imageRules.minHeight = 3000;
      expect(results(config, 'digital-long-edge')[0].state).toBe('correction');
      expect(results(config, 'international-size-exception')[0].state).toBe(
        'manual',
      );
    }
    expect(results(draft('PORTFOLIO'), 'digital-long-edge')).toHaveLength(0);
  });
  it('keeps exceptions, open interpretations, themes and documentary obligations manual', () => {
    for (const profile of profiles) {
      const preview = previewFiafEdition(draft('PORTFOLIO', profile.id));
      for (const item of regulatoryCatalog.items.filter(
        (item) =>
          profile.itemIds.includes(item.id) && item.kind !== 'constraint',
      )) {
        const found = preview.results.filter(
          (result) => result.ruleId === item.id,
        );
        expect(found.length).toBeGreaterThan(0);
        expect(found.every((result) => result.state === 'manual')).toBe(true);
      }
    }
  });
  it('is pure for frozen historical configurations, including previously valid photo limits', () => {
    const config = draft();
    config.imageRules.maxBytes = 1_000_000_000;
    const historical = editionSchema.parse(config);
    const serialized = JSON.stringify(historical);
    function freeze(value: unknown) {
      if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
      }
    }
    freeze(historical);
    expect(() => previewFiafEdition(historical)).not.toThrow();
    expect(JSON.stringify(historical)).toBe(serialized);
    expect(editionWriteSchema.safeParse(historical).success).toBe(false);
  });
  it('updates from current local values without changing saved configurations or adding preview fields', () => {
    const saved = draft('PORTFOLIO');
    const local = structuredClone(saved);
    local.sections[0].minImages = 7;
    expect(results(local, 'portfolio-composition')[0].state).toBe('correction');
    expect(results(saved, 'portfolio-composition')[0].state).toBe('satisfied');
    expect(editionWriteSchema.parse(saved)).toEqual(saved);
  });
  it.each([
    [7, 12, 'minImages'],
    [8, 13, 'maxImages'],
    [7, 13, 'minImages'],
  ] as const)(
    'links the responsible Portfolio bound for %i–%i',
    (minimum, maximum, field) => {
      const config = draft('PORTFOLIO');
      config.sections[0].minImages = minimum;
      config.sections[0].maxImages = maximum;
      const result = results(config, 'portfolio-composition')[0];
      expect(result.state).toBe('correction');
      expect(result.fieldPath).toBe(`sections.0.${field}`);
    },
  );
  it.each([
    [3000, null, null, 'imageRules.minWidth'],
    [null, 3000, null, 'imageRules.minHeight'],
    [null, null, 2000, 'imageRules.maxLongEdge'],
    [3000, 3000, null, 'imageRules'],
    [3000, null, 2000, 'imageRules'],
    [null, 3000, 2000, 'imageRules'],
    [3000, 3000, 2000, 'imageRules'],
  ] as const)(
    'links incompatible dimensions %s/%s/%s to %s',
    (width, height, maximum, field) => {
      const config = draft();
      Object.assign(config.imageRules, {
        minWidth: width,
        minHeight: height,
        maxLongEdge: maximum,
      });
      const result = results(config, 'digital-long-edge')[0];
      expect(result.state).toBe('correction');
      expect(result.fieldPath).toBe(field);
    },
  );
  it('explicitly limits positive results to declared configuration', () => {
    const config = draft();
    config.imageRules.colorProfile = 'srgb';
    expect(results(config, 'dig-format')[0].action).toContain(
      'file reali, estensione e casi ICC restano da verificare',
    );
    expect(results(config, 'separate-synthesis')[0].action).toContain(
      'non il contenuto delle opere',
    );
    expect(results(draft('PORTFOLIO'), 'portfolio-composition')[1].state).toBe(
      'manual',
    );
  });
});
