import { describe, expect, it } from 'vitest';
import {
  editionSchema,
  editionWriteSchema,
  emptyEdition,
  publicationIssues,
  type EditionConfiguration,
} from './competitions';
import { fiafPublicationIssues } from './fiaf-publication';
import { fiafPhotoPolicyId } from './fiaf-photo-policy';
import { regulatoryCatalog } from './regulatory-profiles';

function configuration(
  target: 'patrocinio' | 'raccomandazione',
  sectionType = 'PORTFOLIO',
): EditionConfiguration {
  const profile = regulatoryCatalog.profiles.find(
    (profile) =>
      profile.target === target && profile.normativeVersion === '2027',
  )!;
  return {
    ...emptyEdition('Edizione', 'edizione', '2027'),
    regulatoryProfile: { id: profile.id },
    regulatoryPhotoPolicy: { id: fiafPhotoPolicyId, profileId: profile.id },
    regulatorySections: {
      profileId: profile.id,
      sections: [{ sectionCode: 'A', sectionType, themeCode: 'LB' }],
    },
    sections: [
      {
        code: 'A',
        name: 'Locale',
        description: '',
        theme: '',
        type: sectionType === 'PORTFOLIO' ? 'portfolio' : 'single',
        minImages: sectionType === 'PORTFOLIO' ? 8 : 1,
        maxImages: sectionType === 'PORTFOLIO' ? 12 : 1,
        specificRules: '',
        feeCents: 0,
      },
    ],
  };
}
describe('FIAF publication policy, separate from draft validation', () => {
  it.each(['patrocinio', 'raccomandazione'] as const)(
    'keeps incomplete %s drafts savable but requires explicit classification at publication',
    (target) => {
      const config = configuration(target);
      delete config.regulatorySections;
      expect(editionWriteSchema.safeParse(config).success).toBe(true);
      expect(fiafPublicationIssues(config).join(' ')).toContain(
        'Scegli esplicitamente',
      );
      config.regulatorySections = configuration(target).regulatorySections;
      delete config.regulatorySections!.sections[0].themeCode;
      if (target === 'patrocinio')
        expect(fiafPublicationIssues(config).join(' ')).toContain(
          'codice tema',
        );
      else expect(fiafPublicationIssues(config)).toEqual([]);
    },
  );
  it.each([7, 8, 12, 13])(
    'checks %i images per Portfolio only at publication',
    (count) => {
      for (const target of ['patrocinio', 'raccomandazione'] as const) {
        const config = configuration(target);
        config.sections[0].minImages = count;
        config.sections[0].maxImages = count;
        expect(editionWriteSchema.safeParse(config).success).toBe(true);
        expect(fiafPublicationIssues(config).length > 0).toBe(
          count < 8 || count > 12,
        );
        expect(editionSchema.parse(config)).toEqual(config);
      }
    },
  );
  it('rejects mismatched work type and mapping rather than converting them', () => {
    const config = configuration('patrocinio');
    config.sections[0].type = 'single';
    config.sections[0].minImages = config.sections[0].maxImages = 1;
    const before = structuredClone(config);
    expect(fiafPublicationIssues(config).join(' ')).toContain('tipo portfolio');
    config.regulatorySections!.profileId = 'unknown';
    expect(fiafPublicationIssues(config).join(' ')).toContain('mappatura');
    config.regulatorySections!.profileId = before.regulatorySections!.profileId;
    expect(config).toEqual(before);
  });
  it('enforces the DIG configuration only for associated profiles, not for IS or independent editions', () => {
    const config = configuration('patrocinio', 'DIG');
    expect(fiafPublicationIssues(config)).toEqual([]);
    config.imageRules.colorProfile = 'srgb';
    expect(fiafPublicationIssues(config)).toEqual([]);
    config.imageRules.formats.push('png');
    expect(fiafPublicationIssues(config)).toEqual([]);
    config.imageRules.formats = ['png'];
    expect(fiafPublicationIssues(config).join(' ')).toContain('JPEG');
    expect(
      fiafPublicationIssues(configuration('raccomandazione', 'DIG')),
    ).toEqual([]);
    expect(fiafPublicationIssues(configuration('patrocinio', 'IS'))).toEqual(
      [],
    );
    delete config.regulatoryProfile;
    delete config.regulatorySections;
    delete config.regulatoryPhotoPolicy;
    expect(fiafPublicationIssues(config)).toEqual([]);
  });
  it('checks ordinary dimensions only after explicit policy confirmation', () => {
    const config = configuration('patrocinio', 'DIG');
    config.imageRules.colorProfile = 'srgb';
    for (const cap of [null, 2000, 2500, 3000]) {
      config.imageRules.maxLongEdge = cap;
      expect(fiafPublicationIssues(config).length).toBe(cap === 2000 ? 1 : 0);
    }
  });
  it('fails closed for unavailable IDs without upgrading historical reads', () => {
    const config = configuration('patrocinio');
    config.regulatoryProfile!.id = 'fiaf-2028-unknown';
    delete config.regulatorySections;
    expect(editionSchema.parse(config)).toEqual(config);
    expect(fiafPublicationIssues(config).join(' ')).toContain(
      'non è supportato',
    );
  });
  it('shares the checks with the publication checklist while preserving independent behavior', () => {
    const config = configuration('patrocinio');
    config.sections[0].minImages = 7;
    const before = JSON.stringify(config);
    expect(publicationIssues(config)).toEqual(
      expect.arrayContaining(fiafPublicationIssues(config)),
    );
    expect(JSON.stringify(config)).toBe(before);
    expect(
      publicationIssues(emptyEdition('Nome', 'nome', '2027')),
    ).toHaveLength(8);
  });
});
