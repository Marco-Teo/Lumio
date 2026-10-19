import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';

if (existsSync('.env') || existsSync('apps/web/.env.local'))
  throw new Error(
    'Local environment already exists; existing files will not be overwritten',
  );
const secret = () => randomBytes(32).toString('hex');
const admin = secret();
const migrator = secret();
const runtime = secret();
const web =
  [
    'APP_URL=http://127.0.0.1:3000',
    `DATABASE_URL=postgresql://lumio_app:${runtime}@127.0.0.1:5432/lumio`,
    `BETTER_AUTH_SECRET=${secret()}`,
    'MAIL_TRANSPORT=smtp',
    'SMTP_HOST=127.0.0.1',
    'SMTP_PORT=1025',
    'EMAIL_FROM=lumio@example.invalid',
    'LUMIO_LOCAL_TEST=1',
  ].join('\n') + '\n';
writeFileSync(
  '.env',
  web +
    `POSTGRES_ADMIN_PASSWORD=${admin}\nADMIN_DATABASE_URL=postgresql://postgres:${admin}@127.0.0.1:5432/lumio\nMIGRATION_DATABASE_URL=postgresql://lumio_migrator:${migrator}@127.0.0.1:5432/lumio\n`,
);
writeFileSync('apps/web/.env.local', web);
console.log(
  'Local environment created with random credentials; privileged URLs are not included in the web environment.',
);
