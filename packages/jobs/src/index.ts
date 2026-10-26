import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { z } from 'zod';

export const queueName = 'lumio-provisioning';
export const jobPayloadSchema = z.object({ outboxId: z.uuid() });
export const invitePayloadSchema = z.object({
  encryptedToken: z.string().min(10),
});
export const registrationReceiptSchema = z
  .object({
    registrationId: z.uuid(),
    to: z.email(),
    organizationName: z.string().min(1),
    contestName: z.string().min(1),
    editionName: z.string().min(1),
    contactEmail: z.email(),
  })
  .strict();
export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
function encryptionKey(value: string) {
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw new Error('JOB_PAYLOAD_KEY must be 32 random bytes encoded as hex');
  return Buffer.from(value, 'hex');
}
export function sealToken(token: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(key), iv);
  const body = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body]
    .map((part) => part.toString('base64url'))
    .join('.');
}
export function openToken(value: string, key: string) {
  const parts = value.split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted payload');
  const [iv, tag, body] = parts.map((part) => Buffer.from(part, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', encryptionKey(key), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(body), cipher.final()]).toString('utf8');
}
export function redisConnection(url: string, blocking = false) {
  const parsed = new URL(url);
  if (!['redis:', 'rediss:'].includes(parsed.protocol))
    throw new Error('Invalid Redis protocol');
  if (!/^\/?\d*$/.test(parsed.pathname))
    throw new Error('Invalid Redis database');
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: Number(parsed.pathname.slice(1) || 0),
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: blocking ? null : 1,
    enableOfflineQueue: blocking,
    connectTimeout: 3000,
    retryStrategy: (attempt: number) => Math.min(attempt * 100, 5000),
  };
}
