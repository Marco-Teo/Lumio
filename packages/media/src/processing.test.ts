import { expect, it } from 'vitest';
import sharp from 'sharp';
import { createJuryImage } from './jury-image';
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
it('removes EXIF/GPS, IPTC, XMP and ICC from previews while preserving the exact original bytes', async () => {
  const jpeg = await image()
    .jpeg()
    .withMetadata({
      exif: {
        IFD0: { Artist: 'Synthetic identity' },
        IFD3: {
          GPSLatitudeRef: 'N',
          GPSLatitude: '45/1 0/1 0/1',
          GPSLongitudeRef: 'E',
          GPSLongitude: '9/1 0/1 0/1',
        },
      },
    })
    .withXmp(
      '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" dc:creator="Synthetic identity"/></rdf:RDF></x:xmpmeta>',
    )
    .toBuffer();
  // Add a real JPEG Photoshop APP13/IPTC author block to the synthetic fixture.
  const author = Buffer.from('Synthetic IPTC identity');
  const record = Buffer.alloc(5);
  record.set([0x1c, 2, 80]);
  record.writeUInt16BE(author.length, 3);
  const iptc = Buffer.concat([record, author]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(iptc.length);
  const payload = Buffer.concat([
    Buffer.from('Photoshop 3.0\0' + '8BIM'),
    Buffer.from([4, 4, 0, 0]),
    size,
    iptc,
    ...(iptc.length % 2 ? [Buffer.from([0])] : []),
  ]);
  const header = Buffer.from([255, 237, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);
  const original = Buffer.concat([
    jpeg.subarray(0, 2),
    header,
    payload,
    jpeg.subarray(2),
  ]);
  const before = await sharp(original).metadata();
  expect(before.exif).toBeDefined();
  expect(before.exif!.includes(Buffer.from('Synthetic identity'))).toBe(true);
  const exif = before.exif!;
  const littleEndian = exif.toString('ascii', 6, 8) === 'II';
  const uint16 = (offset: number) =>
    littleEndian ? exif.readUInt16LE(offset) : exif.readUInt16BE(offset);
  const uint32 = (offset: number) =>
    littleEndian ? exif.readUInt32LE(offset) : exif.readUInt32BE(offset);
  const directory = (offset: number) =>
    Array.from(
      { length: uint16(offset) },
      (_, index) => offset + 2 + index * 12,
    );
  const gps = directory(6 + uint32(10)).find(
    (offset) => uint16(offset) === 0x8825,
  );
  expect(gps).toBeDefined();
  expect(directory(6 + uint32(gps! + 8)).map(uint16)).toEqual(
    expect.arrayContaining([1, 2, 3, 4]),
  );
  expect(before.iptc).toBeDefined();
  expect(before.iptc!.includes(author)).toBe(true);
  expect(before.xmp).toBeDefined();
  expect(before.xmp!.includes(Buffer.from('Synthetic identity'))).toBe(true);
  expect(before.icc).toBeDefined();
  const copy = Buffer.from(original);
  const jury = await createJuryImage(original);
  const juryMetadata = await sharp(jury.png).metadata();
  expect(juryMetadata.exif).toBeUndefined();
  expect(juryMetadata.icc).toBeUndefined();
  expect(juryMetadata.iptc).toBeUndefined();
  expect(juryMetadata.xmp).toBeUndefined();
  expect(jury.png.includes(author)).toBe(false);
  const result = await processPhoto(original, rules);
  const metadata = await sharp(result.preview).metadata();
  expect(metadata.format).toBe('webp');
  expect(metadata.exif).toBeUndefined();
  expect(metadata.icc).toBeUndefined();
  expect(metadata.iptc).toBeUndefined();
  expect(metadata.xmp).toBeUndefined();
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
