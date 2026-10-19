import {
  existsSync,
  readFileSync,
  appendFileSync,
  writeFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';

if (!existsSync('.env') || !existsSync('apps/web/.env.local'))
  throw new Error('Run pnpm env:local first');
const entries = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => [
      line.slice(0, line.indexOf('=')),
      line.slice(line.indexOf('=') + 1),
    ]),
);
const additions: Record<string, string> = {};
if (!entries.WORKER_DATABASE_URL) {
  const url = new URL(entries.DATABASE_URL);
  url.username = 'lumio_worker';
  url.password = randomBytes(32).toString('hex');
  additions.WORKER_DATABASE_URL = url.toString();
}
if (!entries.JOB_PAYLOAD_KEY)
  additions.JOB_PAYLOAD_KEY = randomBytes(32).toString('hex');
if (!entries.REDIS_URL) additions.REDIS_URL = 'redis://127.0.0.1:6379';
if (!entries.WORKER_HEALTH_PORT) additions.WORKER_HEALTH_PORT = '3103';
Object.assign(entries, additions);
if (Object.keys(additions).length)
  appendFileSync(
    '.env',
    '\n' +
      Object.entries(additions)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n') +
      '\n',
  );
if (!/^JOB_PAYLOAD_KEY=/m.test(readFileSync('apps/web/.env.local', 'utf8')))
  appendFileSync(
    'apps/web/.env.local',
    `\nJOB_PAYLOAD_KEY=${entries.JOB_PAYLOAD_KEY}\n`,
  );
const keys = [
  'WORKER_DATABASE_URL',
  'JOB_PAYLOAD_KEY',
  'REDIS_URL',
  'APP_URL',
  'MAIL_TRANSPORT',
  'SMTP_HOST',
  'SMTP_PORT',
  'EMAIL_FROM',
  'AWS_REGION',
  'WORKER_HEALTH_PORT',
  'LUMIO_LOCAL_TEST',
];
const workerFile = 'apps/worker/.env.local';
if (!existsSync(workerFile))
  writeFileSync(
    workerFile,
    keys
      .filter((key) => entries[key])
      .map((key) => `${key}=${entries[key]}`)
      .join('\n') + '\n',
  );
console.log(
  'Worker configuration prepared without exposing credentials. Existing worker configuration preserved.',
);
