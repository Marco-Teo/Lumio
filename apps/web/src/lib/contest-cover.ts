export const maxCoverBytes = 3 * 1024 * 1024;
export const coverAccept = 'image/jpeg,image/png,image/webp';
export function contestCoverUrl(
  contestId: string,
  version: string | null | undefined,
) {
  return version
    ? `/api/contests/${encodeURIComponent(contestId)}/cover?v=${encodeURIComponent(version)}`
    : null;
}
