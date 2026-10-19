import { afterEach, expect, it, vi } from 'vitest';
import { authenticationEnvironment } from './environment';

afterEach(() => vi.unstubAllEnvs());
function localEnvironment() {
  vi.stubEnv(
    'JOB_PAYLOAD_KEY',
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  );
  vi.stubEnv(
    'DATABASE_URL',
    'postgresql://example:example@localhost:5432/example',
  );
  vi.stubEnv(
    'BETTER_AUTH_SECRET',
    'synthetic-test-value-longer-than-thirty-two-characters',
  );
  vi.stubEnv('APP_URL', 'http://127.0.0.1:3000');
  vi.stubEnv('MAIL_TRANSPORT', 'smtp');
  vi.stubEnv('SMTP_HOST', '127.0.0.1');
  vi.stubEnv('LUMIO_LOCAL_TEST', '');
}
it('requires a sufficiently long auth secret', () => {
  localEnvironment();
  vi.stubEnv('BETTER_AUTH_SECRET', 'short');
  expect(() => authenticationEnvironment()).toThrow('incomplete or invalid');
});
it('prevents local SMTP settings from being used in remote production', () => {
  localEnvironment();
  vi.stubEnv('NODE_ENV', 'production');
  expect(() => authenticationEnvironment()).toThrow(
    'Production requires HTTPS and SES',
  );
});
it('rejects arbitrary SMTP hosts', () => {
  localEnvironment();
  vi.stubEnv('SMTP_HOST', 'external.example.invalid');
  expect(() => authenticationEnvironment()).toThrow('restricted');
});
