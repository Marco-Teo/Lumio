import {
  anonymousWorkSchema,
  type AnonymousWork,
} from '../../lib/anonymous-work';

/** Data minimization, NOT authorization or release eligibility.
 * Never pass an ORM record straight to a future jury response.
 * The caller must first authorize the edition and select its frozen release.
 * This foundation is intentionally not connected to an endpoint or DB query.
 */
export function projectAnonymousWork(source: {
  readonly anonymousCode: string;
  readonly photos: readonly { readonly position: number }[];
}): AnonymousWork {
  return anonymousWorkSchema.parse({
    code: source.anonymousCode,
    photos: source.photos.map((photo) => ({ position: photo.position })),
  });
}
