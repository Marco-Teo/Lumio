import '../../scripts/testing/preflight';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createDatabase } from '@lumio/database';
import { openToken, tokenHash } from '@lumio/jobs';
import {
  createOrganization,
  listOrganizations,
  changeOrganizationStatus,
  resendInvitation,
  organizationAudit,
} from '../../apps/web/src/server/platform/index';
import { database } from '../../apps/web/src/server/database';
import { startRuntime } from '../../apps/worker/src/runtime';
import { sendEmail } from '@lumio/jobs/mail';

if (
  !process.env.MIGRATION_DATABASE_URL ||
  !process.env.WORKER_DATABASE_URL ||
  !process.env.REDIS_URL ||
  !process.env.JOB_PAYLOAD_KEY
)
  throw new Error('Provisioning test environment required');
const owner = createDatabase(process.env.MIGRATION_DATABASE_URL);
const runtime = database();
const suffix = randomBytes(8).toString('hex');
const admin = {
  id: `platform-${suffix}`,
  emailVerified: true,
  twoFactorEnabled: true,
};
const recipientId = `invitee-${suffix}`;
const email = `invitee-${suffix}@example.invalid`;
let orgId = '';
let invitationId = '';
let token = '';
const createdOrganizations: string[] = [];

after(async () => {
  await owner.platformAudit.deleteMany({
    where: { organizationId: { in: createdOrganizations } },
  });
  await owner.outboxEvent.deleteMany({
    where: { organizationId: { in: createdOrganizations } },
  });
  await owner.organizationInvitation.deleteMany({
    where: { organizationId: { in: createdOrganizations } },
  });
  await owner.organizationMembership.deleteMany({
    where: { organizationId: { in: createdOrganizations } },
  });
  await owner.organization.deleteMany({
    where: { id: { in: createdOrganizations } },
  });
  await owner.person.deleteMany({
    where: { userId: { in: [admin.id, recipientId] } },
  });
  await owner.user.deleteMany({
    where: { id: { in: [admin.id, recipientId] } },
  });
  await runtime.$disconnect();
  await owner.$disconnect();
});

test('platform provisioning and asynchronous recovery', async (t) => {
  await owner.user.create({
    data: {
      id: admin.id,
      email: `platform-${suffix}@example.invalid`,
      name: 'Synthetic platform admin',
      emailVerified: true,
      twoFactorEnabled: true,
    },
  });
  await owner.user.create({
    data: {
      id: recipientId,
      email,
      name: 'Synthetic invitee',
      emailVerified: true,
    },
  });
  await owner.platformRole.create({
    data: { userId: admin.id, role: 'super_admin' },
  });

  await t.test('platform role and MFA are required independently', async () => {
    await assert.rejects(
      listOrganizations({ ...admin, twoFactorEnabled: false }, '', 1),
      /due fattori/,
    );
    await assert.rejects(
      listOrganizations(
        { id: 'demo-user-a', emailVerified: true, twoFactorEnabled: true },
        '',
        1,
      ),
      /Accesso/,
    );
  });
  await t.test(
    'organization, invitation, encrypted outbox and audit are atomic',
    async () => {
      const created = await createOrganization(admin, {
        name: `Organizzazione ${suffix}`,
        slug: `org-${suffix}`,
        contactEmail: email,
        adminEmail: email,
      });
      orgId = created.id;
      createdOrganizations.push(orgId);
      const inv = await owner.organizationInvitation.findFirstOrThrow({
        where: { organizationId: orgId },
      });
      invitationId = inv.id;
      const event = await owner.outboxEvent.findFirstOrThrow({
        where: { invitationId: inv.id },
      });
      const payload = event.payload as { encryptedToken: string };
      token = openToken(payload.encryptedToken, process.env.JOB_PAYLOAD_KEY!);
      assert.equal(inv.tokenHash, tokenHash(token));
      assert.equal(JSON.stringify(event).includes(token), false);
      assert.equal((await organizationAudit(admin, orgId)).length, 2);
      await assert.rejects(
        createOrganization(admin, {
          name: 'Duplicate',
          slug: `org-${suffix}`,
          contactEmail: email,
          adminEmail: email,
        }),
      );
      assert.equal(
        (await listOrganizations(admin, `org-${suffix}`, 1)).total,
        1,
      );
      const exposed = JSON.stringify(
        await listOrganizations(admin, `org-${suffix}`, 1),
      );
      assert.equal(exposed.includes(token), false);
      assert.equal(exposed.includes('tokenHash'), false);
      assert.equal(exposed.includes('encryptedToken'), false);
    },
  );
  await t.test(
    'failed invitation preparation rolls back organization creation',
    async () => {
      const key = process.env.JOB_PAYLOAD_KEY;
      delete process.env.JOB_PAYLOAD_KEY;
      try {
        await assert.rejects(
          createOrganization(admin, {
            name: 'Rollback test',
            slug: `rollback-${suffix}`,
            contactEmail: email,
            adminEmail: email,
          }),
        );
        assert.equal(
          await owner.organization.findUnique({
            where: { slug: `rollback-${suffix}` },
          }),
          null,
        );
      } finally {
        process.env.JOB_PAYLOAD_KEY = key;
      }
    },
  );
  await t.test(
    'outbox survives worker downtime, retries and deduplicates completed jobs',
    async () => {
      let delivered = 0;
      let attempts = 0;
      const event = await owner.outboxEvent.findFirstOrThrow({
        where: { invitationId },
      });
      const worker = startRuntime({
        databaseUrl: process.env.WORKER_DATABASE_URL!,
        redisUrl: process.env.REDIS_URL!,
        encryptionKey: process.env.JOB_PAYLOAD_KEY!,
        appUrl: 'http://127.0.0.1:3000',
        queue: `test-${suffix}`,
        pollMilliseconds: 50,
        sendEmail: async (message) => {
          if (message.to !== email) {
            await sendEmail(message, {
              transport: 'smtp',
              host: '127.0.0.1',
              port: Number(process.env.SMTP_PORT),
              from: 'lumio@example.invalid',
              region: 'eu-central-1',
            });
            return;
          }
          attempts++;
          if (attempts === 1) throw new Error('Synthetic transient failure');
          delivered++;
        },
      });
      try {
        await worker.ready();
        await waitFor(
          async () =>
            (
              await owner.outboxEvent.findUniqueOrThrow({
                where: { id: event.id },
              })
            ).status === 'completed',
        );
        assert.equal(delivered, 1);
        assert.equal(attempts, 2);
        await waitFor(async () => !(await worker.queue.getJob(event.id)));
        await worker.queue.add(
          'organization.invite',
          { outboxId: event.id },
          { jobId: event.id },
        );
        await waitFor(async () => !(await worker.queue.getJob(event.id)));
        assert.equal(delivered, 1);
      } finally {
        await worker.close();
      }
    },
  );
  await t.test('resend invalidates the previous token', async () => {
    await resendInvitation(admin, orgId, invitationId);
    const old = await owner.organizationInvitation.findUniqueOrThrow({
      where: { id: invitationId },
    });
    assert.equal(old.status, 'revoked');
    await assert.rejects(accept(recipientId, token));
    const current = await owner.organizationInvitation.findFirstOrThrow({
      where: { organizationId: orgId, status: 'pending' },
    });
    const event = await owner.outboxEvent.findFirstOrThrow({
      where: { invitationId: current.id },
    });
    invitationId = current.id;
    token = openToken(
      (event.payload as { encryptedToken: string }).encryptedToken,
      process.env.JOB_PAYLOAD_KEY!,
    );
  });
  await t.test(
    'wrong recipient, unverified identity and expired token cannot accept',
    async () => {
      await assert.rejects(accept('demo-user-b', token));
      await owner.user.update({
        where: { id: recipientId },
        data: { emailVerified: false },
      });
      await assert.rejects(accept(recipientId, token));
      await owner.user.update({
        where: { id: recipientId },
        data: { emailVerified: true },
      });
      await owner.organizationInvitation.update({
        where: { id: invitationId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await assert.rejects(accept(recipientId, token));
      await owner.organizationInvitation.update({
        where: { id: invitationId },
        data: { expiresAt: new Date(Date.now() + 3600000) },
      });
    },
  );
  await t.test(
    'suspension blocks invitation acceptance and is audited',
    async () => {
      await changeOrganizationStatus(admin, orgId, {
        status: 'suspended',
        reason: 'Synthetic test suspension',
      });
      await assert.rejects(accept(recipientId, token));
      await changeOrganizationStatus(admin, orgId, {
        status: 'active',
        reason: 'Synthetic test reactivation',
      });
      assert.ok(
        (await organizationAudit(admin, orgId)).some(
          (row) => row.action === 'organization.status_changed',
        ),
      );
    },
  );
  await t.test(
    'concurrent acceptance creates exactly one membership',
    async () => {
      const results = await Promise.allSettled([
        accept(recipientId, token),
        accept(recipientId, token),
      ]);
      assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        1,
      );
      assert.equal(
        await owner.organizationMembership.count({
          where: { organizationId: orgId, userId: recipientId },
        }),
        1,
      );
      await assert.rejects(accept(recipientId, token));
    },
  );
  await t.test(
    'worker cannot read identity credentials or provision organizations',
    async () => {
      const workerDb = createDatabase(process.env.WORKER_DATABASE_URL!);
      try {
        await assert.rejects(workerDb.user.findMany());
        await assert.rejects(workerDb.account.findMany());
        await assert.rejects(workerDb.platformRole.findMany());
        await assert.rejects(
          workerDb.organization.create({
            data: {
              name: 'Forbidden',
              slug: `forbidden-${suffix}`,
              contactEmail: email,
            },
          }),
        );
      } finally {
        await workerDb.$disconnect();
      }
    },
  );
  await t.test(
    'exhausted delivery is visible and resend creates a recoverable new event',
    async () => {
      const failure = await createOrganization(admin, {
        name: 'Synthetic failed delivery',
        slug: `failure-${suffix}`,
        contactEmail: email,
        adminEmail: email,
      });
      createdOrganizations.push(failure.id);
      const inv = await owner.organizationInvitation.findFirstOrThrow({
        where: { organizationId: failure.id },
      });
      const event = await owner.outboxEvent.findFirstOrThrow({
        where: { invitationId: inv.id },
      });
      const worker = startRuntime({
        databaseUrl: process.env.WORKER_DATABASE_URL!,
        redisUrl: process.env.REDIS_URL!,
        encryptionKey: process.env.JOB_PAYLOAD_KEY!,
        appUrl: 'http://127.0.0.1:3000',
        queue: `failure-${suffix}`,
        pollMilliseconds: 100,
        sendEmail: async (message) => {
          if (message.to === email)
            throw new Error('Synthetic delivery unavailable');
          await sendEmail(message, {
            transport: 'smtp',
            host: '127.0.0.1',
            port: Number(process.env.SMTP_PORT),
            from: 'lumio@example.invalid',
            region: 'eu-central-1',
          });
        },
      });
      try {
        await waitFor(
          async () =>
            (
              await owner.outboxEvent.findUniqueOrThrow({
                where: { id: event.id },
              })
            ).status === 'failed',
        );
        const failed = await owner.outboxEvent.findUniqueOrThrow({
          where: { id: event.id },
        });
        assert.equal(failed.attempts, 5);
        assert.equal(failed.lastErrorCode, 'DELIVERY_FAILED');
        assert.equal(
          (await listOrganizations(admin, `failure-${suffix}`, 1))
            .organizations[0].invitations[0].outboxEvents[0].status,
          'failed',
        );
        const replacement = await resendInvitation(admin, failure.id, inv.id);
        assert.notEqual(replacement.id, inv.id);
        assert.equal(
          (
            await owner.organizationInvitation.findUniqueOrThrow({
              where: { id: inv.id },
            })
          ).status,
          'revoked',
        );
      } finally {
        await worker.close();
      }
    },
  );
});

async function accept(userId: string, value: string) {
  return runtime.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id',${userId},true)`;
    return tx.$queryRaw`SELECT accept_organization_invitation(${tokenHash(value)})`;
  });
}
async function waitFor(predicate: () => Promise<boolean>) {
  const deadline = Date.now() + 35000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail('Timed out waiting for worker');
}
