import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';

export { Prisma } from './generated/client';
export type { PrismaClient } from './generated/client';

export function createDatabase(connectionString: string) {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 3000,
    }),
  });
}
