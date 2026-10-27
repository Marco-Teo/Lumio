import '../../scripts/testing/preflight';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  saveContestCover,
  visibleCover,
} from '../../apps/web/src/server/competitions/cover';
import { setTimeout as delay } from 'node:timers/promises';
import { startRuntime } from '../../apps/worker/src/runtime';
import { createDatabase } from '@lumio/database';
import { database } from '../../apps/web/src/server/database';
import {
  saveContest,
  saveEdition,
  transitionEdition,
} from '../../apps/web/src/server/competitions';
import { emptyEdition } from '../../apps/web/src/lib/competitions';
import { emptyProfile } from '../../apps/web/src/lib/participants';
import {
  participantProfile,
  saveParticipantProfile,
  startRegistration,
  saveRegistrationProfile,
  registrationDetail,
  myRegistrations,
  organizationRegistrations,
  publishedEdition,
  publishedEditions,
} from '../../apps/web/src/server/participants';
if (!process.env.MIGRATION_DATABASE_URL || !process.env.WORKER_DATABASE_URL)
  throw new Error('Isolated DB required');
const owner = createDatabase(process.env.MIGRATION_DATABASE_URL),
  runtime = database(),
  worker = createDatabase(process.env.WORKER_DATABASE_URL);
const suffix = randomBytes(8).toString('hex');
const orgA = `registration-a-${suffix}`,
  orgB = `registration-b-${suffix}`;
const admin = {
  id: `registration-admin-${suffix}`,
  email: `registration-admin-${suffix}@example.invalid`,
  emailVerified: true,
  twoFactorEnabled: true,
};
const participant = {
  id: `participant-${suffix}`,
  email: `participant-${suffix}@example.invalid`,
  emailVerified: true,
};
const other = {
  id: `participant-other-${suffix}`,
  email: `participant-other-${suffix}@example.invalid`,
  emailVerified: true,
};
const userIds = [admin.id, participant.id, other.id];
after(async () => {
  const where = { organizationId: { in: [orgA, orgB] } };
  await owner.outboxEvent.deleteMany({ where });
  await owner.registrationEvent.deleteMany({ where });
  await owner.registration.deleteMany({ where });
  await owner.auditEvent.deleteMany({ where });
  await owner.section.deleteMany({ where });
  await owner.editionRevision.deleteMany({ where });
  await owner.edition.deleteMany({ where });
  await owner.contest.deleteMany({ where });
  await owner.organizationMembership.deleteMany({ where });
  await owner.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
  await owner.person.deleteMany({ where: { userId: { in: userIds } } });
  await owner.user.deleteMany({ where: { id: { in: userIds } } });
  await Promise.all([
    owner.$disconnect(),
    runtime.$disconnect(),
    worker.$disconnect(),
  ]);
});
test('participant profile and registration ownership across tenants', async (t) => {
  for (const actor of [admin, participant, other])
    await owner.user.create({
      data: { ...actor, name: 'Synthetic participant' },
    });
  for (const id of [orgA, orgB]) {
    await owner.organization.create({
      data: { id, name: id, slug: id, contactEmail: admin.email },
    });
    await owner.organizationMembership.create({
      data: { organizationId: id, userId: admin.id },
    });
  }
  const at = (days: number) =>
    new Date(Date.now() + days * 86400000).toISOString();
  const config = {
    ...emptyEdition('Edizione aperta', 'edizione-aperta', '2026'),
    description: 'Edizione per iscrizioni sintetiche',
    opensAt: at(-1),
    closesAt: at(1),
    juryAt: at(2),
    awardsAt: at(3),
    regulations: 'Regolamento originale',
    privacy: 'Privacy originale',
    sections: [
      {
        name: 'Tema libero',
        code: 'L',
        description: '',
        theme: '',
        type: 'single' as const,
        minImages: 1,
        maxImages: 1,
        feeCents: 0,
        specificRules: '',
      },
    ],
  };
  const contestA = await saveContest(admin, orgA, {
    name: 'Concorso A',
    slug: 'concorso',
    description: '',
  });
  const contestB = await saveContest(admin, orgB, {
    name: 'Concorso B',
    slug: 'concorso',
    description: '',
  });
  await saveContestCover(
    admin,
    orgA,
    contestA.id,
    readFileSync(new URL('../fixtures/contest-cover.png', import.meta.url)),
  );
  const editionA = await saveEdition(admin, orgA, contestA.id, {
    configuration: config,
  });
  const editionB = await saveEdition(admin, orgB, contestB.id, {
    configuration: config,
  });
  const draft = await saveEdition(admin, orgA, contestA.id, {
    configuration: { ...config, slug: 'bozza' },
  });
  await transitionEdition(admin, orgA, contestA.id, editionA.id, {
    version: 1,
    status: 'published',
  });
  await transitionEdition(admin, orgB, contestB.id, editionB.id, {
    version: 1,
    status: 'published',
  });
  const consent = {
    editionVersion: 1,
    acceptRegulations: true,
    acknowledgePrivacy: true,
  };
  let registrationId = '';
  await t.test(
    'public catalog exposes published editions but no drafts or people',
    async () => {
      const catalog = await publishedEditions();
      assert.ok(catalog.some((row) => row.editionId === editionA.id));
      assert.ok(!catalog.some((row) => row.editionId === draft.id));
      await assert.rejects(publishedEdition(draft.id));
      const detail = await publishedEdition(editionA.id);
      assert.equal('actorUserId' in detail, false);
      assert.equal('personId' in detail, false);
      assert.equal(await runtime.registration.count(), 0);
      await assert.rejects(worker.registration.findMany());
    },
  );
  await t.test(
    'profile is self-only, accepts partial saves and rejects stale versions',
    async () => {
      const profile = await participantProfile(participant);
      assert.equal(profile.version, 1);
      await saveParticipantProfile(participant, {
        version: 1,
        profile: {
          ...emptyProfile,
          firstName: 'Originale',
          lastName: 'Partecipante',
          country: 'IT',
        },
      });
      await assert.rejects(
        saveParticipantProfile(participant, {
          version: 1,
          profile: emptyProfile,
        }),
        /cambiato/,
      );
      assert.equal((await participantProfile(other)).profile.firstName, '');
      await assert.rejects(
        saveParticipantProfile(
          { ...participant, emailVerified: false },
          { version: 2, profile: emptyProfile },
        ),
      );
    },
  );
  await t.test(
    'consents and edition version are required and creation is idempotent under concurrency',
    async () => {
      await assert.rejects(
        startRegistration(participant, editionA.id, {
          ...consent,
          acceptRegulations: false,
        }),
      );
      await assert.rejects(
        startRegistration(participant, editionA.id, {
          ...consent,
          editionVersion: 2,
        }),
      );
      const registrations = await Promise.all([
        startRegistration(participant, editionA.id, consent),
        startRegistration(participant, editionA.id, consent),
      ]);
      assert.equal(registrations[0].id, registrations[1].id);
      registrationId = registrations[0].id;
      assert.equal(registrations[0].status, 'entries_incomplete');
      assert.equal(
        await owner.registration.count({ where: { editionId: editionA.id } }),
        1,
      );
      assert.equal(
        await owner.registrationEvent.count({ where: { registrationId } }),
        1,
      );
      const snapshot = registrations[0].configurationSnapshot as {
        regulations: string;
      };
      assert.equal(snapshot.regulations, 'Regolamento originale');
      assert.ok(registrations[0].privacyAcknowledgedAt);
      assert.ok(registrations[0].regulationsAcceptedAt);
    },
  );
  await t.test(
    'receipt is encrypted, retried and not duplicated by repeated registration requests',
    async () => {
      if (
        !process.env.WORKER_DATABASE_URL ||
        !process.env.REDIS_URL ||
        !process.env.JOB_PAYLOAD_KEY
      )
        throw new Error('Worker fixture config missing');
      const events = await owner.outboxEvent.findMany({
        where: { registrationId, type: 'registration.started' },
      });
      assert.equal(events.length, 1);
      assert.equal(
        JSON.stringify(events[0].payload).includes(participant.email),
        false,
      );
      let deliveries = 0;
      const service = startRuntime({
        databaseUrl: process.env.WORKER_DATABASE_URL,
        redisUrl: process.env.REDIS_URL,
        encryptionKey: process.env.JOB_PAYLOAD_KEY,
        appUrl: 'http://127.0.0.1:3100',
        queue: `receipt-${suffix}`,
        pollMilliseconds: 40,
        sendEmail: async (message) => {
          deliveries++;
          assert.equal(message.to, participant.email);
          assert.match(message.subject, /bozza di iscrizione ricevuta/);
          assert.ok(message.text.includes('Concorso A'));
          assert.ok(message.text.includes(orgA));
          assert.match(message.text, /non l’iscrizione definitiva/);
          if (deliveries === 1) throw new Error('Synthetic delivery failure');
        },
      });
      try {
        const deadline = Date.now() + 10000;
        while (
          (
            await owner.outboxEvent.findUniqueOrThrow({
              where: { id: events[0].id },
            })
          ).status !== 'completed'
        ) {
          if (Date.now() > deadline)
            throw new Error('Receipt was not completed');
          await delay(50);
        }
        const duplicate = await service.queue.add(
          'duplicate',
          { outboxId: events[0].id },
          { jobId: `duplicate-${events[0].id}`, removeOnComplete: false },
        );
        while ((await duplicate.getState()) !== 'completed') {
          if (Date.now() > deadline)
            throw new Error('Duplicate was not processed');
          await delay(50);
        }
        assert.equal(deliveries, 2);
        assert.equal(
          (await registrationDetail(participant, registrationId)).receiptStatus,
          'completed',
        );
      } finally {
        await service.close();
      }
    },
  );
  await t.test(
    'missing receipt configuration rolls back registration and audit together',
    async () => {
      const key = process.env.JOB_PAYLOAD_KEY;
      delete process.env.JOB_PAYLOAD_KEY;
      try {
        await assert.rejects(
          startRegistration(other, editionA.id, consent),
          /encryption configuration/,
        );
      } finally {
        process.env.JOB_PAYLOAD_KEY = key;
      }
      const person = await owner.person.findUniqueOrThrow({
        where: { userId: other.id },
      });
      assert.equal(
        await owner.registration.count({
          where: { personId: person.id, editionId: editionA.id },
        }),
        0,
      );
      assert.equal(
        await owner.registrationEvent.count({
          where: { actorUserId: other.id },
        }),
        0,
      );
    },
  );
  await t.test(
    'profile changes and per-registration changes never overwrite one another',
    async () => {
      await saveParticipantProfile(participant, {
        version: 2,
        profile: {
          ...emptyProfile,
          firstName: 'Nuovo profilo',
          lastName: 'Partecipante',
          country: 'IT',
        },
      });
      assert.equal(
        (await registrationDetail(participant, registrationId))
          .profileSnapshot &&
          (
            (await registrationDetail(participant, registrationId))
              .profileSnapshot as { firstName: string }
          ).firstName,
        'Originale',
      );
      await saveRegistrationProfile(participant, registrationId, {
        version: 1,
        profile: {
          ...emptyProfile,
          firstName: 'Solo iscrizione',
          lastName: 'Partecipante',
          country: 'FR',
        },
      });
      assert.equal(
        (await participantProfile(participant)).profile.firstName,
        'Nuovo profilo',
      );
      await assert.rejects(
        saveRegistrationProfile(participant, registrationId, {
          version: 1,
          profile: emptyProfile,
        }),
        /cambiata/,
      );
    },
  );
  await t.test(
    'another participant cannot read or update the registration, including by guessed tenant',
    async () => {
      const foreign = await startRegistration(other, editionB.id, consent);
      assert.equal(foreign.status, 'profile_incomplete');
      await assert.rejects(registrationDetail(other, registrationId));
      await assert.rejects(
        saveRegistrationProfile(other, registrationId, {
          version: 2,
          profile: emptyProfile,
        }),
      );
      assert.deepEqual(
        (await myRegistrations(participant)).map((row) => row.id),
        [registrationId],
      );
      assert.match(
        (await myRegistrations(participant))[0].coverVersion ?? '',
        /^[a-f0-9]{64}$/,
      );
      await runtime.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.user_id',${other.id},true)`;
        await tx.$executeRaw`SELECT set_config('app.organization_id',${orgA},true)`;
        assert.equal(await tx.registration.count(), 0);
      });
      const own = await organizationRegistrations(admin, orgA);
      assert.equal(own.length, 1);
      assert.equal(own[0].id, registrationId);
      await assert.rejects(
        organizationRegistrations({ ...admin, twoFactorEnabled: false }, orgA),
      );
      await assert.rejects(
        organizationRegistrations(
          { ...participant, twoFactorEnabled: true },
          orgA,
        ),
      );
    },
  );
  await t.test(
    'runtime cannot rewrite consent, identity, frozen documents or the audit log',
    async () => {
      await assert.rejects(
        runtime.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.user_id',${participant.id},true)`;
          await tx.$executeRaw`SELECT set_config('app.organization_id',${orgA},true)`;
          return tx.registration.update({
            where: { id: registrationId },
            data: {
              configurationSnapshot: { privacy: 'Changed' },
              version: { increment: 1 },
            },
          });
        }),
      );
      await assert.rejects(runtime.registrationEvent.deleteMany());
      await assert.rejects(
        owner.registration.create({
          data: {
            organizationId: orgB,
            editionId: editionA.id,
            editionVersion: 1,
            personId: (
              await owner.person.findUniqueOrThrow({
                where: { userId: other.id },
              })
            ).id,
            organizationName: 'Synthetic',
            contestName: 'Synthetic',
            contactEmail: 'synthetic@example.invalid',
            status: 'profile_incomplete',
            profileSnapshot: {},
            configurationSnapshot: {},
          },
        }),
      );
    },
  );
  await t.test(
    'closed dates, archived editions and suspended organizations prevent changes',
    async () => {
      const closed = await saveEdition(admin, orgA, contestA.id, {
        configuration: {
          ...config,
          slug: 'chiusa',
          opensAt: at(-4),
          closesAt: at(-3),
          juryAt: at(-2),
          awardsAt: at(-1),
        },
      });
      await transitionEdition(admin, orgA, contestA.id, closed.id, {
        version: 1,
        status: 'published',
      });
      await assert.rejects(
        startRegistration(participant, closed.id, consent),
        /non sono aperte/,
      );
      await transitionEdition(admin, orgA, contestA.id, closed.id, {
        version: 1,
        status: 'archived',
      });
      await transitionEdition(admin, orgA, contestA.id, editionA.id, {
        version: 1,
        status: 'archived',
      });
      assert.equal(
        (await registrationDetail(participant, registrationId)).editable,
        false,
      );
      await assert.rejects(visibleCover(contestA.id));
      assert.ok(
        (await visibleCover(contestA.id, participant.id)).data.length > 0,
      );
      await assert.rejects(visibleCover(contestA.id, other.id));
      await assert.rejects(
        saveRegistrationProfile(participant, registrationId, {
          version: 2,
          profile: emptyProfile,
        }),
        /non è più disponibile/,
      );
      await owner.organization.update({
        where: { id: orgB },
        data: { status: 'suspended' },
      });
      await assert.rejects(
        startRegistration(participant, editionB.id, consent),
      );
      assert.ok(
        !(await publishedEditions()).some(
          (row) => row.editionId === editionB.id,
        ),
      );
    },
  );
});
