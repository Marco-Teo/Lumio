import '../../scripts/testing/preflight';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '@lumio/database';
import { withOrganization } from '../../apps/web/src/server/tenancy/index';
import { database } from '../../apps/web/src/server/database';

if (!process.env.DATABASE_URL || !process.env.MIGRATION_DATABASE_URL)
  throw new Error('Integration database environment required');
const runtime = database();
const owner = createDatabase(process.env.MIGRATION_DATABASE_URL);
after(async () => {
  await runtime.$disconnect();
  await owner.$disconnect();
});

test('runtime is neither superuser nor bypass role nor table owner', async () => {
  const [role] = await runtime.$queryRaw<
    Array<{ rolsuper: boolean; rolbypassrls: boolean }>
  >`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
  assert.equal(role.rolsuper, false);
  assert.equal(role.rolbypassrls, false);
  const owned = await runtime.$queryRaw<
    Array<{ count: bigint }>
  >`SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tableowner=current_user`;
  assert.equal(Number(owned[0].count), 0);
});

test('missing context exposes no organizations, people or memberships', async () => {
  assert.equal((await runtime.organization.findMany()).length, 0);
  assert.equal((await runtime.person.findMany()).length, 0);
  assert.equal((await runtime.organizationMembership.findMany()).length, 0);
});

test('authorized tenant reads its own organization only', async () => {
  await withOrganization('demo-user-a', 'demo-org-a', async (tx) => {
    assert.deepEqual(
      (await tx.organization.findMany()).map((org) => org.id),
      ['demo-org-a'],
    );
    assert.equal(
      await tx.organization.findUnique({ where: { id: 'demo-org-b' } }),
      null,
    );
    assert.equal(
      await tx.person.findUnique({ where: { userId: 'demo-user-b' } }),
      null,
    );
  });
});

test('application service rejects membership in another organization', async () => {
  await assert.rejects(
    withOrganization('demo-user-a', 'demo-org-b', async () => true),
    /Accesso/,
  );
});

test('database denies a tenant identifier without the matching user membership', async () => {
  await runtime.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.organization_id', 'demo-org-b', true)`;
    await tx.$executeRaw`SELECT set_config('app.user_id', 'demo-user-a', true)`;
    assert.equal((await tx.organization.findMany()).length, 0);
  });
});

test('a person can be updated only by its own identity context', async () => {
  await withOrganization('demo-user-a', 'demo-org-a', async (tx) => {
    assert.equal(
      (
        await tx.person.updateMany({
          where: { userId: 'demo-user-b' },
          data: { firstName: 'Forbidden' },
        })
      ).count,
      0,
    );
    assert.equal(
      (
        await tx.person.updateMany({
          where: { userId: 'demo-user-a' },
          data: { firstName: 'Demo' },
        })
      ).count,
      1,
    );
  });
});

test('tenant context does not survive transaction completion or rollback', async () => {
  await assert.rejects(
    withOrganization('demo-user-a', 'demo-org-a', async () => {
      throw new Error('rollback');
    }),
  );
  assert.equal((await runtime.organization.findMany()).length, 0);
  await withOrganization('demo-user-b', 'demo-org-b', async (tx) =>
    assert.equal((await tx.organization.findMany())[0].id, 'demo-org-b'),
  );
  assert.equal((await runtime.organization.findMany()).length, 0);
});

test('cross-tenant writes and runtime provisioning are denied', async () => {
  await assert.rejects(
    withOrganization('demo-user-a', 'demo-org-a', async (tx) =>
      tx.organization.update({
        where: { id: 'demo-org-b' },
        data: { name: 'Forbidden' },
      }),
    ),
  );
  await assert.rejects(
    withOrganization('demo-user-a', 'demo-org-a', async (tx, membership) =>
      tx.auditEvent.create({
        data: {
          organizationId: 'demo-org-b',
          actorMembershipId: membership.id,
          actorUserId: 'demo-user-a',
          action: 'forbidden',
          entityId: 'test',
        },
      }),
    ),
  );
  await assert.rejects(
    runtime.platformRole.create({
      data: { userId: 'demo-user-a', role: 'super_admin' },
    }),
  );
});

test('composite foreign key prevents cross-tenant actor relationships even for migrator', async () => {
  await assert.rejects(
    owner.auditEvent.create({
      data: {
        organizationId: 'demo-org-a',
        actorMembershipId: 'demo-membership-b',
        actorUserId: 'demo-user-b',
        action: 'invalid',
        entityId: 'test',
      },
    }),
  );
});

test('audit is append-only for the runtime', async () => {
  const event = await withOrganization(
    'demo-user-a',
    'demo-org-a',
    (tx, membership) =>
      tx.auditEvent.create({
        data: {
          organizationId: 'demo-org-a',
          actorUserId: 'demo-user-a',
          actorMembershipId: membership.id,
          action: 'test',
          entityId: 'test',
        },
      }),
  );
  await assert.rejects(
    withOrganization('demo-user-a', 'demo-org-a', (tx) =>
      tx.auditEvent.delete({ where: { id: event.id } }),
    ),
  );
});

test('suspended organization is rejected by the application', async () => {
  await owner.organization.update({
    where: { id: 'demo-org-b' },
    data: { status: 'suspended' },
  });
  try {
    await assert.rejects(
      withOrganization('demo-user-b', 'demo-org-b', async () => true),
      /Accesso/,
    );
  } finally {
    await owner.organization.update({
      where: { id: 'demo-org-b' },
      data: { status: 'active' },
    });
  }
});
