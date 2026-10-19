import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

test('migrations apply from empty database with separate runtime role', async () => {
  if (
    !process.env.ADMIN_DATABASE_URL ||
    !process.env.MIGRATION_DATABASE_URL ||
    !process.env.DATABASE_URL
  )
    throw new Error('Migration verification environment required');
  const admin = new Client({
    connectionString: process.env.ADMIN_DATABASE_URL,
  });
  await admin.connect();
  const name = `lumio_verify_${randomBytes(8).toString('hex')}`;
  assert.match(name, /^lumio_verify_[a-f0-9]{16}$/);
  await admin.query(`CREATE DATABASE ${name}`);
  const migrationUrl = new URL(process.env.MIGRATION_DATABASE_URL);
  migrationUrl.pathname = `/${name}`;
  const adminUrl = new URL(process.env.ADMIN_DATABASE_URL);
  adminUrl.pathname = `/${name}`;
  const schemaOwner = new Client({ connectionString: adminUrl.toString() });
  try {
    await schemaOwner.connect();
    await schemaOwner.query('ALTER SCHEMA public OWNER TO lumio_migrator');
    const result = spawnSync(
      process.execPath,
      [
        resolve('node_modules/prisma/build/index.js'),
        'migrate',
        'deploy',
        '--config',
        resolve('packages/database/prisma.config.ts'),
      ],
      {
        env: {
          ...process.env,
          MIGRATION_DATABASE_URL: migrationUrl.toString(),
        },
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 0, 'Migration failed on fresh database');
    const runtimeUrl = new URL(process.env.DATABASE_URL);
    runtimeUrl.pathname = `/${name}`;
    const runtime = new Client({ connectionString: runtimeUrl.toString() });
    await runtime.connect();
    try {
      assert.equal(
        (await runtime.query('SELECT count(*)::int AS n FROM organization'))
          .rows[0].n,
        0,
      );
      const tables = await runtime.query(
        "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'",
      );
      assert.ok(tables.rows[0].n >= 10);
    } finally {
      await runtime.end();
    }
  } finally {
    await schemaOwner.end();
    await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
  }
});
