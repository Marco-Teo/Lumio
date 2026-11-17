import sharp from 'sharp';
import { maxPhotoBytes, maxPhotoPixels } from './limits';
import { originalFormat } from './processing';

export const juryImageRecipe = 'jury-png-srgb-v1' as const;

export class InvalidJuryImage extends Error {
  constructor(
    public readonly code:
      | 'FILE_TOO_LARGE'
      | 'FORMAT_NOT_ALLOWED'
      | 'UNSUPPORTED_IMAGE'
      | 'UNREADABLE_IMAGE',
  ) {
    super(code);
  }
}

// Rendering only: the future caller must authorize a frozen, validated revision.
// This function neither checks FIAF eligibility nor grants access to the result.
export async function createJuryImage(bytes: Uint8Array) {
  if (bytes.byteLength > maxPhotoBytes)
    throw new InvalidJuryImage('FILE_TOO_LARGE');
  if (!originalFormat(bytes)) throw new InvalidJuryImage('FORMAT_NOT_ALLOWED');
  try {
    const image = sharp(bytes, {
      limitInputPixels: maxPhotoPixels,
      failOn: 'warning',
    }).timeout({ seconds: 8 });
    let warned = false;
    image.on('warning', () => {
      warned = true;
    });
    const metadata = await image.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      (metadata.pages ?? 1) !== 1 ||
      metadata.gainMap !== undefined ||
      !['uchar', 'ushort'].includes(metadata.depth) ||
      !['srgb', 'rgb', 'rgb16', 'b-w', 'grey16', 'cmyk'].includes(
        metadata.space,
      )
    )
      throw new InvalidJuryImage('UNSUPPORTED_IMAGE');
    const bitDepth = metadata.depth === 'ushort' ? 16 : 8;
    // Let libvips interpret the source profile before converting to output RGB.
    // rgb16 requests 16-bit PNG output, without forcing input into sRGB early.
    const colourspace = bitDepth === 16 ? 'rgb16' : 'srgb';
    image.autoOrient();
    // Untagged RGB is assumed sRGB. Sharp's explicit ICC output transform
    // otherwise treats untagged RGB16 as P3, altering already-sRGB samples.
    // CMYK still needs the codec's default input profile when none is embedded.
    if (metadata.icc || metadata.space === 'cmyk')
      image.withIccProfile('srgb', { attach: false });
    const { data, info } = await image
      .toColourspace(colourspace)
      .png({ palette: false, compressionLevel: 6 })
      .toBuffer({ resolveWithObject: true });
    if (warned) throw new InvalidJuryImage('UNREADABLE_IMAGE');
    return {
      png: data,
      width: info.width,
      height: info.height,
      bitDepth,
      recipe: juryImageRecipe,
    } as const;
  } catch (error) {
    if (error instanceof InvalidJuryImage) throw error;
    throw new InvalidJuryImage('UNREADABLE_IMAGE');
  }
}
