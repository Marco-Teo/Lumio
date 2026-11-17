import sharp from 'sharp';
import { crc32 } from 'node:zlib';
import { expect, it } from 'vitest';
import { createJuryImage, juryImageRecipe } from './jury-image';
import { maxPhotoBytes } from './limits';

const image = () =>
  sharp({
    create: { width: 80, height: 60, channels: 3, background: '#7491ab' },
  });

it.each(['jpeg', 'png', 'tiff'] as const)(
  'renders %s at full resolution without changing the source',
  async (format) => {
    const original = await image().toFormat(format).toBuffer();
    const copy = Buffer.from(original);
    const result = await createJuryImage(original);
    const metadata = await sharp(result.png).metadata();
    expect(result).toMatchObject({
      width: 80,
      height: 60,
      bitDepth: 8,
      recipe: juryImageRecipe,
    });
    expect(metadata).toMatchObject({
      format: 'png',
      width: 80,
      height: 60,
      space: 'srgb',
      depth: 'uchar',
    });
    expect(original).toEqual(copy);
  },
);

it('preserves sRGB pixels without lossy encoding', async () => {
  const source = await image().png().toBuffer();
  const result = await createJuryImage(source);
  expect(await sharp(result.png).raw().toBuffer()).toEqual(
    await sharp(source).raw().toBuffer(),
  );
});

it('preserves untagged sRGB 16-bit colour values, not merely output depth', async () => {
  const source = await image().toColourspace('rgb16').png().toBuffer();
  const result = await createJuryImage(source);
  const raw = (bytes: Buffer) =>
    sharp(bytes).toColourspace('rgb16').raw({ depth: 'ushort' }).toBuffer();
  expect((await raw(result.png)).equals(await raw(source))).toBe(true);
});

it.each(['png', 'tiff'] as const)(
  'preserves 16-bit %s precision rather than quantizing to 8 bits',
  async (format) => {
    const pixels = new Uint16Array([1000, 1001, 1002, 1003, 1004, 1005]);
    const source = await sharp(pixels, {
      raw: { width: 2, height: 1, channels: 3 },
    })
      .toColourspace('rgb16')
      .toFormat(format, format === 'tiff' ? { compression: 'none' } : {})
      .toBuffer();
    expect((await sharp(source).metadata()).depth).toBe('ushort');
    const result = await createJuryImage(source);
    expect(result.bitDepth).toBe(16);
    expect((await sharp(result.png).metadata()).depth).toBe('ushort');
    const raw = await sharp(result.png)
      .toColourspace('rgb16')
      .raw({ depth: 'ushort' })
      .toBuffer();
    expect(raw.readUInt16LE(0) % 257).not.toBe(0);
    expect(raw.readUInt16LE(0)).not.toBe(raw.readUInt16LE(2));
  },
);

it('converts CMYK through the colour-management path', async () => {
  const source = await image()
    .toColourspace('cmyk')
    .tiff({ compression: 'none' })
    .toBuffer();
  expect((await sharp(source).metadata()).space).toBe('cmyk');
  const result = await createJuryImage(source);
  const expected = await sharp(source)
    .withIccProfile('srgb', { attach: false })
    .raw()
    .toBuffer();
  expect(await sharp(result.png).raw().toBuffer()).toEqual(expected);
});

it('applies orientation without resizing or retaining EXIF', async () => {
  const source = await image()
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const result = await createJuryImage(source);
  expect([result.width, result.height]).toEqual([60, 80]);
  expect((await sharp(result.png).metadata()).exif).toBeUndefined();
});

it.each([1, 2, 3, 4, 5, 6, 7, 8])(
  'applies orientation %i to the actual pixels',
  async (orientation) => {
    const pixels = Buffer.from([
      255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0, 255, 0, 255, 0, 255, 255,
    ]);
    const source = await sharp(pixels, {
      raw: { width: 3, height: 2, channels: 3 },
    })
      .png()
      .withMetadata({ orientation })
      .toBuffer();
    const result = await createJuryImage(source);
    const expected = await sharp(source)
      .autoOrient()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([result.width, result.height]).toEqual([
      expected.info.width,
      expected.info.height,
    ]);
    expect(
      (await sharp(result.png).raw().toBuffer()).equals(expected.data),
    ).toBe(true);
  },
);

it('strips arbitrary PNG text chunks as well as known EXIF fields', async () => {
  const png = await image().png().toBuffer();
  const text = Buffer.from('Author\0Private synthetic identity');
  const header = Buffer.alloc(8);
  header.writeUInt32BE(text.length);
  header.write('tEXt', 4, 'ascii');
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), text])));
  const source = Buffer.concat([
    png.subarray(0, 33),
    header,
    text,
    checksum,
    png.subarray(33),
  ]);
  const copy = Buffer.from(source);
  expect(source.includes(text)).toBe(true);
  const result = await createJuryImage(source);
  const chunks: string[] = [];
  for (let offset = 8; offset < result.png.length;) {
    chunks.push(result.png.toString('ascii', offset + 4, offset + 8));
    offset += 12 + result.png.readUInt32BE(offset);
  }
  expect(
    chunks.every((chunk) =>
      ['IHDR', 'IDAT', 'IEND', 'pHYs', 'sRGB', 'cHRM', 'gAMA'].includes(chunk),
    ),
  ).toBe(true);
  expect(result.png.includes(text)).toBe(false);
  expect(source.equals(copy)).toBe(true);
});

it('rejects a corrupt ICC profile rather than claiming successful normalization', async () => {
  const source = await image().withIccProfile('srgb').jpeg().toBuffer();
  const icc = (await sharp(source).metadata()).icc!;
  const offset = source.indexOf(icc);
  expect(offset).toBeGreaterThan(0);
  source.fill(0, offset, offset + icc.length);
  await expect(createJuryImage(source)).rejects.toThrow('UNREADABLE_IMAGE');
});

it('normalizes an embedded P3 profile without copying its metadata', async () => {
  const source = await image().withIccProfile('p3').png().toBuffer();
  expect((await sharp(source).metadata()).icc).toBeDefined();
  const result = await createJuryImage(source);
  expect((await sharp(result.png).metadata()).icc).toBeUndefined();
  const expected = await sharp(source)
    .withIccProfile('srgb', { attach: false })
    .raw()
    .toBuffer();
  expect(await sharp(result.png).raw().toBuffer()).toEqual(expected);
});

it('preserves transparency', async () => {
  const source = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: { r: 10, g: 20, b: 30, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  const result = await createJuryImage(source);
  expect((await sharp(result.png).metadata()).hasAlpha).toBe(true);
  expect(await sharp(result.png).raw().toBuffer()).toEqual(
    await sharp(source).raw().toBuffer(),
  );
});

it('rejects multi-page TIFF instead of silently selecting one page', async () => {
  const source = await sharp(Buffer.alloc(2 * 4 * 3, 100), {
    raw: { width: 2, height: 4, channels: 3, pageHeight: 2 },
  })
    .tiff({ compression: 'none' })
    .toBuffer();
  expect((await sharp(source).metadata()).pages).toBe(2);
  await expect(createJuryImage(source)).rejects.toThrow('UNSUPPORTED_IMAGE');
});

it('rejects floating-point TIFF rather than silently reducing its precision', async () => {
  const source = await image()
    .toColourspace('scrgb')
    .tiff({ compression: 'none' })
    .toBuffer();
  expect((await sharp(source).metadata()).depth).toBe('float');
  await expect(createJuryImage(source)).rejects.toThrow('UNSUPPORTED_IMAGE');
});

it('rejects oversized, unsupported, corrupt and over-pixel-limit input', async () => {
  await expect(
    createJuryImage(Buffer.alloc(maxPhotoBytes + 1)),
  ).rejects.toThrow('FILE_TOO_LARGE');
  await expect(createJuryImage(Buffer.from('<svg/>'))).rejects.toThrow(
    'FORMAT_NOT_ALLOWED',
  );
  await expect(
    createJuryImage(Buffer.from([255, 216, 255, 0])),
  ).rejects.toThrow('UNREADABLE_IMAGE');
  const huge = await sharp({
    create: { width: 8000, height: 5001, channels: 3, background: 'black' },
  })
    .png()
    .toBuffer();
  await expect(createJuryImage(huge)).rejects.toThrow('UNREADABLE_IMAGE');
});
