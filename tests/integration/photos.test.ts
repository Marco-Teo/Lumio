import '../../scripts/testing/preflight';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from '../../apps/web/node_modules/sharp/dist/index.mjs';
import { createDatabase } from '@lumio/database';
import { database } from '../../apps/web/src/server/database';
import { mediaRoot } from '@lumio/media/storage';
import {
  saveContest,
  saveEdition,
  transitionEdition,
} from '../../apps/web/src/server/competitions';
import { emptyEdition } from '../../apps/web/src/lib/competitions';
import { startRegistration } from '../../apps/web/src/server/participants';
import {
  createEntry,
  listEntries,
  uploadPhoto,
  removePhoto,
  photoFile,
  updateEntry,
  renamePhoto,
} from '../../apps/web/src/server/entries';
import { processPhotoEvent } from '../../apps/worker/src/photos';

test('participant photos preserve originals, isolate ownership and process immutable revisions', async (t) => {
  if (
    !process.env.MIGRATION_DATABASE_URL ||
    !process.env.WORKER_DATABASE_URL ||
    !process.env.DATABASE_URL
  )
    throw new Error('Isolated databases required');
  const owner = createDatabase(process.env.MIGRATION_DATABASE_URL),
    worker = createDatabase(process.env.WORKER_DATABASE_URL),
    runtime = database();
  const organizationId = randomUUID(),
    userId = randomUUID(),
    otherId = randomUUID();
  const actor = {
    id: userId,
    email: `${userId}@example.invalid`,
    emailVerified: true,
    twoFactorEnabled: true,
  };
  const other = {
    id: otherId,
    email: `${otherId}@example.invalid`,
    emailVerified: true,
  };
  const original = readFileSync('tests/fixtures/contest-cover.png');
  const at = (days: number) =>
    new Date(Date.now() + days * 86400000).toISOString();
  try {
    for (const user of [actor, other])
      await owner.user.create({
        data: { ...user, name: 'Synthetic photo participant' },
      });
    await owner.organization.create({
      data: {
        id: organizationId,
        name: 'Synthetic photos',
        slug: `photos-${organizationId}`,
        contactEmail: actor.email,
      },
    });
    await owner.organizationMembership.create({
      data: { organizationId, userId },
    });
    const contest = await saveContest(actor, organizationId, {
      name: 'Photo validation',
      slug: 'photos',
      description: '',
    });
    const config = {
      ...emptyEdition('Photo edition', 'photos', '2026'),
      description: 'Synthetic photo edition',
      opensAt: at(-1),
      closesAt: at(1),
      juryAt: at(2),
      awardsAt: at(3),
      regulations: 'Rules',
      privacy: 'Privacy',
      imageRules: {
        ...emptyEdition('x', 'xx', '1').imageRules,
        formats: ['png'] as 'png'[],
      },
      sections: [
        {
          name: 'Single',
          code: 'S',
          description: '',
          theme: '',
          type: 'single' as const,
          minImages: 1,
          maxImages: 1,
          feeCents: 0,
          specificRules: '',
        },
        {
          name: 'Portfolio',
          code: 'P',
          description: '',
          theme: '',
          type: 'portfolio' as const,
          minImages: 2,
          maxImages: 3,
          feeCents: 0,
          specificRules: '',
        },
      ],
    };
    const edition = await saveEdition(actor, organizationId, contest.id, {
      configuration: config,
    });
    await transitionEdition(actor, organizationId, contest.id, edition.id, {
      version: 1,
      status: 'published',
    });
    const registration = await startRegistration(actor, edition.id, {
      editionVersion: 1,
      acceptRegulations: true,
      acknowledgePrivacy: true,
    });
    const registrationId = registration.id;
    const entry = await createEntry(actor, registrationId, {
      title: 'Original title',
      sectionCode: 'S',
    });
    await t.test(
      'batch entry retries reuse their original parent without duplicate works',
      async () => {
        const id = randomUUID();
        const first = await createEntry(actor, registrationId, {
          id,
          title: 'Batch parent',
          sectionCode: 'S',
        });
        const retry = await createEntry(actor, registrationId, {
          id,
          title: 'Batch parent',
          sectionCode: 'S',
        });
        assert.equal(first.id, retry.id);
        assert.equal(
          await owner.entry.count({ where: { id, registrationId } }),
          1,
        );
        await assert.rejects(
          createEntry(actor, registrationId, {
            id,
            title: 'Foreign parent',
            sectionCode: 'P',
          }),
          /Identificativo/,
        );
        await updateEntry(actor, registrationId, id, {
          title: 'Batch parent',
          version: 1,
          active: false,
        });
      },
    );
    await t.test(
      'sections, ownership and position bounds are enforced before upload',
      async () => {
        await assert.rejects(
          createEntry(other, registrationId, {
            title: 'Foreign',
            sectionCode: 'S',
          }),
        );
        await assert.rejects(
          createEntry(actor, registrationId, {
            title: 'Invalid',
            sectionCode: 'X',
          }),
          /sezione/,
        );
        await assert.rejects(
          uploadPhoto(
            actor,
            registrationId,
            entry.id,
            2,
            randomUUID(),
            original,
          ),
          /posizione/,
        );
        await assert.rejects(
          uploadPhoto(
            actor,
            registrationId,
            entry.id,
            1,
            randomUUID(),
            Buffer.from('<svg/>'),
          ),
          /Formato/,
        );
        assert.deepEqual(await runtime.entry.findMany(), []);
        assert.deepEqual(await worker.photoRevision.findMany(), []);
      },
    );
    const revisionId = randomUUID();
    await t.test(
      'concurrent upload retries create one revision and one outbox event',
      async () => {
        const results = await Promise.all([
          uploadPhoto(actor, registrationId, entry.id, 1, revisionId, original),
          uploadPhoto(actor, registrationId, entry.id, 1, revisionId, original),
        ]);
        assert.equal(results[0].id, results[1].id);
        assert.equal(
          await owner.photoRevision.count({ where: { registrationId } }),
          1,
        );
        assert.equal(
          await owner.outboxEvent.count({
            where: { photoRevisionId: revisionId },
          }),
          1,
        );
        assert.deepEqual(
          await photoFile(actor, registrationId, revisionId, true),
          original,
        );
        await assert.rejects(
          photoFile(other, registrationId, revisionId, true),
        );
        await assert.rejects(listEntries(other, registrationId));
      },
    );
    await t.test(
      'runtime cannot alter originals, parents or processing results',
      async () => {
        await runtime.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.user_id',${userId},true)`;
          await tx.$executeRaw`SELECT set_config('app.organization_id',${organizationId},true)`;
          assert.equal(await tx.photoRevision.count(), 1);
        });
        const denied = async (sql: string) =>
          assert.rejects(
            runtime.$transaction(async (tx) => {
              await tx.$executeRaw`SELECT set_config('app.user_id',${userId},true)`;
              await tx.$executeRaw`SELECT set_config('app.organization_id',${organizationId},true)`;
              await tx.$executeRawUnsafe(sql);
            }),
          );
        await denied("UPDATE photo_revision SET sha256=repeat('0',64)");
        await denied('DELETE FROM photo_revision');
        await denied('UPDATE entry SET "sectionCode"=\'P\'');
        await denied("UPDATE photo_processing SET status='ready'");
        await assert.rejects(worker.user.findMany());
      },
    );
    await t.test(
      'worker generates metadata-free preview idempotently without changing original',
      async () => {
        for (let i = 0; i < 2; i++)
          await worker.$transaction(
            (tx) => processPhotoEvent(tx, organizationId, revisionId),
            { timeout: 25000 },
          );
        const result = await owner.photoProcessing.findUniqueOrThrow({
          where: { revisionId },
        });
        assert.equal(result.status, 'ready');
        const preview = await photoFile(
            actor,
            registrationId,
            revisionId,
            false,
          ),
          metadata = await sharp(preview).metadata();
        assert.equal(metadata.format, 'webp');
        assert.equal(metadata.exif, undefined);
        assert.equal(metadata.icc, undefined);
        assert.equal(
          createHash('sha256')
            .update(await photoFile(actor, registrationId, revisionId, true))
            .digest('hex'),
          createHash('sha256').update(original).digest('hex'),
        );
      },
    );
    const corruptId = randomUUID();
    await t.test(
      'photo captions are owner-only metadata and never modify original bytes',
      async () => {
        await renamePhoto(actor, registrationId, entry.id, 1, {
          title: 'Luce — città',
        });
        assert.equal(
          (await listEntries(actor, registrationId))[0].photos[0].title,
          'Luce — città',
        );
        await assert.rejects(
          renamePhoto(other, registrationId, entry.id, 1, { title: 'Foreign' }),
        );
        assert.deepEqual(
          await photoFile(actor, registrationId, revisionId, true),
          original,
        );
        await renamePhoto(actor, registrationId, entry.id, 1, { title: null });
        assert.equal(
          (await listEntries(actor, registrationId))[0].photos[0].title,
          null,
        );
      },
    );
    await t.test(
      'replacement preserves prior revision and marks corrupt input as rejected',
      async () => {
        const corrupt = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
        await uploadPhoto(
          actor,
          registrationId,
          entry.id,
          1,
          corruptId,
          corrupt,
        );
        await worker.$transaction(
          (tx) => processPhotoEvent(tx, organizationId, corruptId),
          { timeout: 25000 },
        );
        const entries = await listEntries(actor, registrationId);
        assert.equal(entries[0].photos[0].currentRevision, 2);
        assert.equal(entries[0].photos[0].revisions.length, 2);
        assert.equal(
          entries[0].photos[0].revisions[0].processing?.status,
          'rejected',
        );
        assert.deepEqual(
          await photoFile(actor, registrationId, revisionId, true),
          original,
        );
        await assert.rejects(
          photoFile(actor, registrationId, corruptId, false),
        );
      },
    );
    await t.test(
      'removal hides the logical photo while preserving revision history',
      async () => {
        await removePhoto(actor, registrationId, entry.id, 1);
        assert.equal(
          (await listEntries(actor, registrationId))[0].photos.length,
          0,
        );
        assert.deepEqual(
          await photoFile(actor, registrationId, revisionId, true),
          original,
        );
        await uploadPhoto(
          actor,
          registrationId,
          entry.id,
          1,
          randomUUID(),
          original,
        );
        assert.equal(
          (await listEntries(actor, registrationId))[0].photos[0]
            .currentRevision,
          3,
        );
        await updateEntry(actor, registrationId, entry.id, {
          title: 'Changed title',
          version: 1,
          active: true,
        });
        await assert.rejects(
          updateEntry(actor, registrationId, entry.id, {
            title: 'Stale',
            version: 1,
            active: true,
          }),
          /cambiata/,
        );
      },
    );
    await t.test(
      'archival blocks writes but the participant retains access to originals',
      async () => {
        await transitionEdition(actor, organizationId, contest.id, edition.id, {
          version: 1,
          status: 'archived',
        });
        await assert.rejects(
          uploadPhoto(
            actor,
            registrationId,
            entry.id,
            1,
            randomUUID(),
            original,
          ),
          /chiuse/,
        );
        await assert.rejects(
          createEntry(actor, registrationId, {
            title: 'Closed',
            sectionCode: 'S',
          }),
          /chiuse/,
        );
        assert.deepEqual(
          await photoFile(actor, registrationId, revisionId, true),
          original,
        );
      },
    );
  } finally {
    const where = { organizationId };
    await owner.outboxEvent.deleteMany({ where });
    await owner.photoProcessing.deleteMany({ where });
    await owner.photoRevision.deleteMany({ where });
    await owner.photo.deleteMany({ where });
    await owner.entry.deleteMany({ where });
    await owner.registrationEvent.deleteMany({ where });
    await owner.registration.deleteMany({ where });
    await owner.auditEvent.deleteMany({ where });
    await owner.section.deleteMany({ where });
    await owner.editionRevision.deleteMany({ where });
    await owner.edition.deleteMany({ where });
    await owner.contest.deleteMany({ where });
    await owner.organizationMembership.deleteMany({ where });
    await owner.organization.deleteMany({ where: { id: organizationId } });
    await owner.person.deleteMany({
      where: { userId: { in: [userId, otherId] } },
    });
    await owner.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
    await Promise.all([
      owner.$disconnect(),
      worker.$disconnect(),
      runtime.$disconnect(),
    ]);
    await rm(resolve(mediaRoot(), organizationId), {
      recursive: true,
      force: true,
    });
  }
});
