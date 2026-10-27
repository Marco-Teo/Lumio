import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { maxCoverBytes } from '../../lib/contest-cover';
import { AccessError } from '../authorization';
import { database } from '../database';
import { CompetitionError, manage, type CompetitionActor } from './index';

export async function normalizeCover(input: Uint8Array) {
  if (!input.length || input.length > maxCoverBytes)
    throw new CompetitionError(
      400,
      'Scegli un’immagine JPEG, PNG o WebP fino a 3 MB.',
    );
  const bytes = Buffer.from(input);
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    bytes.subarray(0, 4).toString() === 'RIFF' &&
    bytes.subarray(8, 12).toString() === 'WEBP';
  if (!jpeg && !png && !webp)
    throw new CompetitionError(
      400,
      'Formato non supportato. Usa JPEG, PNG o WebP; SVG e immagini animate non sono ammessi.',
    );
  try {
    const image = sharp(bytes, {
      limitInputPixels: 12000000,
      failOn: 'warning',
    }).timeout({ seconds: 3 });
    const metadata = await image.metadata();
    if (
      !['jpeg', 'png', 'webp'].includes(metadata.format) ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error('Unsupported image');
    const data = await image
      .autoOrient()
      .resize({
        width: 1200,
        height: 800,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 78 })
      .toBuffer();
    if (data.length > 1048576) throw new Error('Cover too large');
    return { data, version: createHash('sha256').update(data).digest('hex') };
  } catch {
    throw new CompetitionError(
      400,
      'L’immagine non è leggibile o supera 12 megapixel. Scegli un JPEG, PNG o WebP statico più piccolo.',
    );
  }
}
export async function saveContestCover(
  actor: CompetitionActor,
  organizationId: string,
  contestId: string,
  input: Uint8Array | null,
) {
  // Authorize before decoding; recheck within the mutation transaction too.
  await manage(actor, organizationId, async (tx) => {
    if (
      !(await tx.contest.findFirst({
        where: { id: contestId, organizationId },
        select: { id: true },
      }))
    )
      throw new AccessError(404);
  });
  const cover = input ? await normalizeCover(input) : null;
  return manage(actor, organizationId, async (tx, membershipId) => {
    await tx.$queryRaw`SELECT id FROM contest WHERE id=${contestId} AND "organizationId"=${organizationId} FOR UPDATE`;
    const before = await tx.contest.findFirst({
      where: { id: contestId, organizationId },
      select: { id: true, coverVersion: true },
    });
    if (!before) throw new AccessError(404);
    const updated = await tx.contest.update({
      where: { id: contestId },
      data: {
        coverData: cover?.data ?? null,
        coverVersion: cover?.version ?? null,
      },
      select: { coverVersion: true },
    });
    await tx.auditEvent.create({
      data: {
        organizationId,
        actorUserId: actor.id,
        actorMembershipId: membershipId,
        action: cover ? 'contest.cover_updated' : 'contest.cover_removed',
        entityId: contestId,
        before: { coverVersion: before.coverVersion },
        after: { coverVersion: updated.coverVersion },
      },
    });
    return updated;
  });
}
export async function administrativeCover(
  actor: CompetitionActor,
  organizationId: string,
  contestId: string,
) {
  return manage(actor, organizationId, async (tx) => {
    const cover = await tx.contest.findFirst({
      where: { id: contestId, organizationId },
      select: { coverData: true, coverVersion: true },
    });
    if (!cover?.coverData || !cover.coverVersion) throw new AccessError(404);
    return { data: cover.coverData, version: cover.coverVersion };
  });
}
export async function visibleCover(contestId: string, userId?: string) {
  return database().$transaction(async (tx) => {
    if (userId)
      await tx.$executeRaw`SELECT set_config('app.user_id',${userId},true)`;
    const [cover] = await tx.$queryRaw<
      Array<{ data: Uint8Array; version: string }>
    >`SELECT * FROM visible_contest_cover(${contestId})`;
    if (!cover) throw new AccessError(404);
    return cover;
  });
}
export function coverResponse(
  cover: { data: Uint8Array; version: string },
  request: Request,
) {
  const headers = {
    'Content-Type': 'image/webp',
    'Cache-Control': 'private, max-age=300',
    ETag: `"${cover.version}"`,
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Cookie',
  };
  if (request.headers.get('if-none-match') === headers.ETag)
    return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(cover.data), { headers });
}
export async function coverUpload(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.startsWith('multipart/form-data;'))
    throw new CompetitionError(400, 'Seleziona un file immagine da caricare.');
  const maximum = maxCoverBytes + 65536;
  if (Number(request.headers.get('content-length') ?? 0) > maximum)
    throw new CompetitionError(400, 'L’immagine non può superare 3 MB.');
  const reader = request.body?.getReader();
  if (!reader) throw new CompetitionError(400, 'Seleziona un’immagine.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new CompetitionError(400, 'L’immagine non può superare 3 MB.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const form = await new Response(new Uint8Array(Buffer.concat(chunks)), {
    headers: { 'Content-Type': contentType },
  }).formData();
  const file = form.get('file');
  if (!(file instanceof File) || form.getAll('file').length !== 1)
    throw new CompetitionError(400, 'Seleziona una sola immagine.');
  if (file.size > maxCoverBytes)
    throw new CompetitionError(400, 'L’immagine non può superare 3 MB.');
  return new Uint8Array(await file.arrayBuffer());
}
