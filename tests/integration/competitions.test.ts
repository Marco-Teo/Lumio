import '../../scripts/testing/preflight';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createDatabase } from '@lumio/database';
import { database } from '../../apps/web/src/server/database';
import { withOrganization } from '../../apps/web/src/server/tenancy';
import {
  saveContest,
  saveEdition,
  transitionEdition,
  listCompetitions,
  organizationMemberships,
} from '../../apps/web/src/server/competitions';
import { emptyEdition } from '../../apps/web/src/lib/competitions';

if (!process.env.MIGRATION_DATABASE_URL || !process.env.WORKER_DATABASE_URL)
  throw new Error('Competition database environment required');
const owner = createDatabase(process.env.MIGRATION_DATABASE_URL);
const runtime = database();
const worker = createDatabase(process.env.WORKER_DATABASE_URL);
const suffix = randomBytes(8).toString('hex');
const actor = {
  id: `contest-admin-${suffix}`,
  emailVerified: true,
  twoFactorEnabled: true,
};
const orgA = `contest-a-${suffix}`,
  orgB = `contest-b-${suffix}`;
after(async () => {
  const where = { organizationId: { in: [orgA, orgB] } };
  await owner.auditEvent.deleteMany({ where });
  await owner.section.deleteMany({ where });
  await owner.editionRevision.deleteMany({ where });
  await owner.edition.deleteMany({ where });
  await owner.contest.deleteMany({ where });
  await owner.organizationMembership.deleteMany({ where });
  await owner.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
  await owner.person.deleteMany({ where: { userId: actor.id } });
  await owner.user.deleteMany({ where: { id: actor.id } });
  await Promise.all([
    owner.$disconnect(),
    runtime.$disconnect(),
    worker.$disconnect(),
  ]);
});

test('competition lifecycle, tenant isolation and immutable revisions', async (t) => {
  await owner.user.create({
    data: {
      ...actor,
      email: `${actor.id}@example.invalid`,
      name: 'Synthetic organizer',
    },
  });
  for (const id of [orgA, orgB])
    await owner.organization.create({
      data: {
        id,
        name: id,
        slug: id,
        contactEmail: 'organizer@example.invalid',
      },
    });
  await owner.organizationMembership.create({
    data: { organizationId: orgA, userId: actor.id },
  });
  await owner.contest.create({
    data: {
      organizationId: orgB,
      name: 'Concorso di un altro tenant',
      slug: 'concorso',
      description: '',
    },
  });
  let contestId = '',
    editionId = '';
  const draft = emptyEdition('Edizione 2027', 'edizione-2027', '2027');
  await t.test(
    'discovery exposes only own memberships and MFA is required',
    async () => {
      assert.deepEqual(
        (await organizationMemberships(actor.id)).map((org) => org.id),
        [orgA],
      );
      await assert.rejects(
        listCompetitions({ ...actor, twoFactorEnabled: false }, orgA),
        /due fattori/,
      );
      await assert.rejects(
        listCompetitions({ ...actor, emailVerified: false }, orgA),
      );
      await assert.rejects(listCompetitions(actor, orgB));
      assert.equal(await runtime.contest.count(), 0);
    },
  );
  await t.test(
    'creates multiple editions and scopes slugs to their parent',
    async () => {
      const contest = await saveContest(actor, orgA, {
        name: 'Concorso permanente',
        slug: 'concorso',
        description: '',
      });
      contestId = contest.id;
      const edition = await saveEdition(actor, orgA, contestId, {
        configuration: draft,
      });
      editionId = edition.id;
      await saveEdition(actor, orgA, contestId, {
        configuration: {
          ...draft,
          name: 'Edizione 2028',
          slug: 'edizione-2028',
          identifier: '2028',
        },
      });
      await assert.rejects(
        saveContest(actor, orgA, {
          name: 'Duplicato',
          slug: 'concorso',
          description: '',
        }),
      );
      await assert.rejects(
        saveEdition(actor, orgB, contestId, { configuration: draft }),
      );
      // Even a trusted migrator cannot form a cross-tenant parent relationship.
      await assert.rejects(
        owner.edition.create({
          data: {
            organizationId: orgB,
            contestId,
            name: 'Invalid',
            slug: 'invalid',
            identifier: '2027',
          },
        }),
      );
    },
  );
  await t.test(
    'rejects incomplete publication without changing status or audit',
    async () => {
      const count = await owner.auditEvent.count({
        where: { organizationId: orgA },
      });
      await assert.rejects(
        transitionEdition(actor, orgA, contestId, editionId, {
          version: 1,
          status: 'published',
        }),
        /regolamento/,
      );
      assert.equal(
        (await owner.edition.findUniqueOrThrow({ where: { id: editionId } }))
          .status,
        'draft',
      );
      assert.equal(
        await owner.auditEvent.count({ where: { organizationId: orgA } }),
        count,
      );
    },
  );
  const complete = {
    ...draft,
    description: 'Edizione di prova',
    opensAt: '2027-01-01T10:00:00.000Z',
    closesAt: '2027-02-01T10:00:00.000Z',
    juryAt: '2027-03-01T10:00:00.000Z',
    awardsAt: '2027-04-01T10:00:00.000Z',
    regulations: 'Regolamento versione 2',
    privacy: 'Informativa versione 2',
    sections: [
      {
        name: 'Portfolio',
        code: 'P',
        description: 'Racconto fotografico',
        theme: 'Libero',
        type: 'portfolio' as const,
        minImages: 3,
        maxImages: 8,
        feeCents: 0,
        specificRules: '',
      },
    ],
  };
  await t.test(
    'concurrent saves preserve one winner and all prior snapshots',
    async () => {
      const results = await Promise.allSettled([
        saveEdition(
          actor,
          orgA,
          contestId,
          { version: 1, configuration: complete },
          editionId,
        ),
        saveEdition(
          actor,
          orgA,
          contestId,
          { version: 1, configuration: complete },
          editionId,
        ),
      ]);
      assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        1,
      );
      const revisions = await owner.editionRevision.findMany({
        where: { editionId },
        orderBy: { version: 'asc' },
      });
      assert.equal(revisions.length, 2);
      assert.deepEqual(revisions[0].configuration, draft);
      assert.deepEqual(revisions[1].configuration, complete);
      const sections = await owner.section.findMany({ where: { editionId } });
      assert.equal(sections[0].type, 'portfolio');
      assert.equal(sections[0].position, 0);
    },
  );
  await t.test(
    'database isolates rows and refuses forged revision authors',
    async () => {
      await withOrganization(actor.id, orgA, async (tx) => {
        assert.equal((await tx.contest.findMany()).length, 1);
        assert.equal(await tx.edition.count(), 2);
        await assert.rejects(
          tx.editionRevision.updateMany({ data: { version: 100 } }),
        );
      });
      await assert.rejects(
        withOrganization(actor.id, orgA, (tx) =>
          tx.editionRevision.create({
            data: {
              organizationId: orgA,
              editionId,
              version: 99,
              configuration: draft,
              actorUserId: 'demo-user-b',
            },
          }),
        ),
      );
      await assert.rejects(worker.contest.findMany());
      await assert.rejects(
        owner.section.create({
          data: {
            ...complete.sections[0],
            organizationId: orgB,
            editionId,
            position: 0,
          },
        }),
      );
      await runtime.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.user_id',${actor.id},true)`;
        await tx.$executeRaw`SELECT set_config('app.organization_id',${orgB},true)`;
        assert.equal(await tx.contest.count(), 0);
      });
    },
  );
  await t.test(
    'publication freezes configuration and permits only archival',
    async () => {
      await transitionEdition(actor, orgA, contestId, editionId, {
        version: 2,
        status: 'published',
      });
      await assert.rejects(
        saveEdition(
          actor,
          orgA,
          contestId,
          { version: 2, configuration: complete },
          editionId,
        ),
        /modificabile/,
      );
      await assert.rejects(
        withOrganization(actor.id, orgA, (tx) =>
          tx.section.deleteMany({ where: { editionId } }),
        ),
      );
      await assert.rejects(
        withOrganization(actor.id, orgA, (tx) =>
          tx.edition.update({
            where: { id: editionId },
            data: { name: 'Changed' },
          }),
        ),
      );
      await transitionEdition(actor, orgA, contestId, editionId, {
        version: 2,
        status: 'archived',
      });
      await assert.rejects(
        transitionEdition(actor, orgA, contestId, editionId, {
          version: 2,
          status: 'published',
        }),
      );
      assert.ok(
        await owner.auditEvent.count({
          where: { organizationId: orgA, action: 'edition.published' },
        }),
      );
    },
  );
  await t.test(
    'save racing publication cannot publish an obsolete version',
    async () => {
      const parallel = await saveEdition(actor, orgA, contestId, {
        configuration: { ...complete, slug: 'concurrent-edition' },
      });
      const results = await Promise.allSettled([
        saveEdition(
          actor,
          orgA,
          contestId,
          {
            version: 1,
            configuration: {
              ...complete,
              slug: 'concurrent-edition',
              regulations: 'Updated before publication',
            },
          },
          parallel.id,
        ),
        transitionEdition(actor, orgA, contestId, parallel.id, {
          version: 1,
          status: 'published',
        }),
      ]);
      assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        1,
      );
      const saved = await owner.edition.findUniqueOrThrow({
        where: { id: parallel.id },
      });
      assert.ok(
        (saved.status === 'draft' && saved.version === 2) ||
          (saved.status === 'published' && saved.version === 1),
      );
    },
  );
  await t.test(
    'suspension blocks competition access at service and database level',
    async () => {
      await owner.organization.update({
        where: { id: orgA },
        data: { status: 'suspended' },
      });
      await assert.rejects(listCompetitions(actor, orgA));
      await runtime.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.user_id',${actor.id},true)`;
        await tx.$executeRaw`SELECT set_config('app.organization_id',${orgA},true)`;
        assert.equal(await tx.contest.count(), 0);
      });
    },
  );
});
