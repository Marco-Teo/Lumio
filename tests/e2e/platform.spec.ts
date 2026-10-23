import { test, expect, type BrowserContext } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createDatabase } from '@lumio/database';
import { authentication } from '../../apps/web/src/server/auth';
import { emailLink, totp } from './helpers';

const origin = 'http://127.0.0.1:3100';

test('platform provisioning, invitation delivery, recipient acceptance and suspension', async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(90000);
  if (!process.env.MIGRATION_DATABASE_URL)
    throw new Error('E2E migration environment required');
  process.env.APP_URL = origin;
  const owner = createDatabase(process.env.MIGRATION_DATABASE_URL);
  const suffix = randomBytes(8).toString('hex');
  const adminEmail = `platform-e2e-${suffix}@example.invalid`;
  const recipientEmail = `recipient-e2e-${suffix}@example.invalid`;
  const password = randomBytes(20).toString('hex');
  const slug = `platform-e2e-${suffix}`;
  let organizationId = '';
  let recipientContext: BrowserContext | undefined;
  try {
    // Test fixture uses the real library for credential hashing/session creation.
    // HTTP login and MFA challenges are separately covered in auth.spec.ts;
    // setup here does not bypass the shared HTTP rate limiter.
    await authentication().api.signUpEmail({
      body: { name: 'Platform E2E', email: adminEmail, password },
    });
    await owner.user.update({
      where: { email: adminEmail },
      data: { emailVerified: true },
    });
    const grant = await promisify(execFile)(
      process.execPath,
      [
        '--env-file-if-exists=.env',
        '--import',
        'tsx',
        'scripts/grant-platform-admin.ts',
        adminEmail,
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '' },
        timeout: 15000,
      },
    );
    expect(grant.stdout).toContain('Platform privilege assigned');
    await signIn(page.context(), adminEmail, password);
    await page.goto('/platform');
    await expect(
      page.getByRole('heading', { name: 'Proteggi la console Lumio' }),
    ).toBeVisible();
    expect(
      (
        await page.context().request.get('/api/platform/organizations')
      ).status(),
    ).toBe(403);

    await page.goto('/account');
    await page.getByLabel('Conferma password').fill(password);
    await page.getByRole('button', { name: 'Configura autenticatore' }).click();
    const uri = await page.locator('.secret-uri').innerText();
    await page.getByLabel('Codice autenticatore').fill(totp(uri));
    await page.getByRole('button', { name: 'Verifica e attiva' }).click();
    await expect(page.getByRole('status')).toContainText('attivata');
    await page.goto('/platform');
    await page
      .getByLabel('Nome organizzazione', { exact: true })
      .fill(`Associazione E2E ${suffix}`);
    await page.getByLabel('Slug', { exact: true }).fill(slug);
    await page
      .getByLabel('Email di contatto', { exact: true })
      .fill(recipientEmail);
    await page
      .getByLabel('Email primo amministratore', { exact: true })
      .fill(recipientEmail);
    await page
      .getByRole('button', { name: 'Crea organizzazione e invita' })
      .click();
    await expect(page.getByRole('status')).toContainText(
      'Organizzazione creata',
    );
    const created = await owner.organization.findUniqueOrThrow({
      where: { slug },
    });
    organizationId = created.id;
    await page.getByLabel('Cerca per nome o slug', { exact: true }).fill(slug);
    await page.getByRole('button', { name: 'Cerca', exact: true }).click();
    const row = page
      .getByRole('row')
      .filter({ hasText: `Associazione E2E ${suffix}` });
    await expect(row).toContainText('Configurazione incompleta');
    const first = await emailLink(request, recipientEmail, 'invitations');
    await row.getByRole('button', { name: 'Reinvia invito' }).click();
    await expect(page.getByRole('status')).toContainText(
      'Nuovo invito preparato',
    );
    const current = await emailLink(
      request,
      recipientEmail,
      'invitations',
      first,
    );

    await authentication().api.signUpEmail({
      body: { name: 'Recipient E2E', email: recipientEmail, password },
    });
    await owner.user.update({
      where: { email: recipientEmail },
      data: { emailVerified: true },
    });
    recipientContext = await browser.newContext();
    await signIn(recipientContext, recipientEmail, password);
    const recipientPage = await recipientContext.newPage();
    await recipientPage.goto(first);
    await recipientPage.getByRole('button', { name: 'Accetta invito' }).click();
    await expect(recipientPage.getByRole('status')).toContainText(
      'Invito non disponibile',
    );
    await recipientPage.goto(current);
    await recipientPage.getByRole('button', { name: 'Accetta invito' }).click();
    await expect(recipientPage.getByRole('status')).toContainText(
      'Invito accettato',
    );
    expect(
      (
        await recipientContext.request.get('/api/platform/organizations')
      ).status(),
    ).toBe(403);
    expect(
      (
        await recipientContext.request.get('/api/v1/organizations/demo-org-a')
      ).status(),
    ).toBe(404);
    await page.getByRole('button', { name: 'Aggiorna stato invii' }).click();
    await expect(row).toContainText('accettato');
    await row.getByRole('button', { name: 'Sospendi', exact: true }).click();
    await page
      .getByLabel('Motivazione', { exact: true })
      .fill('Verifica sospensione organizzazione E2E');
    await page.getByRole('button', { name: 'Conferma modifica' }).click();
    await expect(row).toContainText('Sospesa');
    await row.getByRole('button', { name: 'Registro attività' }).click();
    await expect(page.getByText(/organization.status_changed/)).toBeVisible();
    const blocked = await recipientContext.request.get(
      `/api/v1/organizations/${organizationId}`,
    );
    expect(blocked.status()).toBe(403);
  } finally {
    await recipientContext?.close();
    if (organizationId) {
      await owner.platformAudit.deleteMany({ where: { organizationId } });
      await owner.outboxEvent.deleteMany({ where: { organizationId } });
      await owner.organizationInvitation.deleteMany({
        where: { organizationId },
      });
      await owner.organizationMembership.deleteMany({
        where: { organizationId },
      });
      await owner.organization.delete({ where: { id: organizationId } });
    }
    await owner.$disconnect();
  }
});

async function signIn(
  context: BrowserContext,
  email: string,
  password: string,
) {
  const response = await authentication().api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  expect(response.status).toBe(200);
  const cookies = response.headers
    .getSetCookie()
    .map((cookie) => {
      const pair = cookie.split(';')[0];
      const separator = pair.indexOf('=');
      return {
        name: pair.slice(0, separator),
        value: pair.slice(separator + 1),
        url: origin,
        httpOnly: true,
        sameSite: 'Lax' as const,
      };
    })
    .filter((cookie) => cookie.value);
  await context.addCookies(cookies);
}
