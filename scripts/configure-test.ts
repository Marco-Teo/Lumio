import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { assertTestEnvironment } from './testing/environment';
if (process.env.NODE_ENV === 'production')
  throw new Error('Test setup is forbidden in production');
if (existsSync('.env.test.local'))
  throw new Error(
    'Test configuration already exists; it will not be overwritten',
  );
const entries: Record<string, string> = process.env.CI
  ? {}
  : Object.fromEntries(
      readFileSync('.env', 'utf8')
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const i = line.indexOf('=');
          return [line.slice(0, i), line.slice(i + 1)];
        }),
    );
const env: Record<string, string> = {};
for (const key of [
  'ADMIN_DATABASE_URL',
  'MIGRATION_DATABASE_URL',
  'DATABASE_URL',
  'WORKER_DATABASE_URL',
]) {
  const url = new URL(entries[key] ?? process.env[key] ?? '');
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !['/lumio', '/lumio_test'].includes(url.pathname) ||
    url.search ||
    url.hash
  )
    throw new Error('Test setup only accepts known local databases');
  url.pathname = '/lumio_test';
  env[key] = url.toString();
}
Object.assign(env, {
  LUMIO_TEST_MODE: '1',
  LUMIO_LOCAL_TEST: '1',
  APP_URL: 'http://127.0.0.1:3100',
  REDIS_URL: 'redis://127.0.0.1:6379/15',
  MAIL_TRANSPORT: 'smtp',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1026',
  MAILPIT_URL: 'http://127.0.0.1:8026',
  EMAIL_FROM: 'lumio-test@example.invalid',
  WORKER_HEALTH_PORT: '3102',
  BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
  JOB_PAYLOAD_KEY: randomBytes(32).toString('hex'),
  NEXT_TELEMETRY_DISABLED: '1',
});
assertTestEnvironment(env);
writeFileSync(
  '.env.test.local',
  Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n') + '\n',
  { mode: 0o600 },
);
console.log(
  'Isolated test configuration created. No development files changed.',
);
