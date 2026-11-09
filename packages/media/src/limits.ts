// Browser-safe limits; keep PostgreSQL photo_revision checks aligned.
export const maxPhotoBytes = 25 * 1024 * 1024;
export const maxPhotoPixels = 40_000_000;
export const bytesPerMiB = 1024 * 1024;
export function effectivePhotoBytes(configured: number) {
  return Math.min(configured, maxPhotoBytes);
}
// A byte / 2^20 has an exact terminating decimal with at most 20 places.
export function photoMiBValue(bytes: number) {
  return (bytes / bytesPerMiB).toFixed(20).replace(/\.?0+$/, '');
}
export function photoSizeLabel(bytes: number) {
  return photoMiBValue(bytes) + ' MiB';
}
// Parse decimal input as a rational number: never round fractions of a byte.
export function photoBytesFromMiB(input: string): number | null {
  const value = input.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(value) || value.length > 64) return null;
  const [whole, fraction = ''] = value.split('.');
  const scale = 10n ** BigInt(fraction.length);
  const numerator = BigInt(whole + fraction) * BigInt(bytesPerMiB);
  if (numerator % scale !== 0n) return null;
  const bytes = numerator / scale;
  return bytes <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(bytes) : null;
}
