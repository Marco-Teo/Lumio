import { createDatabase } from '@lumio/database';
if (!process.env.MIGRATION_DATABASE_URL)
  throw new Error('Operator database credentials required');
const db = createDatabase(process.env.MIGRATION_DATABASE_URL);
try {
  const event = await db.outboxEvent.create({
    data: { type: 'system.ping', payload: {} },
  });
  console.log(`Technical job queued: ${event.id}`);
} finally {
  await db.$disconnect();
}
