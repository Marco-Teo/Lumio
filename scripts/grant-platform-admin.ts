import { createDatabase } from '@lumio/database';
import { z } from 'zod';

const email = z.email().trim().toLowerCase().parse(process.argv[2]);
if (!process.env.MIGRATION_DATABASE_URL)
  throw new Error('Migration credentials required for this operator command');
const db = createDatabase(process.env.MIGRATION_DATABASE_URL);
try {
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email } });
    if (!user || !user.emailVerified)
      throw new Error(
        'The account must already exist and have a verified email',
      );
    const existing = await tx.platformRole.findUnique({
      where: { userId_role: { userId: user.id, role: 'super_admin' } },
    });
    if (existing) {
      console.log('Platform privilege already assigned');
      return;
    }
    await tx.platformRole.create({
      data: { userId: user.id, role: 'super_admin' },
    });
    await tx.platformAudit.create({
      data: {
        actorKind: 'operator',
        action: 'platform_role.granted',
        entityId: user.id,
        after: { role: 'super_admin' },
      },
    });
    console.log(
      'Platform privilege assigned. MFA is required before console access.',
    );
  });
} finally {
  await db.$disconnect();
}
