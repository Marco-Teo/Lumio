import { Client } from 'pg';

const adminUrl = process.env.ADMIN_DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
const runtimeUrl = process.env.DATABASE_URL;
const workerUrl = process.env.WORKER_DATABASE_URL;
if (!adminUrl || !migrationUrl || !runtimeUrl || !workerUrl)
  throw new Error('Database provisioning environment is missing');

const adminConnection = new URL(adminUrl);
const databaseName = new URL(adminUrl).pathname.slice(1);
if (!['lumio', 'lumio_test'].includes(databaseName))
  throw new Error('Unexpected database name');
for (const url of [migrationUrl, runtimeUrl, workerUrl]) {
  if (new URL(url).pathname !== `/${databaseName}`)
    throw new Error('Database URLs must target the same database');
}
adminConnection.pathname = '/postgres';
const admin = new Client({ connectionString: adminConnection.toString() });
await admin.connect();
try {
  const existingDatabase = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname=$1',
    [databaseName],
  );
  if (!existingDatabase.rowCount)
    await admin.query(`CREATE DATABASE ${databaseName}`);
  await admin.end();
  const provisioner = new Client({ connectionString: adminUrl });
  await provisioner.connect();
  try {
    for (const [name, url] of [
      ['lumio_migrator', migrationUrl],
      ['lumio_app', runtimeUrl],
      ['lumio_worker', workerUrl],
    ] as const) {
      const parsed = new URL(url);
      if (parsed.username !== name) throw new Error('Unexpected database role');
      const password = decodeURIComponent(parsed.password);
      if (password.length < 20)
        throw new Error(
          'Database password must contain at least 20 characters',
        );
      const exists = await provisioner.query(
        'SELECT 1 FROM pg_roles WHERE rolname=$1',
        [name],
      );
      // Role names are constants above; PostgreSQL DDL does not accept bind parameters here.
      if (!exists.rowCount)
        await provisioner.query(
          `CREATE ROLE ${name} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
        );
      // PostgreSQL roles are cluster-wide: test setup must never rotate a
      // development role's password from an older test configuration.
      if (databaseName === 'lumio' || !exists.rowCount)
        await provisioner.query(
          `ALTER ROLE ${name} PASSWORD '${password.replaceAll("'", "''")}'`,
        );
    }
    await provisioner.query(
      `GRANT CONNECT ON DATABASE ${databaseName} TO lumio_app, lumio_migrator, lumio_worker`,
    );
    await provisioner.query(
      `ALTER DATABASE ${databaseName} SET timezone TO 'UTC'`,
    );
    await provisioner.query('ALTER SCHEMA public OWNER TO lumio_migrator');
    await provisioner.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
    await provisioner.query(
      'GRANT USAGE, CREATE ON SCHEMA public TO lumio_migrator',
    );
    console.log('Database roles provisioned');
  } finally {
    await provisioner.end();
  }
} finally {
  await admin.end();
}
