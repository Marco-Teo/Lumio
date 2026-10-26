import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { createDatabase } from '@lumio/database';
import { authentication } from '../../apps/web/src/server/auth';
import { totp } from './helpers';

test('organizer configures, versions, publishes and archives an edition', async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  if (!process.env.MIGRATION_DATABASE_URL)
    throw new Error('E2E migration environment required');
  process.env.APP_URL = 'http://127.0.0.1:3100';
  const owner = createDatabase(process.env.MIGRATION_DATABASE_URL);
  const suffix = randomBytes(8).toString('hex');
  const email = `contest-e2e-${suffix}@example.invalid`,
    password = randomBytes(20).toString('hex');
  let organizationId = '',
    userId = '';
  try {
    const signup = await authentication().api.signUpEmail({
      body: { name: 'Organizer E2E', email, password },
    });
    userId = signup.user.id;
    await owner.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
    const org = await owner.organization.create({
      data: {
        name: `Organizzazione E2E ${suffix}`,
        slug: `contest-e2e-${suffix}`,
        contactEmail: email,
      },
    });
    organizationId = org.id;
    await owner.organizationMembership.create({
      data: { organizationId, userId },
    });
    const login = await authentication().api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    expect(login.status).toBe(200);
    await page.context().addCookies(
      login.headers
        .getSetCookie()
        .map((cookie) => {
          const pair = cookie.split(';')[0],
            separator = pair.indexOf('=');
          return {
            name: pair.slice(0, separator),
            value: pair.slice(separator + 1),
            url: 'http://127.0.0.1:3100',
            httpOnly: true,
            sameSite: 'Lax' as const,
          };
        })
        .filter((cookie) => cookie.value),
    );
    expect(
      (
        await request.get(`/api/v1/organizations/${organizationId}/contests`)
      ).status(),
    ).toBe(401);
    expect(
      (
        await page.request.get(
          `/api/v1/organizations/${organizationId}/contests`,
        )
      ).status(),
    ).toBe(403);
    // Real enrollment through the auth library avoids consuming the shared HTTP
    // MFA rate budget. Enrollment UI and HTTP throttling are covered in auth.spec.
    const fixtureHeaders = new Headers({
      cookie: login.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0])
        .join('; '),
    });
    const enrollment = await authentication().api.enableTwoFactor({
      headers: fixtureHeaders,
      body: { password },
    });
    if (enrollment.method !== 'totp')
      throw new Error('Expected TOTP enrollment');
    const verified = await authentication().api.verifyTOTP({
      headers: fixtureHeaders,
      body: { code: totp(enrollment.totpURI) },
      asResponse: true,
    });
    expect(verified.status).toBe(200);
    await page.context().addCookies(
      verified.headers
        .getSetCookie()
        .map((cookie) => {
          const pair = cookie.split(';')[0],
            separator = pair.indexOf('=');
          return {
            name: pair.slice(0, separator),
            value: pair.slice(separator + 1),
            url: 'http://127.0.0.1:3100',
            httpOnly: true,
            sameSite: 'Lax' as const,
          };
        })
        .filter((cookie) => cookie.value),
    );
    await page.goto('/account');
    await page.getByRole('link', { name: 'Le tue organizzazioni' }).click();
    await page.getByRole('link', { name: org.name }).click();
    await expect(page.getByRole('heading', { name: org.name })).toBeVisible();
    expect(
      (
        await page.request.get('/api/v1/organizations/demo-org-b/contests')
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post(
          `/api/v1/organizations/${organizationId}/contests`,
          {
            data: { name: 'Blocked', slug: 'blocked', description: '' },
            headers: { Origin: 'https://untrusted.invalid' },
          },
        )
      ).status(),
    ).toBe(403);
    await page.getByLabel('Nome concorso').fill('Concorso annuale');
    await page.getByLabel('Slug concorso').fill('concorso-annuale');
    await page
      .getByLabel('Descrizione concorso')
      .fill('Contenitore permanente');
    await page.getByRole('button', { name: 'Salva concorso' }).click();
    await expect(page.getByRole('status')).toContainText('Concorso salvato');
    await page.getByRole('button', { name: 'Nuova edizione' }).click();
    await expect(page.getByLabel('Valuta')).toBeDisabled();
    await page.getByLabel('Modalità pagamento').selectOption('manual');
    await expect(page.getByLabel('Valuta')).toBeEnabled();
    await page.getByLabel('Valuta').selectOption('USD');
    await page.getByLabel('Modalità pagamento').selectOption('free');
    await expect(page.getByLabel('Valuta')).toBeDisabled();
    await page.getByLabel('Modalità pagamento').selectOption('manual');
    await expect(page.getByLabel('Valuta')).toHaveValue('USD');
    await page.getByLabel('Modalità pagamento').selectOption('free');
    for (const group of await page.locator('.edition-form > fieldset').all()) {
      const box = await group.boundingBox();
      const title = await group.locator(':scope > legend').boundingBox();
      expect(box).not.toBeNull();
      expect(title).not.toBeNull();
      if (box && title) expect(title.y).toBeGreaterThan(box.y + 2);
    }
    await page.getByLabel('Nome edizione').fill('Edizione 2027');
    await page.getByLabel('Slug edizione').fill('edizione-2027');
    await page.getByLabel('Anno o identificatore').fill('2027');
    await page.getByRole('button', { name: 'Salva bozza' }).click();
    await expect(page.getByRole('status')).toContainText('Bozza salvata');
    await expect(
      page.getByText('Per pubblicare questa edizione:'),
    ).toBeVisible();
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Pubblica edizione' }).click();
    await expect(page.getByRole('status')).toContainText(
      'Inserisci il regolamento',
    );
    await page.getByRole('button', { name: 'Configura edizione' }).click();
    await page
      .getByLabel('Descrizione edizione')
      .fill('Prima edizione del concorso');
    await page.getByLabel('Apertura iscrizioni').fill('2027-01-01T10:00');
    await page.getByLabel('Chiusura iscrizioni').fill('2027-02-01T10:00');
    await page.getByLabel('Data giuria').fill('2027-03-01T10:00');
    await page.getByLabel('Data premiazione').fill('2027-04-01T10:00');
    await page
      .getByLabel('Regolamento', { exact: true })
      .fill('Regolamento edizione 2027');
    await page
      .getByLabel('Informativa privacy')
      .fill('Informativa privacy edizione 2027');
    await page.getByRole('button', { name: 'Aggiungi sezione' }).click();
    const first = page.getByRole('group', { name: 'Sezione 1', exact: true });
    await first.getByLabel('Nome sezione').fill('Tema libero');
    await first.getByLabel('Codice sezione').fill('L');
    await page.getByRole('button', { name: 'Aggiungi sezione' }).click();
    const second = page.getByRole('group', { name: 'Sezione 2', exact: true });
    await second.getByLabel('Nome sezione').fill('Racconto');
    await second.getByLabel('Codice sezione').fill('P');
    await second.getByLabel('Tipo opera').selectOption('portfolio');
    await second.getByLabel('Minimo immagini per opera').fill('3');
    await second.getByLabel('Massimo immagini per opera').fill('8');
    await second.getByRole('button', { name: 'Sposta su' }).click();
    await expect(first.getByLabel('Nome sezione')).toHaveValue('Racconto');
    await page.getByRole('button', { name: 'Salva bozza' }).click();
    await expect(page.getByRole('status')).toContainText('Bozza salvata');
    await page.reload();
    await page.getByRole('button', { name: 'Versioni salvate' }).click();
    await expect(
      page.getByText('Versione 1 —', { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByText('Versione 2 —', { exact: false }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Pubblica edizione' }).click();
    await expect(page.getByRole('status')).toContainText('Edizione pubblicata');
    const savedEdition = await owner.edition.findFirstOrThrow({
      where: { organizationId, name: 'Edizione 2027' },
    });
    expect(savedEdition.status).toBe('published');
    expect(savedEdition.publishedAt).not.toBeNull();
    expect(
      await owner.auditEvent.count({
        where: {
          organizationId,
          entityId: savedEdition.id,
          action: 'edition.published',
        },
      }),
    ).toBe(1);
    await expect(
      page.getByRole('link', { name: 'Apri pagina pubblica' }),
    ).toHaveAttribute('href', `/editions/${savedEdition.id}`);
    const publicPage = await page.context().newPage();
    await publicPage.goto('/editions');
    await publicPage
      .getByRole('link', { name: 'Edizione 2027', exact: true })
      .click();
    await expect(
      publicPage.getByRole('heading', { name: 'Edizione 2027', exact: true }),
    ).toBeVisible();
    await publicPage.close();
    await expect(
      page.getByRole('button', { name: 'Configura edizione' }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Visualizza configurazione' })
      .click();
    await expect(page.getByLabel('Nome edizione')).toBeDisabled();
    await page.getByRole('button', { name: 'Chiudi configurazione' }).click();
    await page.getByRole('button', { name: 'Archivia edizione' }).click();
    await expect(page.getByRole('status')).toContainText('Edizione archiviata');
    await expect(
      page.getByText('Stato: Archiviata', { exact: false }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Il tuo account' }).click();
    await page.getByRole('link', { name: 'Torna alla home' }).click();
    await expect(page).toHaveURL('/');
  } finally {
    if (organizationId) {
      const where = { organizationId };
      await owner.auditEvent.deleteMany({ where });
      await owner.section.deleteMany({ where });
      await owner.editionRevision.deleteMany({ where });
      await owner.edition.deleteMany({ where });
      await owner.contest.deleteMany({ where });
      await owner.organizationMembership.deleteMany({ where });
      await owner.organization.delete({ where: { id: organizationId } });
    }
    if (userId) {
      await owner.person.deleteMany({ where: { userId } });
      await owner.user.delete({ where: { id: userId } });
    }
    await owner.$disconnect();
  }
});
