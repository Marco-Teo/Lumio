import { describe, expect, it, vi } from 'vitest';
import { freezeRecursively } from './freeze';
import type { RegulatoryCatalog } from './types';
import {
  regulatoryCatalog,
  getRegulatoryItem,
  getRegulatoryProfile,
} from './index';
import { fiaf2027Data } from './fiaf-2027';
import {
  editionSchema,
  editionWriteSchema,
  emptyEdition,
} from '../competitions';

describe('internal FIAF 2027 catalog', () => {
  it('publishes explicit stable identities, distinct revisions and no latest fallback', () => {
    expect(
      regulatoryCatalog.profiles
        .filter(
          ({ authority, normativeVersion }) =>
            authority === 'FIAF' && normativeVersion === '2027',
        )
        .map(({ id, target }) => ({ id, target })),
    ).toEqual(
      expect.arrayContaining([
        { id: 'fiaf-2027-patrocinio-v1', target: 'patrocinio' },
        { id: 'fiaf-2027-raccomandazione-v1', target: 'raccomandazione' },
      ]),
    );
    for (const id of [
      'fiaf-2027-patrocinio-v1',
      'fiaf-2027-raccomandazione-v1',
    ]) {
      const profile = getRegulatoryProfile(id)!;
      expect(getRegulatoryProfile(profile.id)).toBe(profile);
      expect(profile).toMatchObject({
        authority: 'FIAF',
        normativeVersion: '2027',
        normativeRevision: '1.0',
        implementationVersion: '1.0.0',
        effectiveFrom: '2027-01-01',
        status: 'catalog-only',
      });
      expect(profile.disclaimer).toContain('non certifica');
    }
    for (const id of [
      'latest',
      'fiaf-2027-patrocinio-v1 ',
      'FIAF-2027-patrocinio-v1',
      'fiaf-2027-patrocinio',
      'independent',
      '',
    ])
      expect(getRegulatoryProfile(id)).toBeUndefined();
    expect(getRegulatoryItem('unknown')).toBeUndefined();
  });

  function assertCatalogIntegrity(catalog: RegulatoryCatalog) {
    const { sources, items, profiles } = catalog;
    const findItem = (id: string) => items.find((item) => item.id === id);
    for (const collection of [sources, items, profiles])
      expect(new Set(collection.map(({ id }) => id)).size).toBe(
        collection.length,
      );
    for (const source of sources.filter(
      ({ id }) => id === 'fiaf-2027-definitive',
    )) {
      expect(source.landingPageUrl).toBe(
        'https://fiaf.net/regolamenti-concorsi/',
      );
      expect(source.documentUrl).toBe(
        'https://fiaf.net/wp-content/uploads/2026/09/REGOLAMENTO-CONCORSI-REVISIONE-2027_CN-23-09-26.pdf',
      );
    }
    for (const item of items) {
      expect(findItem(item.id)).toBe(item);
      expect(item.description.trim().length).toBeGreaterThan(0);
      expect(item.references.length).toBeGreaterThan(0);
      for (const reference of item.references) {
        expect(sources.some(({ id }) => id === reference.sourceId)).toBe(true);
        expect(reference.article.trim().length).toBeGreaterThan(0);
        expect(reference.pages.length).toBeGreaterThan(0);
        expect(
          reference.pages.every(
            (page) =>
              Number.isInteger(page) &&
              page >= 1 &&
              (reference.sourceId !== 'fiaf-2027-definitive' || page <= 35),
          ),
        ).toBe(true);
      }
      if (item.kind === 'exception') {
        expect(item.condition.length).toBeGreaterThan(0);
        expect(item.relatedItemIds.length).toBeGreaterThan(0);
        for (const id of item.relatedItemIds)
          expect(findItem(id)).toBeDefined();
      }
    }
    for (const profile of profiles) {
      expect(new Set(profile.itemIds).size).toBe(profile.itemIds.length);
      for (const id of profile.itemIds) expect(findItem(id)).toBeDefined();
      for (const id of profile.sourceIds)
        expect(sources.some((source) => source.id === id)).toBe(true);
    }
    expect(
      items.every((item) =>
        profiles.some((profile) => profile.itemIds.includes(item.id)),
      ),
    ).toBe(true);
  }

  it('has globally unique items and resolves all source, profile and exception references', () => {
    assertCatalogIntegrity(regulatoryCatalog);
    for (const item of regulatoryCatalog.items)
      expect(getRegulatoryItem(item.id)).toBe(item);
  });

  it('supports another version alongside unchanged 2027 profiles with exact lookup', async () => {
    const before = JSON.stringify(regulatoryCatalog);
    // Synthetic data only: no normative assertions about a future FIAF release.
    const fixture = freezeRecursively({
      sources: [
        ...regulatoryCatalog.sources,
        {
          id: 'test-only-source',
          title: 'Test fixture',
          landingPageUrl: 'https://example.invalid/',
          documentUrl: 'https://example.invalid/fixture.pdf',
          verifiedOn: '2026-11-09',
        },
      ],
      items: [
        ...regulatoryCatalog.items,
        {
          id: 'test-only-item',
          description: 'Test fixture',
          kind: 'manual',
          verification: 'documentary',
          references: [
            { sourceId: 'test-only-source', article: 'fixture', pages: [42] },
          ],
        },
      ],
      profiles: [
        ...regulatoryCatalog.profiles,
        {
          id: 'test-only-future-profile',
          authority: 'FIAF',
          normativeVersion: '2028',
          normativeRevision: 'test',
          implementationVersion: '0.0.0-test',
          effectiveFrom: '2028-01-01',
          target: 'patrocinio',
          sourceIds: ['test-only-source'],
          itemIds: ['test-only-item'],
          status: 'catalog-only',
          disclaimer: 'Synthetic test fixture',
        },
      ],
    } satisfies RegulatoryCatalog);
    vi.resetModules();
    vi.doMock('./fiaf-2027', () => ({ fiaf2027Data: fixture }));
    try {
      const mixed = await import('./index');
      assertCatalogIntegrity(mixed.regulatoryCatalog);
      expect(
        mixed.getRegulatoryProfile('test-only-future-profile')
          ?.normativeVersion,
      ).toBe('2028');
      expect(mixed.getRegulatoryItem('test-only-item')).toBe(
        fixture.items.at(-1),
      );
      for (const profile of regulatoryCatalog.profiles)
        expect(mixed.getRegulatoryProfile(profile.id)).toBe(profile);
      for (const id of [
        'test-only-future',
        'test-only-future-profile ',
        'TEST-only-future-profile',
      ])
        expect(mixed.getRegulatoryProfile(id)).toBeUndefined();
      expect(mixed.getRegulatoryItem('test-only-item ')).toBeUndefined();
      expect(JSON.stringify(regulatoryCatalog)).toBe(before);
    } finally {
      vi.doUnmock('./fiaf-2027');
      vi.resetModules();
    }
  });

  it('records confirmed values with their proper classification and scope', () => {
    expect(getRegulatoryItem('fiaf.2027.dig-format')).toMatchObject({
      kind: 'constraint',
      requirement: {
        type: 'dig-file-format',
        format: 'jpeg',
        extension: '.jpg',
        colorSpace: 'srgb',
      },
      references: [{ article: '1.5.5', pages: [8] }],
    });
    expect(getRegulatoryItem('fiaf.2027.digital-long-edge')).toMatchObject({
      kind: 'constraint',
      requirement: { sections: ['DIG', 'IS'], pixels: 2500 },
    });
    expect(getRegulatoryItem('fiaf.2027.portfolio-composition')).toMatchObject({
      kind: 'constraint',
      requirement: { minImages: 8, maxImages: 12, chosenBy: 'author' },
    });
    expect(getRegulatoryItem('fiaf.2027.themes-dig')).toMatchObject({
      kind: 'parameter',
      parameter: { type: 'theme-count', section: 'DIG', maximum: 4 },
    });
    expect(getRegulatoryItem('fiaf.2027.themes-portfolio')).toMatchObject({
      kind: 'parameter',
      parameter: { type: 'theme-count', section: 'PORTFOLIO', maximum: 3 },
    });
    expect(getRegulatoryItem('fiaf.2027.themes-is')).toMatchObject({
      kind: 'parameter',
      parameter: { type: 'theme-count', section: 'IS', maximum: 1 },
    });
    expect(getRegulatoryItem('fiaf.2027.member-discount')).toMatchObject({
      kind: 'parameter',
      parameter: {
        cases: [
          { juryMode: 'in-person', minimumPercent: 10 },
          {
            juryMode: 'online-or-mixed',
            comparison: 'same-section-count-fee-not-increased',
            minimumPercent: 15,
          },
          {
            juryMode: 'online-or-mixed',
            comparison: 'same-section-count-fee-increased',
            minimumPercent: 20,
          },
        ],
      },
    });
    expect(getRegulatoryItem('fiaf.2027.nature-juror')).toMatchObject({
      kind: 'recommendation',
      verification: 'advisory',
    });
    expect(getRegulatoryItem('fiaf.2027.raw-checks')).toMatchObject({
      kind: 'manual',
      verification: 'documentary',
    });
    expect(
      getRegulatoryItem('fiaf.2027.international-size-exception'),
    ).toMatchObject({
      kind: 'exception',
      verification: 'documentary',
      relatedItemIds: ['fiaf.2027.digital-long-edge'],
    });
  });

  it('does not silently inherit Patrocinio requirements into Raccomandazione', () => {
    const recommended = getRegulatoryProfile('fiaf-2027-raccomandazione-v1')!;
    expect(recommended.itemIds).toContain('fiaf.2027.portfolio-composition');
    expect(recommended.itemIds).toContain('fiaf.2027.member-discount');
    expect(recommended.itemIds).toContain(
      'fiaf.2027.recommendation-catalogue-exception',
    );
    expect(recommended.itemIds).toContain('fiaf.2027.raw-checks');
    for (const id of [
      'fiaf.2027.dig-format',
      'fiaf.2027.digital-long-edge',
      'fiaf.2027.catalogue',
      'fiaf.2027.jury-organization',
    ])
      expect(recommended.itemIds).not.toContain(id);
  });

  it('documents the jury exception conditions without automatic validation', () => {
    const item = getRegulatoryItem('fiaf.2027.recommendation-jury-exception');
    expect(item).toMatchObject({
      kind: 'exception',
      verification: 'documentary',
      references: [{ article: '2, deroghe, lettera e', pages: [21] }],
      relatedItemIds: ['fiaf.2027.jury-organization'],
    });
    if (item?.kind !== 'exception') throw new Error('Fixture missing');
    for (const condition of [
      'dispari di almeno tre',
      'esclusa la preselezione interna',
      'metodologie non ordinarie',
      'nel bando e nel verbale',
    ])
      expect(item.condition).toContain(condition);
    expect(
      getRegulatoryProfile('fiaf-2027-raccomandazione-v1')?.itemIds,
    ).toContain(item.id);
    expect(item).not.toHaveProperty('requirement');
    expect(item).not.toHaveProperty('parameter');
  });

  it('keeps unresolved interpretations outside automatic descriptors', () => {
    for (const id of [
      'fiaf.2027.question-dig-count',
      'fiaf.2027.question-is-count',
      'fiaf.2027.question-format-scope',
      'fiaf.2027.question-untagged-srgb',
      'fiaf.2027.question-discount-baseline',
      'fiaf.2027.question-recommendation-scope',
      'fiaf.2027.question-raw-controls',
      'fiaf.2027.question-applicable-year',
    ]) {
      const question = getRegulatoryItem(id);
      expect(question).toMatchObject({
        kind: 'open-question',
        verification: 'clarification',
      });
      expect(question).not.toHaveProperty('requirement');
      expect(question).not.toHaveProperty('parameter');
    }
  });

  it('freezes every nested record and array, including direct data imports', () => {
    function assertFrozen(value: unknown) {
      if (value === null || typeof value !== 'object') return;
      expect(Object.isFrozen(value)).toBe(true);
      for (const child of Object.values(value) as unknown[])
        assertFrozen(child);
    }
    assertFrozen(regulatoryCatalog);
    assertFrozen(fiaf2027Data);
    const item = getRegulatoryItem('fiaf.2027.portfolio-composition')!;
    expect(Reflect.set(item, 'description', 'changed')).toBe(false);
    if (
      item.kind !== 'constraint' ||
      item.requirement.type !== 'portfolio-composition'
    )
      throw new Error('Fixture missing');
    expect(Reflect.set(item.requirement, 'maxImages', 99)).toBe(false);
    expect(() =>
      Array.prototype.push.call(regulatoryCatalog.profiles, {}),
    ).toThrow(TypeError);
    expect(() =>
      Array.prototype.push.call(item.references[0].pages, 999),
    ).toThrow(TypeError);
    expect(item.requirement.maxImages).toBe(12);
  });

  it('does not add photo platform limits or change independent edition parsing', () => {
    const draft = emptyEdition('Independent', 'independent', '2027');
    const independent = {
      ...draft,
      imageRules: {
        ...draft.imageRules,
        formats: ['png', 'tiff'],
        colorProfile: 'any',
        maxLongEdge: 1900,
      },
      sections: [
        {
          name: 'Free portfolio',
          code: 'FREE',
          description: '',
          theme: '',
          type: 'portfolio',
          minImages: 2,
          maxImages: 5,
          feeCents: 0,
          specificRules: '',
        },
      ],
    };
    const before = JSON.stringify(independent);
    expect(editionSchema.parse(independent)).toEqual(independent);
    expect(editionWriteSchema.parse(independent)).toEqual(independent);
    expect(JSON.stringify(independent)).toBe(before);
    const legacy = {
      ...draft,
      imageRules: { ...draft.imageRules, maxBytes: 100_000_000 },
    };
    expect(editionSchema.parse(legacy)).toEqual(legacy);
    expect(editionWriteSchema.safeParse(legacy).success).toBe(false);
    expect(JSON.stringify(regulatoryCatalog)).not.toMatch(
      /maxPhotoBytes|maxPhotoPixels|maxBytes/,
    );
  });
});
