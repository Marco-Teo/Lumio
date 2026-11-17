// Run each case in a fresh process. Synthetic fixtures only; no storage access.
import sharp from 'sharp';
import { createJuryImage } from './jury-image';

const scenario = process.argv[2] ?? '8';
if (!['8', '16', '40mp', '40mp16', 'noise'].includes(scenario))
  throw new Error('Expected 8, 16, 40mp, 40mp16 or noise');
const large = ['40mp', '40mp16', 'noise'].includes(scenario);
const sixteen = ['16', '40mp16'].includes(scenario);
const width = large ? 8000 : 2500;
const height = large ? 5000 : 1667;
let fixture = sharp({
  create: { width, height, channels: 3, background: '#7491ab' },
});
if (scenario === 'noise') {
  const pixels = Buffer.alloc(width * height * 3);
  let state = 123456789;
  for (let index = 0; index < pixels.length; index++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    pixels[index] = state & 255;
  }
  fixture = sharp(pixels, { raw: { width, height, channels: 3 } });
}
const source =
  scenario === 'noise'
    ? await fixture.jpeg({ quality: 60 }).toBuffer()
    : await fixture
        .toColourspace(sixteen ? 'rgb16' : 'srgb')
        .png()
        .toBuffer();
const started = performance.now();
const result = await createJuryImage(source);
console.log(
  JSON.stringify({
    scenario,
    width,
    height,
    bitDepth: result.bitDepth,
    inputBytes: source.length,
    outputBytes: result.png.length,
    renderMilliseconds: Math.round(performance.now() - started),
    // Whole-process high-water mark, including fixture creation and native memory.
    processPeakRssKiB: process.resourceUsage().maxRSS,
    sharp: sharp.versions,
  }),
);
