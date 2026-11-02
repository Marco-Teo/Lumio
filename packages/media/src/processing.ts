import sharp from 'sharp';
import { z } from 'zod';
export const imageRulesSchema = z
  .object({
    formats: z.array(z.enum(['jpeg', 'png', 'tiff'])),
    maxBytes: z.number().positive(),
    minWidth: z.number().nullable(),
    minHeight: z.number().nullable(),
    maxLongEdge: z.number().nullable(),
    maxShortEdge: z.number().nullable(),
    colorProfile: z.enum(['any', 'srgb']),
  })
  .strict();
export type ImageRules = z.infer<typeof imageRulesSchema>;
export class InvalidPhoto extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function originalFormat(
  bytes: Uint8Array,
): 'jpeg' | 'png' | 'tiff' | null {
  const b = Buffer.from(bytes);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'png';
  if (
    b.subarray(0, 4).equals(Buffer.from([73, 73, 42, 0])) ||
    b.subarray(0, 4).equals(Buffer.from([77, 77, 0, 42]))
  )
    return 'tiff';
  return null;
}
export async function processPhoto(bytes: Uint8Array, rules: ImageRules) {
  const format = originalFormat(bytes);
  if (!format || !rules.formats.includes(format))
    throw new InvalidPhoto('FORMAT_NOT_ALLOWED');
  if (bytes.byteLength > rules.maxBytes)
    throw new InvalidPhoto('FILE_TOO_LARGE');
  try {
    const image = sharp(bytes, {
      limitInputPixels: 40000000,
      failOn: 'warning',
    }).timeout({ seconds: 8 });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1)
      throw new InvalidPhoto('UNREADABLE_IMAGE');
    const swapped = metadata.orientation && metadata.orientation >= 5;
    const width = swapped ? metadata.height : metadata.width,
      height = swapped ? metadata.width : metadata.height;
    if (
      (rules.minWidth && width < rules.minWidth) ||
      (rules.minHeight && height < rules.minHeight) ||
      (rules.maxLongEdge && Math.max(width, height) > rules.maxLongEdge) ||
      (rules.maxShortEdge && Math.min(width, height) > rules.maxShortEdge)
    )
      throw new InvalidPhoto('DIMENSIONS_NOT_ALLOWED');
    // Embedded profiles are conservatively accepted only when explicitly sRGB;
    // untagged RGB is conventional sRGB. No author/GPS/EXIF is persisted here.
    if (
      rules.colorProfile === 'srgb' &&
      ((metadata.space !== 'srgb' && metadata.space !== 'rgb') ||
        (metadata.icc &&
          !metadata.icc.toString('latin1').toLowerCase().includes('srgb')))
    )
      throw new InvalidPhoto('COLOR_PROFILE_NOT_ALLOWED');
    const preview = await image
      .autoOrient()
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toColourspace('srgb')
      .webp({ quality: 82 })
      .toBuffer();
    return { preview, width, height, format };
  } catch (error) {
    if (error instanceof InvalidPhoto) throw error;
    // Decoder failures never leak filenames, metadata or decoder internals.
    throw new InvalidPhoto('UNREADABLE_IMAGE');
  }
}
