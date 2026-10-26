import { expect, it } from 'vitest';
import { assertTestEnvironment } from './environment';
const env = {
  LUMIO_TEST_MODE: '1',
  LUMIO_LOCAL_TEST: '1',
  ADMIN_DATABASE_URL: 'postgresql://admin:synthetic@127.0.0.1:5432/lumio_test',
  MIGRATION_DATABASE_URL:
    'postgresql://migrator:synthetic@127.0.0.1:5432/lumio_test',
  DATABASE_URL: 'postgresql://runtime:synthetic@127.0.0.1:5432/lumio_test',
  WORKER_DATABASE_URL:
    'postgresql://worker:synthetic@127.0.0.1:5432/lumio_test',
  APP_URL: 'http://127.0.0.1:3100',
  REDIS_URL: 'redis://127.0.0.1:6379/15',
  MAILPIT_URL: 'http://127.0.0.1:8026',
  MAIL_TRANSPORT: 'smtp',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1026',
  EMAIL_FROM: 'lumio-test@example.invalid',
};
it('accepts only the isolated local test environment', () => {
  expect(() => assertTestEnvironment(env)).not.toThrow();
});
it.each([
  { DATABASE_URL: 'postgresql://runtime:synthetic@127.0.0.1:5432/lumio' },
  {
    DATABASE_URL:
      'postgresql://runtime:synthetic@db.production.invalid/lumio_test',
  },
  {
    MIGRATION_DATABASE_URL:
      'postgresql://migrator:synthetic@127.0.0.1:5432/production',
  },
  { MAIL_TRANSPORT: 'ses' },
  { SMTP_PORT: '1025' },
  { SMTP_HOST: 'smtp.production.invalid' },
  { REDIS_URL: 'redis://127.0.0.1:6379/0' },
  { MAILPIT_URL: 'http://127.0.0.1:8025' },
  { LUMIO_TEST_MODE: '0' },
  { NODE_ENV: 'production' },
])('refuses unsafe configuration before connecting: %j', (patch) => {
  expect(() => assertTestEnvironment({ ...env, ...patch })).toThrow(
    /Unsafe test environment/,
  );
});
