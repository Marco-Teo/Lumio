import type { Prisma } from '@lumio/database';
import { database } from '../database';
import { AccessError } from '../authorization';

export async function withOrganization<T>(
  userId: string,
  organizationId: string,
  action: (
    tx: Prisma.TransactionClient,
    membership: { id: string; role: string },
  ) => Promise<T>,
) {
  return database().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;
    const membership = await tx.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) throw new AccessError(404);
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization || organization.status !== 'active')
      throw new AccessError(403);
    return action(tx, membership);
  });
}
