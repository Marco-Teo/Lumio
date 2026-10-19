import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@lumio/database';
import { sealToken, tokenHash } from '@lumio/jobs';
import { database } from '../database';
import { AccessError } from '../authorization';
import { requireAdministrativeMfa } from '../authorization/administration';

export const provisionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  contactEmail: z.email().trim().toLowerCase(),
  adminEmail: z.email().trim().toLowerCase(),
});
export const statusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: z.string().trim().min(5).max(500),
});
export class ProvisioningError extends Error {
  constructor(
    public readonly status: 400 | 409,
    message: string,
  ) {
    super(message);
  }
}
type Actor = {
  id: string;
  emailVerified: boolean;
  twoFactorEnabled?: boolean | null;
};

export async function hasPlatformRole(userId: string) {
  return database().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    return Boolean(
      await tx.platformRole.findUnique({
        where: { userId_role: { userId, role: 'super_admin' } },
      }),
    );
  });
}

export async function withPlatform<T>(
  actor: Actor,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  if (!actor.emailVerified) throw new AccessError(403);
  requireAdministrativeMfa({
    twoFactorEnabled: actor.twoFactorEnabled ?? false,
  });
  return database().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${actor.id}, true)`;
    const [allowed] = await tx.$queryRaw<
      Array<{ allowed: boolean }>
    >`SELECT is_platform_admin() AS allowed`;
    if (!allowed.allowed) throw new AccessError(403);
    return action(tx);
  });
}

async function record(
  tx: Prisma.TransactionClient,
  actorId: string,
  organizationId: string,
  action: string,
  entityId: string,
  before?: Prisma.InputJsonValue,
  after?: Prisma.InputJsonValue,
) {
  return tx.platformAudit.create({
    data: {
      actorUserId: actorId,
      organizationId,
      action,
      entityId,
      before,
      after,
    },
  });
}

async function invite(
  tx: Prisma.TransactionClient,
  organizationId: string,
  email: string,
) {
  const key = process.env.JOB_PAYLOAD_KEY;
  if (!key) throw new Error('JOB_PAYLOAD_KEY required');
  const token = randomBytes(32).toString('base64url');
  const invitation = await tx.organizationInvitation.create({
    data: {
      organizationId,
      email,
      tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    },
  });
  await tx.outboxEvent.create({
    data: {
      organizationId,
      invitationId: invitation.id,
      type: 'organization.invite',
      payload: { encryptedToken: sealToken(token, key) },
    },
  });
  return invitation;
}

export async function createOrganization(actor: Actor, input: unknown) {
  const data = provisionSchema.parse(input);
  return withPlatform(actor, async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        contactEmail: data.contactEmail,
      },
    });
    const invitation = await invite(tx, organization.id, data.adminEmail);
    await record(
      tx,
      actor.id,
      organization.id,
      'organization.created',
      organization.id,
      undefined,
      { name: data.name, slug: data.slug, contactEmail: data.contactEmail },
    );
    await record(
      tx,
      actor.id,
      organization.id,
      'invitation.created',
      invitation.id,
      undefined,
      { email: data.adminEmail },
    );
    return { id: organization.id };
  });
}

export async function listOrganizations(
  actor: Actor,
  query: string,
  page: number,
) {
  const q = z.string().trim().max(100).parse(query);
  const currentPage = z.number().int().min(1).max(10000).parse(page);
  return withPlatform(actor, async (tx) => {
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { slug: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [total, organizations] = await Promise.all([
      tx.organization.count({ where }),
      tx.organization.findMany({
        where,
        skip: (currentPage - 1) * 20,
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          contactEmail: true,
          _count: { select: { memberships: true } },
          invitations: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              email: true,
              status: true,
              expiresAt: true,
              outboxEvents: {
                select: { status: true, attempts: true, lastErrorCode: true },
              },
            },
          },
        },
      }),
    ]);
    return { total, page: currentPage, organizations };
  });
}

export async function changeOrganizationStatus(
  actor: Actor,
  id: string,
  input: unknown,
) {
  const data = statusSchema.parse(input);
  return withPlatform(actor, async (tx) => {
    await tx.$queryRaw`SELECT id FROM organization WHERE id=${id} FOR UPDATE`;
    const organization = await tx.organization.findUnique({ where: { id } });
    if (!organization) throw new AccessError(404);
    if (organization.status === data.status) return { id };
    await tx.organization.update({
      where: { id },
      data: { status: data.status },
    });
    await record(
      tx,
      actor.id,
      id,
      'organization.status_changed',
      id,
      { status: organization.status },
      { status: data.status, reason: data.reason },
    );
    return { id };
  });
}

export async function resendInvitation(
  actor: Actor,
  organizationId: string,
  invitationId: string,
) {
  return withPlatform(actor, async (tx) => {
    await tx.$queryRaw`SELECT id FROM organization WHERE id=${organizationId} FOR UPDATE`;
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization || organization.status !== 'active')
      throw new AccessError(403);
    const previous = await tx.organizationInvitation.findFirst({
      where: { id: invitationId, organizationId },
    });
    if (!previous || previous.status !== 'pending')
      throw new ProvisioningError(
        409,
        'Questo invito non può essere reinviato',
      );
    await tx.organizationInvitation.update({
      where: { id: previous.id },
      data: { status: 'revoked' },
    });
    await tx.outboxEvent.updateMany({
      where: {
        invitationId: previous.id,
        status: { in: ['pending', 'queued', 'failed'] },
      },
      data: { status: 'cancelled' },
    });
    const next = await invite(tx, organizationId, previous.email);
    await record(
      tx,
      actor.id,
      organizationId,
      'invitation.resent',
      next.id,
      { invitationId: previous.id },
      { invitationId: next.id },
    );
    return { id: next.id };
  });
}

export async function organizationAudit(actor: Actor, organizationId: string) {
  return withPlatform(actor, (tx) =>
    tx.platformAudit.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 50,
      select: {
        id: true,
        action: true,
        actorKind: true,
        actorUserId: true,
        before: true,
        after: true,
        createdAt: true,
      },
    }),
  );
}
