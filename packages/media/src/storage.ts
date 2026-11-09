import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, isAbsolute, basename, dirname } from 'node:path';

export { maxPhotoBytes } from './limits';
export function mediaRoot() {
  const test = process.env.LUMIO_TEST_MODE === '1';
  const cwd = process.cwd();
  const workspace =
    basename(dirname(cwd)) === 'apps' ? resolve(cwd, '../..') : cwd;
  const local = resolve(workspace, '.data', test ? 'media-test' : 'media');
  if (test) return local; // Tests never read/write the configured development or hosted store.
  const configured = process.env.MEDIA_ROOT;
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.LUMIO_LOCAL_TEST !== '1' &&
    (!configured || !isAbsolute(configured))
  )
    throw new Error(
      'MEDIA_ROOT must be an absolute durable shared directory in production',
    );
  return configured ? resolve(configured) : local;
}
function pathFor(key: string) {
  if (!/^[a-f0-9-]{36}\/(original|preview)\/[a-f0-9-]{36}$/.test(key))
    throw new Error('Invalid media key');
  return resolve(mediaRoot(), ...key.split('/'));
}
export function mediaKey(
  organizationId: string,
  revisionId: string,
  kind: 'original' | 'preview',
) {
  const key = `${organizationId}/${kind}/${revisionId}`;
  pathFor(key);
  return key;
}
export async function writeMedia(key: string, bytes: Uint8Array) {
  const path = pathFor(key);
  await mkdir(resolve(path, '..'), { recursive: true, mode: 0o700 });
  await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
}
export async function readMedia(key: string) {
  return readFile(pathFor(key));
}
export async function writeImmutable(key: string, bytes: Uint8Array) {
  try {
    await writeMedia(key, bytes);
  } catch (error) {
    // A retry after a crash may find the immutable derivative already written.
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
      throw error;
    const previous = await readMedia(key);
    if (!previous.equals(Buffer.from(bytes)))
      throw new Error('Immutable media conflict', { cause: error });
  }
}
