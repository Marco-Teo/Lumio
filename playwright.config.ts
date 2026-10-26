import { defineConfig, devices } from '@playwright/test';
import './scripts/testing/preflight';

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  use: {
    actionTimeout: 15000,
    navigationTimeout: 15000,
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
  },
  reporter: process.env.CI ? 'github' : 'list',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter lumio-web start --port 3100',
      url: 'http://127.0.0.1:3100/api/health/live',
      reuseExistingServer: false,
      timeout: 60_000,
      env: { APP_URL: 'http://127.0.0.1:3100', LUMIO_LOCAL_TEST: '1' },
    },
    {
      command: 'pnpm worker',
      url: 'http://127.0.0.1:3102/health',
      reuseExistingServer: false,
      timeout: 60000,
      env: {
        APP_URL: 'http://127.0.0.1:3100',
        WORKER_HEALTH_PORT: '3102',
        LUMIO_LOCAL_TEST: '1',
      },
    },
  ],
});
