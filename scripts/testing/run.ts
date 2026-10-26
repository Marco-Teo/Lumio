import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { assertTestEnvironment } from './environment';

if (process.env.NODE_ENV === 'production')
  throw new Error('Test suites are forbidden in a production environment');
if (!existsSync('.env.test.local'))
  throw new Error(
    'Run pnpm env:test, start test Mailpit and then pnpm test:setup',
  );
const isolated = Object.fromEntries(
  readFileSync('.env.test.local', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
// Explicit values from the test file override inherited development config.
Object.assign(process.env, isolated);
assertTestEnvironment(process.env);
const mode = process.argv[2];
function node(args: string[], cwd = process.cwd()) {
  const result = spawnSync(process.execPath, args, {
    env: process.env,
    stdio: 'inherit',
    cwd,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (mode === 'setup') {
  node(['--import', 'tsx', 'scripts/provision-database.ts']);
  node([
    'node_modules/prisma/build/index.js',
    'migrate',
    'deploy',
    '--config',
    'packages/database/prisma.config.ts',
  ]);
  node(['--import', 'tsx', 'scripts/seed-development.ts']);
} else if (mode === 'integration') {
  node([
    '--import',
    'tsx',
    '--import',
    './scripts/testing/preflight.ts',
    '--test',
    '--test-concurrency=1',
    'tests/integration/*.test.ts',
  ]);
} else if (mode === 'e2e') {
  // Build with the same isolated environment that will be used by the servers.
  node([
    'node_modules/prisma/build/index.js',
    'generate',
    '--config',
    'packages/database/prisma.config.ts',
  ]);
  node(
    [resolve('apps/web/node_modules/next/dist/bin/next'), 'build'],
    resolve('apps/web'),
  );
  node([
    'node_modules/@playwright/test/cli.js',
    'test',
    ...process.argv.slice(3),
  ]);
} else throw new Error('Expected setup, integration or e2e');
