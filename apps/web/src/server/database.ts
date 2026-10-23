import { createDatabase } from '@lumio/database';

const globalDatabase = globalThis as typeof globalThis & {
  lumioDatabase?: ReturnType<typeof createDatabase>;
  lumioDatabaseFactory?: typeof createDatabase;
};

export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  // Hot reload can preserve globalThis after the generated Prisma client changes.
  // Reuse the pool only while it belongs to the currently loaded client factory.
  if (
    !globalDatabase.lumioDatabase ||
    globalDatabase.lumioDatabaseFactory !== createDatabase
  ) {
    const previous = globalDatabase.lumioDatabase;
    globalDatabase.lumioDatabase = createDatabase(process.env.DATABASE_URL);
    globalDatabase.lumioDatabaseFactory = createDatabase;
    if (previous) void previous.$disconnect().catch(() => {});
  }
  return globalDatabase.lumioDatabase;
}
