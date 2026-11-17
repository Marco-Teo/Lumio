import '../../scripts/testing/preflight';
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
    const capability = await schemaOwner.query(`
      SELECT pg_get_userbyid(p.proowner) AS owner, p.prosecdef, p.provolatile, p.proconfig,
        has_function_privilege('lumio_worker',p.oid,'EXECUTE') AS worker_execute,
        has_function_privilege('lumio_app',p.oid,'EXECUTE') AS app_execute,
        EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
          WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') AS public_execute
      FROM pg_proc p WHERE p.oid='public.photo_policy_context(text)'::regprocedure
    `);
    assert.deepEqual(capability.rows, [
      {
        owner: 'lumio_migrator',
        prosecdef: true,
        provolatile: 's',
        proconfig: ['search_path=pg_catalog, public'],
        worker_execute: true,
        app_execute: false,
        public_execute: false,
      },
    ]);
    const privileges = await schemaOwner.query(`SELECT
      has_table_privilege('lumio_worker','public.registration','SELECT') AS registration,
      has_table_privilege('lumio_worker','public.entry','SELECT') AS entry,
      has_table_privilege('lumio_worker','public.person','SELECT') AS person,
      has_schema_privilege('lumio_worker','public','CREATE') AS schema_create
    `);
    assert.deepEqual(privileges.rows, [
      {
        registration: false,
        entry: false,
        person: false,
        schema_create: false,
      },
    ]);
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
