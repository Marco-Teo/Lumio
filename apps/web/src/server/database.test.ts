import { afterEach, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  client: { $disconnect: vi.fn().mockResolvedValue(undefined) },
  create: vi.fn(),
}));
vi.mock('@lumio/database', () => ({
  createDatabase: fixture.create,
  databaseClientShape: 'synthetic-shape-v1',
}));

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'lumioDatabase');
  Reflect.deleteProperty(globalThis, 'lumioDatabaseShape');
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it('replaces a client left in the global cache by an earlier generated schema', async () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://example.invalid/lumio');
  const stale = { $disconnect: vi.fn().mockResolvedValue(undefined) };
  Reflect.set(globalThis, 'lumioDatabase', stale);
  fixture.create.mockReturnValue(fixture.client);
  const { database } = await import('./database');
  expect(database()).toBe(fixture.client);
  expect(stale.$disconnect).toHaveBeenCalledOnce();
  expect(fixture.create).toHaveBeenCalledOnce();
});

it('reuses the current pool across repeated calls and module reloads', async () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://example.invalid/lumio');
  fixture.create.mockReturnValue(fixture.client);
  const { database } = await import('./database');
  expect(database()).toBe(fixture.client);
  vi.resetModules();
  const reloaded = await import('./database');
  expect(reloaded.database()).toBe(fixture.client);
  expect(fixture.create).toHaveBeenCalledOnce();
  expect(fixture.client.$disconnect).not.toHaveBeenCalled();
});
it('keeps an equivalent client alive even when a server bundle has another factory', async () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://example.invalid/lumio');
  Reflect.set(globalThis, 'lumioDatabase', fixture.client);
  Reflect.set(globalThis, 'lumioDatabaseShape', 'synthetic-shape-v1');
  const { database } = await import('./database');
  expect(database()).toBe(fixture.client);
  expect(fixture.create).not.toHaveBeenCalled();
  expect(fixture.client.$disconnect).not.toHaveBeenCalled();
});
