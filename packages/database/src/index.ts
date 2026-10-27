import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from './generated/client';

export { Prisma };
// Public generated scalar enums are stable across server bundles, unlike a
// factory function's identity. New models/fields invalidate development caches.
export const databaseClientShape = JSON.stringify(
  Object.entries(Prisma)
    .filter(([name]) => name.endsWith('ScalarFieldEnum'))
    .sort(([a], [b]) => a.localeCompare(b)),
);
export type { PrismaClient } from './generated/client';

export function createDatabase(connectionString: string) {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 3000,
      options: '-c timezone=UTC',
    }),
  });
}
