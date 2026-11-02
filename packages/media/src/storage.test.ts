import { expect, it, vi, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { mediaKey, mediaRoot, writeImmutable, readMedia } from './storage';
afterEach(() => vi.unstubAllEnvs());
it('isolates tests from configured stores and rejects traversal keys', () => {
  vi.stubEnv('LUMIO_TEST_MODE', '1');
  vi.stubEnv('MEDIA_ROOT', 'C:/must-never-be-used');
  expect(mediaRoot()).toBe(resolve('.data/media-test'));
  expect(() => mediaKey('../outside', randomUUID(), 'original')).toThrow(
    'Invalid media key',
  );
});
it('never overwrites an original; identical retry succeeds, different bytes fail', async () => {
  vi.stubEnv('LUMIO_TEST_MODE', '1');
  const org = randomUUID(),
    id = randomUUID();
  const key = mediaKey(org, id, 'original');
  try {
    await writeImmutable(key, Buffer.from('original'));
    await writeImmutable(key, Buffer.from('original'));
    await expect(writeImmutable(key, Buffer.from('changed'))).rejects.toThrow(
      'Immutable media conflict',
    );
    expect((await readMedia(key)).toString()).toBe('original');
  } finally {
    await rm(resolve(mediaRoot(), org), { recursive: true, force: true });
  }
});
it('requires durable absolute storage in hosted production', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('LUMIO_LOCAL_TEST', '0');
  vi.stubEnv('LUMIO_TEST_MODE', '0');
  vi.stubEnv('MEDIA_ROOT', 'relative-path');
  expect(mediaRoot).toThrow('MEDIA_ROOT');
});
