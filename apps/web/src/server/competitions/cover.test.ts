import { expect, it } from 'vitest';
import sharp from 'sharp';
import { normalizeCover, coverUpload, coverResponse } from './cover';
import { maxCoverBytes } from '../../lib/contest-cover';
it('normalizes the cover, bounds its dimensions and removes embedded metadata', async () => {
  const image = await sharp({
    create: { width: 1800, height: 1000, channels: 3, background: '#789e87' },
  })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Artist: 'Synthetic test author' } } })
    .toBuffer();
  const normalized = await normalizeCover(image),
    metadata = await sharp(normalized.data).metadata();
  expect(metadata.format).toBe('webp');
  expect(metadata.width).toBeLessThanOrEqual(1200);
  expect(metadata.height).toBeLessThanOrEqual(800);
  expect(metadata.exif).toBeUndefined();
  expect(metadata.icc).toBeUndefined();
  expect(normalized.version).toMatch(/^[a-f0-9]{64}$/);
});
it('rejects SVGs, damaged images and oversized files', async () => {
  await expect(
    normalizeCover(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
  ).rejects.toThrow('Formato non supportato');
  await expect(
    normalizeCover(Buffer.from([0xff, 0xd8, 0xff, 0x00])),
  ).rejects.toThrow('non è leggibile');
  await expect(
    normalizeCover(new Uint8Array(maxCoverBytes + 1)),
  ).rejects.toThrow('3 MB');
});
it('rejects images above the decoded pixel budget', async () => {
  const image = await sharp({
    create: { width: 4001, height: 3000, channels: 3, background: '#fff' },
  })
    .png()
    .toBuffer();
  await expect(normalizeCover(image)).rejects.toThrow('12 megapixel');
});
it('rejects an oversized upload before parsing its multipart body', async () => {
  await expect(
    coverUpload(
      new Request('http://127.0.0.1/upload', {
        method: 'PUT',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=test',
          'Content-Length': String(maxCoverBytes + 100000),
        },
        body: 'synthetic',
      }),
    ),
  ).rejects.toThrow('3 MB');
});
it('serves a private conditional response without allowing MIME sniffing', () => {
  const cover = { data: new Uint8Array([1, 2, 3]), version: 'a'.repeat(64) };
  const response = coverResponse(cover, new Request('http://127.0.0.1/cover'));
  expect(response.headers.get('content-type')).toBe('image/webp');
  expect(response.headers.get('cache-control')).toContain('private');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(
    coverResponse(
      cover,
      new Request('http://127.0.0.1/cover', {
        headers: { 'If-None-Match': `"${cover.version}"` },
      }),
    ).status,
  ).toBe(304);
});
