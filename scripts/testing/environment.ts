type Environment = Record<string, string | undefined>;
const loopback = (host: string) =>
  ['127.0.0.1', 'localhost', '[::1]'].includes(host);
export function assertTestEnvironment(env: Environment) {
  const fail = () => {
    throw new Error(
      'Unsafe test environment: use isolated local lumio_test database, Redis DB 15 and test Mailpit (SMTP 1026 / HTTP 8026). Remote services and production email are forbidden.',
    );
  };
  if (env.LUMIO_TEST_MODE !== '1' || env.NODE_ENV === 'production') fail();
  for (const key of [
    'ADMIN_DATABASE_URL',
    'MIGRATION_DATABASE_URL',
    'DATABASE_URL',
    'WORKER_DATABASE_URL',
  ]) {
    let url: URL;
    try {
      url = new URL(env[key] ?? '');
    } catch {
      fail();
      return;
    }
    if (
      !['postgresql:', 'postgres:'].includes(url.protocol) ||
      !loopback(url.hostname) ||
      url.pathname !== '/lumio_test' ||
      url.search ||
      url.hash
    )
      fail();
  }
  const app = new URL(env.APP_URL ?? 'https://invalid.invalid');
  const redis = new URL(env.REDIS_URL ?? 'https://invalid.invalid');
  const inbox = new URL(env.MAILPIT_URL ?? 'https://invalid.invalid');
  if (
    app.origin !== 'http://127.0.0.1:3100' ||
    redis.protocol !== 'redis:' ||
    !loopback(redis.hostname) ||
    redis.pathname !== '/15' ||
    redis.search ||
    redis.hash ||
    inbox.origin !== 'http://127.0.0.1:8026'
  )
    fail();
  if (
    env.MAIL_TRANSPORT !== 'smtp' ||
    env.SMTP_HOST !== '127.0.0.1' ||
    env.SMTP_PORT !== '1026' ||
    env.EMAIL_FROM !== 'lumio-test@example.invalid' ||
    env.LUMIO_LOCAL_TEST !== '1'
  )
    fail();
}
