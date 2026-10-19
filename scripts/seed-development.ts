import { createDatabase } from '@lumio/database';

if (process.env.NODE_ENV === 'production')
  throw new Error('Development seed is forbidden in production');
if (!process.env.MIGRATION_DATABASE_URL)
  throw new Error('MIGRATION_DATABASE_URL required');
const db = createDatabase(process.env.MIGRATION_DATABASE_URL);
try {
  for (const suffix of ['a', 'b']) {
    const userId = `demo-user-${suffix}`;
    await db.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        name: `Demo ${suffix.toUpperCase()}`,
        email: `demo-${suffix}@example.invalid`,
        emailVerified: true,
      },
      update: {},
    });
    await db.organization.upsert({
      where: { id: `demo-org-${suffix}` },
      create: {
        id: `demo-org-${suffix}`,
        name: `Organizzazione demo ${suffix.toUpperCase()}`,
        slug: `demo-${suffix}`,
        contactEmail: `org-${suffix}@example.invalid`,
      },
      update: {},
    });
    await db.organizationMembership.upsert({
      where: {
        organizationId_userId: { organizationId: `demo-org-${suffix}`, userId },
      },
      create: {
        id: `demo-membership-${suffix}`,
        organizationId: `demo-org-${suffix}`,
        userId,
      },
      update: {},
    });
  }
  console.log(
    'Two synthetic organizations created. Demo identities have no password and cannot sign in.',
  );
} finally {
  await db.$disconnect();
}
