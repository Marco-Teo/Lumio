import { createDatabase, databaseClientShape } from '@lumio/database';

const globalDatabase = globalThis as typeof globalThis & {
  lumioDatabase?: ReturnType<typeof createDatabase>;
  lumioDatabaseShape?: string;
};

export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  // Hot reload can preserve globalThis after the generated Prisma client changes.
  // Bundles may contain different factory identities for the same schema. Only
  // a generated model/field change should replace a shared live connection pool.
  if (
    !globalDatabase.lumioDatabase ||
    globalDatabase.lumioDatabaseShape !== databaseClientShape
  ) {
    const previous = globalDatabase.lumioDatabase;
    globalDatabase.lumioDatabase = createDatabase(process.env.DATABASE_URL);
    globalDatabase.lumioDatabaseShape = databaseClientShape;
    if (previous) void previous.$disconnect().catch(() => {});
  }
  return globalDatabase.lumioDatabase;
}
