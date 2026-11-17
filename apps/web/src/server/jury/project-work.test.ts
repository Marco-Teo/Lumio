import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { anonymousWorkSchema } from '../../lib/anonymous-work';
import { projectAnonymousWork } from './project-work';

describe('anonymous work foundation, without jury access', () => {
  it('serializes only the anonymous code and photograph positions from a rich private record', () => {
    const source = {
      id: randomUUID(),
      anonymousCode: randomUUID(),
      registrationId: randomUUID(),
      organizationId: randomUUID(),
      personId: randomUUID(),
      title: 'Private author in title',
      registration: {
        profileSnapshot: {
          firstName: 'Private',
          email: 'private@example.invalid',
        },
      },
      createdAt: new Date(),
      photos: [
        {
          id: randomUUID(),
          position: 2,
          title: 'Private caption',
          revisions: [
            {
              id: randomUUID(),
              storageKey: 'private/original',
              sha256: 'private-hash',
              bytes: 123,
              exif: { Artist: 'Private', GPS: 'private-location' },
            },
          ],
        },
        { id: randomUUID(), position: 1 },
      ],
    };
    const before = structuredClone(source);
    const output = projectAnonymousWork(source);
    expect(JSON.parse(JSON.stringify(output))).toEqual({
      code: source.anonymousCode,
      photos: [{ position: 2 }, { position: 1 }],
    });
    expect(JSON.stringify(output)).not.toMatch(
      /Private|private|registration|storageKey|sha256|createdAt/,
    );
    expect(source).toEqual(before);
    expect(output).not.toHaveProperty('title');
    expect(output.photos[0]).not.toBe(source.photos[0]);
    expect(projectAnonymousWork(source)).toEqual(output);
  });
  it('does not infer or generate a code from internal identifiers or personal data', () => {
    for (const anonymousCode of [
      '',
      'person@example.invalid',
      '1234',
      '00000000-0000-1000-8000-000000000000',
    ])
      expect(() =>
        projectAnonymousWork({ anonymousCode, photos: [] }),
      ).toThrow();
  });
  it('rejects extra root and nested properties in a future response', () => {
    const work = { code: randomUUID(), photos: [{ position: 1 }] };
    for (const extra of [
      { id: randomUUID() },
      { registrationId: randomUUID() },
      { title: 'Author' },
      { originalUrl: '/original' },
      { winnerName: 'Author' },
      { awardsVisibility: 'public' },
      { results: [{ authorName: 'Author' }] },
    ])
      expect(anonymousWorkSchema.safeParse({ ...work, ...extra }).success).toBe(
        false,
      );
    expect(
      anonymousWorkSchema.safeParse({
        ...work,
        photos: [{ position: 1, revisionId: randomUUID() }],
      }).success,
    ).toBe(false);
  });
  it('rejects ambiguous photograph positions without changing portfolio order', () => {
    for (const photos of [
      [{ position: 1 }, { position: 1 }],
      [{ position: 0 }],
      [{ position: 101 }],
      [{ position: 1.5 }],
    ])
      expect(() =>
        projectAnonymousWork({ anonymousCode: randomUUID(), photos }),
      ).toThrow();
  });
  it('prevents accidental mutation of the projected contract, including nested photos', () => {
    const work = projectAnonymousWork({
      anonymousCode: randomUUID(),
      photos: [{ position: 1 }],
    });
    expect(() => Object.assign(work, { author: 'Private' })).toThrow();
    expect(() =>
      Object.assign(work.photos[0], { author: 'Private' }),
    ).toThrow();
    expect(() => Object.assign(work.photos, { 1: { position: 2 } })).toThrow();
  });
});
