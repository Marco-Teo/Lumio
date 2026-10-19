import { createDatabase } from '@lumio/database';

const globalDatabase = globalThis as typeof globalThis & {
  lumioDatabase?: ReturnType<typeof createDatabase>;
};

export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  globalDatabase.lumioDatabase ??= createDatabase(process.env.DATABASE_URL);
  return globalDatabase.lumioDatabase;
}
