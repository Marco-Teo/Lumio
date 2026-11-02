import { createHash } from 'node:crypto';
import type { Prisma } from '@lumio/database';
import {
  imageRulesSchema,
  processPhoto,
  InvalidPhoto,
} from '@lumio/media/processing';
import { readMedia, mediaKey, writeImmutable } from '@lumio/media/storage';

export async function processPhotoEvent(
  tx: Prisma.TransactionClient,
  organizationId: string,
  revisionId: string,
) {
  await tx.$executeRaw`SELECT set_config('app.organization_id',${organizationId},true)`;
  await tx.$executeRaw`SELECT set_config('app.photo_revision_id',${revisionId},true)`;
  const revision = await tx.photoRevision.findUnique({
    where: { id: revisionId },
    include: { processing: true },
  });
  if (
    !revision ||
    revision.organizationId !== organizationId ||
    !revision.processing
  )
    throw new Error('INVALID_MEDIA_EVENT');
  if (revision.processing.status !== 'pending') return;
  const bytes = await readMedia(revision.storageKey);
  if (
    bytes.length !== revision.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== revision.sha256
  )
    throw new Error('ORIGINAL_INTEGRITY_FAILED');
  try {
    const result = await processPhoto(
      bytes,
      imageRulesSchema.parse(revision.rules),
    );
    const previewKey = mediaKey(organizationId, revisionId, 'preview');
    await writeImmutable(previewKey, result.preview);
    await tx.photoProcessing.update({
      where: { revisionId },
      data: {
        status: 'ready',
        previewKey,
        width: result.width,
        height: result.height,
        format: result.format,
        errorCode: null,
      },
    });
  } catch (error) {
    if (!(error instanceof InvalidPhoto)) throw error;
    await tx.photoProcessing.update({
      where: { revisionId },
      data: { status: 'rejected', errorCode: error.code },
    });
  }
}
