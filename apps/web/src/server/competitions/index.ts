import { z } from 'zod';
import { Prisma } from '@lumio/database';
import { database } from '../database';
import { AccessError } from '../authorization';
import { requireAdministrativeMfa } from '../authorization/administration';
import { withOrganization } from '../tenancy';
import {
  contestSchema,
  editionSchema,
  publicationIssues,
  type EditionConfiguration,
} from '../../lib/competitions';

export type CompetitionActor = {
  id: string;
  emailVerified: boolean;
  twoFactorEnabled?: boolean | null;
};
export class CompetitionError extends Error {
  constructor(
    public readonly status: 400 | 409,
    message: string,
  ) {
    super(message);
  }
}
function requireActor(actor: CompetitionActor) {
  if (!actor.emailVerified) throw new AccessError(403);
  requireAdministrativeMfa(actor);
}
export async function organizationMemberships(userId: string) {
  return database().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    const memberships = await tx.organizationMembership.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const organizations: Array<{ id: string; name: string; status: string }> =
      [];
    for (const membership of memberships) {
      await tx.$executeRaw`SELECT set_config('app.organization_id', ${membership.organizationId}, true)`;
      const organization = await tx.organization.findUnique({
        where: { id: membership.organizationId },
        select: { id: true, name: true, status: true },
      });
      if (organization) organizations.push(organization);
    }
    return organizations;
  });
}
export async function manage<T>(
  actor: CompetitionActor,
  organizationId: string,
  action: (tx: Prisma.TransactionClient, membershipId: string) => Promise<T>,
) {
  requireActor(actor);
  return withOrganization(actor.id, organizationId, async (tx, membership) => {
    if (membership.role !== 'admin') throw new AccessError(403);
    // Serialize with platform suspension; all writes use org -> edition lock order.
    const rows = await tx.$queryRaw<
      Array<{ status: string }>
    >`SELECT status FROM organization WHERE id=${organizationId} FOR SHARE`;
    if (rows[0]?.status !== 'active') throw new AccessError(403);
    return action(tx, membership.id);
  });
}
async function audit(
  tx: Prisma.TransactionClient,
  actor: CompetitionActor,
  organizationId: string,
  membershipId: string,
  action: string,
  entityId: string,
  before: Prisma.InputJsonValue,
  after: Prisma.InputJsonValue,
) {
  await tx.auditEvent.create({
    data: {
      organizationId,
      actorUserId: actor.id,
      actorMembershipId: membershipId,
      action,
      entityId,
      before,
      after,
    },
  });
}
export async function listCompetitions(
  actor: CompetitionActor,
  organizationId: string,
) {
  return manage(actor, organizationId, async (tx) => ({
    organization: await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { id: true, name: true },
    }),
    contests: await tx.contest.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        coverVersion: true,
        editions: {
          orderBy: { createdAt: 'desc' },
          include: {
            revisions: {
              orderBy: { version: 'desc' },
              select: { version: true, createdAt: true, configuration: true },
            },
          },
        },
      },
    }),
  }));
}
export async function saveContest(
  actor: CompetitionActor,
  organizationId: string,
  input: unknown,
  contestId?: string,
) {
  const data = contestSchema.parse(input);
  return manage(actor, organizationId, async (tx, membershipId) => {
    const before = contestId
      ? await tx.contest.findFirst({
          where: { id: contestId, organizationId },
          select: { id: true, name: true, slug: true, description: true },
        })
      : null;
    if (contestId && !before) throw new AccessError(404);
    const contest = contestId
      ? await tx.contest.update({
          where: { id: contestId },
          data,
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            coverVersion: true,
          },
        })
      : await tx.contest.create({
          data: { ...data, organizationId },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            coverVersion: true,
          },
        });
    await audit(
      tx,
      actor,
      organizationId,
      membershipId,
      contestId ? 'contest.updated' : 'contest.created',
      contest.id,
      before
        ? {
            name: before.name,
            slug: before.slug,
            description: before.description,
          }
        : {},
      data,
    );
    return contest;
  });
}
export async function saveEdition(
  actor: CompetitionActor,
  organizationId: string,
  contestId: string,
  input: unknown,
  editionId?: string,
) {
  const parsed = z
    .object({
      version: z.number().int().positive().optional(),
      configuration: editionSchema,
    })
    .strict()
    .parse(input);
  const config = parsed.configuration;
  return manage(actor, organizationId, async (tx, membershipId) => {
    if (
      !(await tx.contest.findFirst({
        where: { id: contestId, organizationId },
      }))
    )
      throw new AccessError(404);
    const previous = editionId
      ? await lockedEdition(tx, organizationId, contestId, editionId)
      : null;
    if (
      previous &&
      (previous.status !== 'draft' || parsed.version !== previous.version)
    )
      throw new CompetitionError(
        409,
        'La bozza è cambiata o non è più modificabile. Ricarica la pagina.',
      );
    const version = (previous?.version ?? 0) + 1;
    const edition = previous
      ? await tx.edition.update({
          where: { id: previous.id },
          data: {
            name: config.name,
            slug: config.slug,
            identifier: config.identifier,
            version,
          },
        })
      : await tx.edition.create({
          data: {
            organizationId,
            contestId,
            name: config.name,
            slug: config.slug,
            identifier: config.identifier,
            version,
          },
        });
    await tx.section.deleteMany({
      where: { organizationId, editionId: edition.id },
    });
    if (config.sections.length)
      await tx.section.createMany({
        data: config.sections.map((section, position) => ({
          ...section,
          organizationId,
          editionId: edition.id,
          position,
        })),
      });
    await tx.editionRevision.create({
      data: {
        organizationId,
        editionId: edition.id,
        version,
        configuration: config,
        actorUserId: actor.id,
      },
    });
    await audit(
      tx,
      actor,
      organizationId,
      membershipId,
      previous ? 'edition.configured' : 'edition.created',
      edition.id,
      previous ? { version: previous.version } : {},
      { version, configuration: config },
    );
    return edition;
  });
}
async function lockedEdition(
  tx: Prisma.TransactionClient,
  organizationId: string,
  contestId: string,
  editionId: string,
) {
  await tx.$queryRaw`SELECT id FROM edition WHERE id=${editionId} AND "organizationId"=${organizationId} AND "contestId"=${contestId} FOR UPDATE`;
  const edition = await tx.edition.findFirst({
    where: { id: editionId, organizationId, contestId },
  });
  if (!edition) throw new AccessError(404);
  return edition;
}
export async function transitionEdition(
  actor: CompetitionActor,
  organizationId: string,
  contestId: string,
  editionId: string,
  input: unknown,
) {
  const data = z
    .object({
      version: z.number().int().positive(),
      status: z.enum(['published', 'archived']),
    })
    .strict()
    .parse(input);
  return manage(actor, organizationId, async (tx, membershipId) => {
    const edition = await lockedEdition(
      tx,
      organizationId,
      contestId,
      editionId,
    );
    if (
      edition.version !== data.version ||
      (data.status === 'published'
        ? edition.status !== 'draft'
        : edition.status !== 'published')
    )
      throw new CompetitionError(
        409,
        'Transizione non consentita o configurazione cambiata.',
      );
    if (data.status === 'published') {
      const revision = await tx.editionRevision.findUniqueOrThrow({
        where: {
          organizationId_editionId_version: {
            organizationId,
            editionId,
            version: edition.version,
          },
        },
      });
      const issues = publicationIssues(
        editionSchema.parse(revision.configuration),
      );
      if (issues.length) throw new CompetitionError(400, issues.join(' '));
    }
    const updated = await tx.edition.update({
      where: { id: edition.id },
      data: {
        status: data.status,
        ...(data.status === 'published' ? { publishedAt: new Date() } : {}),
      },
    });
    await audit(
      tx,
      actor,
      organizationId,
      membershipId,
      `edition.${data.status}`,
      editionId,
      { status: edition.status },
      { status: data.status, version: edition.version },
    );
    return updated;
  });
}
export function configurationFromJson(value: unknown): EditionConfiguration {
  return editionSchema.parse(value);
}
