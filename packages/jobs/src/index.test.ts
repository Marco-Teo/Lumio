import { randomBytes } from 'node:crypto';
import { expect, it } from 'vitest';
import { openToken, sealToken, tokenHash, redisConnection } from './index';

it('protects outbox tokens and detects tampering', () => {
  const token = randomBytes(32).toString('base64url');
  const key = randomBytes(32).toString('hex');
  const encrypted = sealToken(token, key);
  expect(encrypted).not.toContain(token);
  expect(openToken(encrypted, key)).toBe(token);
  expect(() => openToken(encrypted, randomBytes(32).toString('hex'))).toThrow();
  const parts = encrypted.split('.');
  parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
  expect(() => openToken(parts.join('.'), key)).toThrow();
  expect(tokenHash(token)).toMatch(/^[a-f0-9]{64}$/);
});
it('requires a random encryption key and Redis protocols', () => {
  expect(() => sealToken('token', 'short')).toThrow();
  expect(() => redisConnection('https://example.invalid')).toThrow();
  expect(
    redisConnection('rediss://default:example@localhost:6379'),
  ).toMatchObject({
    host: 'localhost',
    port: 6379,
    tls: {},
    maxRetriesPerRequest: 1,
  });
  expect(redisConnection('redis://localhost', true)).toMatchObject({
    maxRetriesPerRequest: null,
  });
});
