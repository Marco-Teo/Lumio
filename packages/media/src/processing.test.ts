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
it('checks exact long edge without resizing originals and preserves legacy processing', async () => {
  for (const [width, height] of [
    [2500, 1200],
    [1200, 2500],
    [2499, 1200],
    [2501, 1200],
  ]) {
    const original = await sharp({
      create: { width, height, channels: 3, background: '#c89946' },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: 'Synthetic author' } } })
      .toBuffer();
    const copy = Buffer.from(original);
    const exact = {
      ...rules,
      validationVersion: 1 as const,
      exactLongEdge: 2500,
      colorProfile: 'srgb' as const,
    };
    if (Math.max(width, height) === 2500) {
      const result = await processPhoto(original, exact);
      expect([result.width, result.height]).toEqual([width, height]);
      expect(
        (await sharp(result.preview).metadata()).width,
      ).toBeLessThanOrEqual(1600);
    } else
      await expect(processPhoto(original, exact)).rejects.toThrow(
        'DIMENSIONS_NOT_ALLOWED',
      );
    await expect(processPhoto(original, rules)).resolves.toMatchObject({
      width,
      height,
    });
    expect(original).toEqual(copy);
  }
});
it('recognizes Unicode sRGB descriptions only in the new validation version and rejects a different profile', async () => {
  const srgb = await image().jpeg().withMetadata().toBuffer();
  await expect(
    processPhoto(srgb, {
      ...rules,
      colorProfile: 'srgb',
      validationVersion: 1,
    }),
  ).resolves.toMatchObject({ format: 'jpeg' });
  await expect(
    processPhoto(srgb, { ...rules, colorProfile: 'srgb' }),
  ).rejects.toThrow('COLOR_PROFILE_NOT_ALLOWED');
  const p3 = await image().jpeg().withIccProfile('p3').toBuffer();
  await expect(
    processPhoto(p3, { ...rules, colorProfile: 'srgb', validationVersion: 1 }),
  ).rejects.toThrow('COLOR_PROFILE_NOT_ALLOWED');
  const untagged = await image().jpeg().toBuffer();
  await expect(
    processPhoto(untagged, {
      ...rules,
      colorProfile: 'srgb',
      validationVersion: 1,
    }),
  ).resolves.toMatchObject({ format: 'jpeg' });
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
