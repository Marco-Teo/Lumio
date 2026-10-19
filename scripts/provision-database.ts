import { Client } from 'pg';

const adminUrl = process.env.ADMIN_DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
const runtimeUrl = process.env.DATABASE_URL;
if (!adminUrl || !migrationUrl || !runtimeUrl)
  throw new Error('Database provisioning environment is missing');

const adminConnection = new URL(adminUrl);
adminConnection.pathname = '/postgres';
const admin = new Client({ connectionString: adminConnection.toString() });
await admin.connect();
try {
  const existingDatabase = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname='lumio'",
  );
  if (!existingDatabase.rowCount) await admin.query('CREATE DATABASE lumio');
  await admin.end();
  const provisioner = new Client({ connectionString: adminUrl });
  await provisioner.connect();
  try {
    for (const [name, url] of [
      ['lumio_migrator', migrationUrl],
      ['lumio_app', runtimeUrl],
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
      await provisioner.query(
        `ALTER ROLE ${name} PASSWORD '${password.replaceAll("'", "''")}'`,
      );
    }
    await provisioner.query(
      'GRANT CONNECT ON DATABASE lumio TO lumio_app, lumio_migrator',
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
