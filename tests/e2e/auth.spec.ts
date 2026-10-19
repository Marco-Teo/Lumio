import { expect, test, type APIRequestContext } from '@playwright/test';
import { randomBytes, createHmac } from 'node:crypto';
import { createDatabase } from '@lumio/database';

const origin = 'http://127.0.0.1:3100';
const mailpit = process.env.MAILPIT_URL ?? 'http://127.0.0.1:8025';

async function emailLink(
  request: APIRequestContext,
  email: string,
  kind: 'verify-email' | 'reset-password',
) {
  let link = '';
  await expect
    .poll(async () => {
      const search = await request.get(`${mailpit}/api/v1/search`, {
        params: { query: `to:${email}` },
      });
      const data = (await search.json()) as { messages: Array<{ ID: string }> };
      for (const item of data.messages) {
        const message = (await (
          await request.get(`${mailpit}/api/v1/message/${item.ID}`)
        ).json()) as { Text: string };
        const found = message.Text.match(/https?:\/\/[^\s]+/g)?.find((url) =>
          url.includes(kind),
        );
        if (found) {
          link = found;
          return true;
        }
      }
      return false;
    })
    .toBe(true);
  return link;
}

function totp(uri: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const secret = new URL(uri).searchParams.get('secret') ?? '';
  const bits = [...secret.toUpperCase()]
    .map((char) => alphabet.indexOf(char).toString(2).padStart(5, '0'))
    .join('');
  const key = Buffer.from(
    (bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, '0');
}

test('registration, verification, reset, revocation and MFA', async ({
  page,
  request,
}) => {
  const email = `e2e-${randomBytes(8).toString('hex')}@example.invalid`;
  const password = randomBytes(20).toString('hex');
  if (!process.env.MIGRATION_DATABASE_URL)
    throw new Error('E2E migration environment required');
  const owner = createDatabase(process.env.MIGRATION_DATABASE_URL);
  const organizationId = `e2e-org-${randomBytes(8).toString('hex')}`;
  try {
    await page.goto('/register');
    await page.getByLabel('Nome', { exact: true }).fill('Partecipante di test');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Continua' }).click();
    await expect(page.getByRole('status')).toContainText(
      'Controlla la tua email',
    );

    const denied = await request.post('/api/auth/sign-in/email', {
      headers: { Origin: origin },
      data: { email, password },
    });
    expect(denied.ok()).toBe(false);
    await page.goto(await emailLink(request, email, 'verify-email'));
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Continua' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    const session = await page.context().request.get('/api/auth/get-session');
    const sessionData = (await session.json()) as { user: { id: string } };
    expect(sessionData.user.id).toBeTruthy();
    const person = await owner.person.findUnique({
      where: { userId: sessionData.user.id },
    });
    expect(person).not.toBeNull();
    await owner.organization.create({
      data: {
        id: organizationId,
        slug: organizationId,
        name: 'Organizzazione E2E',
        contactEmail: email,
        memberships: { create: { userId: sessionData.user.id } },
      },
    });
    expect(
      (
        await page
          .context()
          .request.get(`/api/v1/organizations/${organizationId}`)
      ).status(),
    ).toBe(403);
    const deniedTenant = await page
      .context()
      .request.get('/api/v1/organizations/demo-org-a');
    expect(deniedTenant.status()).toBe(404);

    // Reset while a browser session exists; reset must revoke it.
    await page.goto('/forgot-password');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Continua' }).click();
    await expect(page.getByRole('status')).toContainText('Se l’account esiste');
    const resetLink = await emailLink(request, email, 'reset-password');
    await page.goto(resetLink);
    const newPassword = randomBytes(20).toString('hex');
    await page.getByLabel('Password', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Continua' }).click();
    await expect(page.getByRole('status')).toContainText('Password aggiornata');
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Continua' }).click();
    await expect(page).toHaveURL(/\/account$/);
    await page.getByLabel('Conferma password').fill(newPassword);
    await page.getByRole('button', { name: 'Configura autenticatore' }).click();
    const uri = await page.locator('.secret-uri').innerText();
    const backupCode = (await page.locator('pre').innerText()).split('\n')[0];
    await page.getByLabel('Codice autenticatore').fill(totp(uri));
    await page.getByRole('button', { name: 'Verifica e attiva' }).click();
    await expect(page.getByRole('status')).toContainText('attivata');
    await page.getByRole('button', { name: 'Esci', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Continua' }).click();
    await expect(page).toHaveURL(/\/two-factor$/);
    expect(
      await (await page.context().request.get('/api/auth/get-session')).json(),
    ).toBeNull();
    await page.getByLabel('Codice autenticatore').fill(totp(uri));
    await page.getByRole('button', { name: 'Continua' }).click();
    await expect(page).toHaveURL(/\/account$/);
    expect(
      (
        await page
          .context()
          .request.get(`/api/v1/organizations/${organizationId}`)
      ).status(),
    ).toBe(200);
    await page.getByRole('button', { name: 'Esci', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Continua' }).click();
    await expect(page).toHaveURL(/\/two-factor$/);
    await page.getByRole('button', { name: 'Usa codice di recupero' }).click();
    await page.getByLabel('Codice di recupero').fill(backupCode);
    await page.getByRole('button', { name: 'Continua' }).click();
    await expect(page).toHaveURL(/\/account$/);
    const reused = await page
      .context()
      .request.post('/api/auth/two-factor/verify-backup-code', {
        headers: { Origin: origin },
        data: { code: backupCode },
      });
    expect(reused.ok()).toBe(false);
    const throttled = await request.post('/api/auth/sign-in/email', {
      headers: { Origin: origin },
      data: { email, password: newPassword },
    });
    expect(throttled.status()).toBe(429);
  } finally {
    await owner.organizationMembership.deleteMany({
      where: { organizationId },
    });
    await owner.organization.deleteMany({ where: { id: organizationId } });
    await owner.$disconnect();
  }
});

test('anonymous, invalid session and cross-origin requests cannot access protected resources', async ({
  request,
  page,
}) => {
  expect((await request.get('/api/v1/organizations/demo-org-a')).status()).toBe(
    401,
  );
  const session = await request.get('/api/auth/get-session', {
    headers: { Cookie: 'better-auth.session_token=invalid' },
  });
  expect(await session.json()).toBeNull();
  const crossOrigin = await request.post('/api/auth/sign-up/email', {
    headers: { Origin: 'https://other.example.invalid' },
    data: {
      name: 'Test',
      email: 'nobody@example.invalid',
      password: 'not-a-valid-password',
    },
  });
  expect(crossOrigin.status()).toBe(403);
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login$/);
});
