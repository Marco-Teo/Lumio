import { afterEach, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../../../server/database', () => ({
  database: () => ({ $queryRaw: query }),
}));
import { GET } from './route';

afterEach(() => vi.resetAllMocks());
it('reports readiness when PostgreSQL answers', async () => {
  query.mockResolvedValue([{ '?column?': 1 }]);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ status: 'ok' });
});
it('returns 503 without disclosing database errors', async () => {
  query.mockRejectedValue(new Error('private connection information'));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ status: 'unavailable' });
});
