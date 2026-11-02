import { expect, it } from 'vitest';
import sharp from 'sharp';
import { processPhoto, originalFormat, type ImageRules } from './processing';
const rules: ImageRules = {
  formats: ['jpeg', 'png', 'tiff'],
  maxBytes: 1000000,
  minWidth: null,
  minHeight: null,
  maxLongEdge: null,
  maxShortEdge: null,
  colorProfile: 'any',
};
const image = () =>
  sharp({
    create: { width: 80, height: 60, channels: 3, background: '#c89946' },
  });
it('creates a preview without EXIF or ICC and preserves the exact original bytes', async () => {
  const original = await image()
    .jpeg()
    .withMetadata({ exif: { IFD0: { Artist: 'Synthetic identity' } } })
    .toBuffer();
  const copy = Buffer.from(original);
  const result = await processPhoto(original, rules);
  const metadata = await sharp(result.preview).metadata();
  expect(metadata.format).toBe('webp');
  expect(metadata.exif).toBeUndefined();
  expect(metadata.icc).toBeUndefined();
  expect(original.equals(copy)).toBe(true);
  expect(result.width).toBe(80);
});
it.each(['jpeg', 'png', 'tiff'] as const)(
  'detects and processes %s independently of filename and MIME',
  async (format) => {
    const bytes = await image().toFormat(format).toBuffer();
    expect(originalFormat(bytes)).toBe(format);
    expect((await processPhoto(bytes, rules)).format).toBe(format);
  },
);
it('checks oriented dimensions without rotating the original', async () => {
  const bytes = await image()
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const result = await processPhoto(bytes, rules);
  expect([result.width, result.height]).toEqual([60, 80]);
  await expect(processPhoto(bytes, { ...rules, minWidth: 70 })).rejects.toThrow(
    'DIMENSIONS_NOT_ALLOWED',
  );
});
it('rejects unsupported, corrupt, oversized and dimension-invalid images', async () => {
  await expect(processPhoto(Buffer.from('<svg/>'), rules)).rejects.toThrow(
    'FORMAT_NOT_ALLOWED',
  );
  await expect(
    processPhoto(Buffer.from([255, 216, 255, 0, 1]), rules),
  ).rejects.toThrow('UNREADABLE_IMAGE');
  const bytes = await image().png().toBuffer();
  await expect(processPhoto(bytes, { ...rules, maxBytes: 1 })).rejects.toThrow(
    'FILE_TOO_LARGE',
  );
  await expect(
    processPhoto(bytes, { ...rules, formats: ['jpeg'] }),
  ).rejects.toThrow('FORMAT_NOT_ALLOWED');
  await expect(
    processPhoto(bytes, { ...rules, maxLongEdge: 70 }),
  ).rejects.toThrow('DIMENSIONS_NOT_ALLOWED');
});
