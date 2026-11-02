import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@lumio/database';
import {
  maxPhotoBytes,
  mediaKey,
  readMedia,
  writeImmutable,
} from '@lumio/media/storage';
import { originalFormat } from '@lumio/media/processing';
import { database } from '../database';
import { ownRegistration, type ParticipantActor } from '../participants';
import { AccessError } from '../authorization';
import { CompetitionError } from '../competitions';
import { editionSchema } from '../../lib/competitions';

const revisionSelect = {
  id: true,
  number: true,
  sha256: true,
  bytes: true,
  createdAt: true,
  processing: {
    select: {
      status: true,
      errorCode: true,
      width: true,
      height: true,
      format: true,
    },
  },
} as const;
async function scope<T>(
  actor: ParticipantActor,
  registrationId: string,
  write: boolean,
  action: (
    tx: Prisma.TransactionClient,
    registration: Awaited<ReturnType<typeof ownRegistration>>,
  ) => Promise<T>,
) {
  if (!actor.emailVerified)
    throw new AccessError(403, 'Verifica la tua email.');
  return database().$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.user_id',${actor.id},true)`;
      const registration = await ownRegistration(tx, registrationId);
      if (write) {
        const [locked] = await tx.$queryRaw<
          { open: boolean }[]
        >`SELECT lock_registration_window(${registration.organizationId},${registration.editionId},${registration.editionVersion}) AS open`;
        if (!locked.open)
          throw new CompetitionError(
            409,
            'Le iscrizioni sono chiuse: le opere non sono più modificabili.',
          );
        await tx.$queryRaw`SELECT id FROM registration WHERE id=${registrationId} FOR UPDATE`;
      }
      return action(tx, registration);
    },
    { timeout: 25000 },
  );
}
async function log(
  tx: Prisma.TransactionClient,
  actor: ParticipantActor,
  registration: { id: string; organizationId: string },
  action: string,
  after: Prisma.InputJsonObject,
) {
  await tx.registrationEvent.create({
    data: {
      organizationId: registration.organizationId,
      registrationId: registration.id,
      actorUserId: actor.id,
      action,
      before: {},
      after,
    },
  });
}
export async function listEntries(
  actor: ParticipantActor,
  registrationId: string,
) {
  return scope(actor, registrationId, false, (tx) =>
    tx.entry.findMany({
      where: { registrationId, active: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        sectionCode: true,
        title: true,
        version: true,
        photos: {
          where: { active: true },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            position: true,
            title: true,
            currentRevision: true,
            revisions: { orderBy: { number: 'desc' }, select: revisionSelect },
          },
        },
      },
    }),
  );
}
export async function createEntry(
  actor: ParticipantActor,
  registrationId: string,
  input: unknown,
) {
  const data = z
    .object({
      id: z.uuid().optional(),
      title: z
        .string()
        .trim()
        .min(1, 'Inserisci il titolo dell’opera.')
        .max(200),
      sectionCode: z.string().min(1).max(20),
    })
    .strict()
    .parse(input);
  return scope(actor, registrationId, true, async (tx, registration) => {
    const config = editionSchema.parse(registration.configurationSnapshot);
    if (!config.sections.some((section) => section.code === data.sectionCode))
      throw new CompetitionError(400, 'Scegli una sezione dell’edizione.');
    if (data.id) {
      const existing = await tx.entry.findFirst({
        where: { id: data.id, registrationId },
      });
      if (existing) {
        if (!existing.active || existing.sectionCode !== data.sectionCode)
          throw new CompetitionError(
            409,
            'Identificativo opera già utilizzato.',
          );
        return { id: existing.id };
      }
    }
    if ((await tx.entry.count({ where: { registrationId } })) >= 100)
      throw new CompetitionError(
        400,
        'Hai raggiunto il limite di 100 opere per iscrizione.',
      );
    const entry = await tx.entry.create({
      data: {
        ...data,
        organizationId: registration.organizationId,
        registrationId,
      },
    });
    await log(tx, actor, registration, 'entry.created', {
      entryId: entry.id,
      sectionCode: entry.sectionCode,
    });
    return { id: entry.id };
  });
}
export async function updateEntry(
  actor: ParticipantActor,
  registrationId: string,
  entryId: string,
  input: unknown,
) {
  const data = z
    .object({
      title: z.string().trim().min(1).max(200),
      version: z.number().int().positive(),
      active: z.boolean(),
    })
    .strict()
    .parse(input);
  return scope(actor, registrationId, true, async (tx, registration) => {
    const changed = await tx.entry.updateMany({
      where: {
        id: entryId,
        registrationId,
        version: data.version,
        active: true,
      },
      data: {
        title: data.title,
        active: data.active,
        version: { increment: 1 },
      },
    });
    if (!changed.count)
      throw new CompetitionError(
        409,
        'L’opera è cambiata. Ricarica la pagina.',
      );
    await log(
      tx,
      actor,
      registration,
      data.active ? 'entry.updated' : 'entry.removed',
      { entryId },
    );
  });
}
export async function uploadPhoto(
  actor: ParticipantActor,
  registrationId: string,
  entryId: string,
  position: number,
  revisionId: string,
  bytes: Uint8Array,
  inputTitle?: string,
) {
  const title =
    inputTitle === undefined
      ? undefined
      : z.string().trim().max(200).parse(inputTitle) || null;
  z.uuid().parse(revisionId);
  z.number().int().min(1).max(100).parse(position);
  if (!bytes.length || bytes.length > maxPhotoBytes)
    throw new CompetitionError(
      400,
      'Carica un’immagine non vuota di massimo 25 MB.',
    );
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return scope(actor, registrationId, true, async (tx, registration) => {
    const entry = await tx.entry.findFirst({
      where: { id: entryId, registrationId, active: true },
    });
    if (!entry) throw new AccessError(404);
    const config = editionSchema.parse(registration.configurationSnapshot);
    const section = config.sections.find(
      (row) => row.code === entry.sectionCode,
    );
    if (!section || position > section.maxImages)
      throw new CompetitionError(
        400,
        'La posizione supera il numero di fotografie consentito per questa opera.',
      );
    const format = originalFormat(bytes);
    if (!format || !config.imageRules.formats.includes(format))
      throw new CompetitionError(
        400,
        `Formato non consentito. Usa: ${config.imageRules.formats.join(', ')}.`,
      );
    if (bytes.length > config.imageRules.maxBytes)
      throw new CompetitionError(
        400,
        'Il file supera la dimensione massima prevista dal regolamento.',
      );
    const previous = await tx.photoRevision.findUnique({
      where: { id: revisionId },
      select: {
        ...revisionSelect,
        photo: { select: { entryId: true, position: true } },
      },
    });
    if (previous) {
      if (
        previous.sha256 !== sha256 ||
        previous.photo.entryId !== entryId ||
        previous.photo.position !== position
      )
        throw new CompetitionError(
          409,
          'Identificativo caricamento già utilizzato.',
        );
      return previous;
    }
    const total = await tx.photoRevision.aggregate({
      where: { registrationId },
      _sum: { bytes: true },
    });
    if ((total._sum.bytes ?? 0) + bytes.length > 1024 * 1024 * 1024)
      throw new CompetitionError(
        400,
        'Raggiunto il limite di 1 GB di originali e revisioni per iscrizione.',
      );
    let photo = await tx.photo.findUnique({
      where: { entryId_position: { entryId, position } },
    });
    if (!photo)
      photo = await tx.photo.create({
        data: {
          organizationId: registration.organizationId,
          registrationId,
          entryId,
          position,
        },
      });
    if (photo.currentRevision >= 20)
      throw new CompetitionError(
        400,
        'Raggiunto il limite di 20 revisioni per questa fotografia.',
      );
    const number = photo.currentRevision + 1;
    const storageKey = mediaKey(
      registration.organizationId,
      revisionId,
      'original',
    );
    // Create-only storage also permits retrying the same bytes after a DB rollback.
    await writeImmutable(storageKey, bytes);
    await tx.photo.update({
      where: { id: photo.id },
      data: {
        currentRevision: number,
        active: true,
        ...(title !== undefined ? { title } : {}),
      },
    });
    const revision = await tx.photoRevision.create({
      data: {
        id: revisionId,
        organizationId: registration.organizationId,
        registrationId,
        photoId: photo.id,
        number,
        storageKey,
        sha256,
        bytes: bytes.length,
        rules: config.imageRules,
      },
    });
    await tx.photoProcessing.create({
      data: {
        revisionId,
        organizationId: registration.organizationId,
        registrationId,
      },
    });
    // No RETURNING: participants can enqueue their media job, without gaining
    // read access to operational outbox rows or delivery payloads.
    await tx.$executeRaw`INSERT INTO outbox_event(id,"organizationId","photoRevisionId",type,payload) VALUES (${randomUUID()},${registration.organizationId},${revisionId},'photo.process',jsonb_build_object('revisionId',${revisionId}::text))`;
    await log(tx, actor, registration, 'photo.uploaded', {
      entryId,
      photoId: photo.id,
      revisionId,
      number,
      sha256,
    });
    return { id: revision.id, number };
  });
}
export async function renamePhoto(
  actor: ParticipantActor,
  registrationId: string,
  entryId: string,
  position: number,
  input: unknown,
) {
  const data = z
    .object({ title: z.string().trim().max(200).nullable() })
    .strict()
    .parse(input);
  return scope(actor, registrationId, true, async (tx, registration) => {
    const photo = await tx.photo.findFirst({
      where: {
        registrationId,
        entryId,
        position,
        active: true,
        entry: { active: true },
      },
    });
    if (!photo) throw new AccessError(404);
    await tx.photo.update({
      where: { id: photo.id },
      data: { title: data.title || null },
    });
    await log(tx, actor, registration, 'photo.title_updated', {
      photoId: photo.id,
      title: data.title || null,
    });
  });
}
export async function removePhoto(
  actor: ParticipantActor,
  registrationId: string,
  entryId: string,
  position: number,
) {
  return scope(actor, registrationId, true, async (tx, registration) => {
    const photo = await tx.photo.findFirst({
      where: { registrationId, entryId, position, active: true },
    });
    if (!photo) throw new AccessError(404);
    await tx.photo.update({ where: { id: photo.id }, data: { active: false } });
    await log(tx, actor, registration, 'photo.removed', { photoId: photo.id });
  });
}
export async function photoFile(
  actor: ParticipantActor,
  registrationId: string,
  revisionId: string,
  original: boolean,
) {
  return scope(actor, registrationId, false, async (tx) => {
    const revision = await tx.photoRevision.findFirst({
      where: { id: revisionId, registrationId },
      include: { processing: true },
    });
    if (!revision) throw new AccessError(404);
    const key = original
      ? revision.storageKey
      : revision.processing?.status === 'ready'
        ? revision.processing.previewKey
        : null;
    if (!key) throw new AccessError(404);
    return readMedia(key);
  });
}
export async function photoUploadBody(request: Request, limit = maxPhotoBytes) {
  if (Number(request.headers.get('content-length') ?? 0) > limit)
    throw new CompetitionError(
      413,
      'Il file supera la dimensione massima consentita.',
    );
  const reader = request.body?.getReader();
  if (!reader) throw new CompetitionError(400, 'Seleziona una fotografia.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new CompetitionError(
          413,
          'Il file supera la dimensione massima consentita.',
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Uint8Array(Buffer.concat(chunks));
}
