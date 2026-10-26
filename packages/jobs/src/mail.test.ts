import { afterEach, expect, it, vi } from 'vitest';
import { sendEmail, type MailConfiguration } from './mail';
afterEach(() => vi.unstubAllEnvs());
const config: MailConfiguration = {
  transport: 'smtp',
  host: '127.0.0.1',
  port: 1026,
  from: 'lumio-test@example.invalid',
  region: 'eu-central-1',
};
it.each([
  { to: 'real@example.com', config },
  {
    to: 'synthetic@example.invalid',
    config: { ...config, transport: 'ses' as const },
  },
  { to: 'synthetic@example.invalid', config: { ...config, port: 1025 } },
])(
  'blocks unsafe test email before contacting a transport',
  async (fixture) => {
    vi.stubEnv('LUMIO_TEST_MODE', '1');
    await expect(
      sendEmail(
        { to: fixture.to, subject: 'Synthetic', text: 'Synthetic' },
        fixture.config,
      ),
    ).rejects.toThrow(/restricted to isolated Mailpit/);
  },
);
