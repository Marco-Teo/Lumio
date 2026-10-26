import { test, expect, type BrowserContext } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { createDatabase } from '@lumio/database';
import { authentication } from '../../apps/web/src/server/auth';
import {
  saveContest,
  saveEdition,
  transitionEdition,
} from '../../apps/web/src/server/competitions';
import { emptyEdition } from '../../apps/web/src/lib/competitions';
import { emailLink } from './helpers';

test('participant starts an edition registration with independent profile data and versioned documents', async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(90000);
  if (!process.env.MIGRATION_DATABASE_URL)
    throw new Error('Isolated DB required');
  const owner = createDatabase(process.env.MIGRATION_DATABASE_URL);
  const suffix = randomBytes(8).toString('hex'),
    password = randomBytes(20).toString('hex');
  const adminEmail = `f2-admin-${suffix}@example.invalid`,
    email = `f2-participant-${suffix}@example.invalid`,
    otherEmail = `f2-other-${suffix}@example.invalid`;
  const users: string[] = [];
  let organizationId = '';
  let otherContext: BrowserContext | undefined;
  try {
    for (const userEmail of [adminEmail, email, otherEmail]) {
      const signup = await authentication().api.signUpEmail({
        body: { name: 'Synthetic F2', email: userEmail, password },
      });
      users.push(signup.user.id);
      await owner.user.update({
        where: { id: signup.user.id },
        data: {
          emailVerified: true,
          ...(userEmail === adminEmail ? { twoFactorEnabled: true } : {}),
        },
      });
    }
    const actor = { id: users[0], emailVerified: true, twoFactorEnabled: true };
    const org = await owner.organization.create({
      data: {
        name: `F2 E2E ${suffix}`,
        slug: `f2-e2e-${suffix}`,
        contactEmail: adminEmail,
      },
    });
    organizationId = org.id;
    await owner.organizationMembership.create({
      data: { organizationId, userId: actor.id },
    });
    const contest = await saveContest(actor, organizationId, {
      name: 'Concorso partecipanti',
      slug: 'partecipanti',
      description: '',
    });
    const at = (days: number) =>
      new Date(Date.now() + days * 86400000).toISOString();
    const config = {
      ...emptyEdition(`Edizione F2 ${suffix}`, 'edizione-f2', '2026'),
      description: 'Edizione aperta alle bozze',
      opensAt: at(-1),
      closesAt: at(1),
      juryAt: at(2),
      awardsAt: at(3),
      regulations: 'Regolamento test F2',
      privacy: 'Informativa test F2',
      sections: [
        {
          name: 'Tema libero',
          code: 'L',
          description: '',
          theme: '',
          type: 'single' as const,
          minImages: 1,
          maxImages: 1,
          feeCents: 0,
          specificRules: '',
        },
      ],
    };
    const edition = await saveEdition(actor, organizationId, contest.id, {
      configuration: config,
    });
    await transitionEdition(actor, organizationId, contest.id, edition.id, {
      version: 1,
      status: 'published',
    });
    const publicResponse = await request.get(`/editions/${edition.id}`);
    expect(publicResponse.status()).toBe(200);
    await signIn(page.context(), email, password);
    await page.goto('/account');
    await page
      .getByRole('link', { name: 'Il tuo profilo', exact: true })
      .click();
    await page.getByLabel('Nome', { exact: true }).fill('Profilo originale');
    await page.getByLabel('Cognome', { exact: true }).fill('Partecipante');
    await page.getByLabel('Paese', { exact: false }).fill('IT');
    await page.getByRole('button', { name: 'Salva profilo' }).click();
    await expect(page.getByRole('status')).toContainText('Profilo salvato');
    await page.goto(`/editions/${edition.id}`);
    await expect(
      page.getByRole('heading', { name: config.name }),
    ).toBeVisible();
    await page
      .getByRole('checkbox', { name: /Accetto il regolamento/ })
      .check();
    await page
      .getByRole('checkbox', { name: /Ho letto l’informativa/ })
      .check();
    await page.getByRole('button', { name: 'Inizia iscrizione' }).click();
    await expect(page).toHaveURL(/\/registrations\/[a-f0-9-]+$/);
    const registrationPath = new URL(page.url()).pathname;
    await expect(
      page.getByRole('heading', {
        name: 'La tua bozza di iscrizione è stata ricevuta',
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Riepilogo iscrizione' }),
    ).toContainText(org.name);
    await expect(
      page.getByRole('region', { name: 'Riepilogo iscrizione' }),
    ).toContainText('Non devi attendere un’approvazione');
    const receiptLink = await emailLink(request, email, '/registrations/');
    expect(new URL(receiptLink).pathname).toBe(registrationPath);
    await expect(page.getByText('Stato: Opere da aggiungere')).toBeVisible();
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue(
      'Profilo originale',
    );
    await page
      .getByLabel('Nome', { exact: true })
      .fill('Solo questa iscrizione');
    await page.getByRole('button', { name: 'Salva dati iscrizione' }).click();
    await expect(page.getByRole('status')).toContainText(
      'Dati dell’iscrizione salvati',
    );
    await page.reload();
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue(
      'Solo questa iscrizione',
    );
    await page
      .getByRole('link', { name: 'Il tuo profilo', exact: true })
      .click();
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue(
      'Profilo originale',
    );
    await page.getByLabel('Nome', { exact: true }).fill('Nuovo profilo');
    await page.getByRole('button', { name: 'Salva profilo' }).click();
    await expect(page.getByRole('status')).toContainText('Profilo salvato');
    await page.goto(registrationPath);
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue(
      'Solo questa iscrizione',
    );
    await page.getByRole('button', { name: 'Usa i dati del profilo' }).click();
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue(
      'Nuovo profilo',
    );
    await page.getByRole('button', { name: 'Salva dati iscrizione' }).click();
    await expect(page.getByRole('status')).toContainText(
      'Dati dell’iscrizione salvati',
    );
    await page.getByText('Regolamento', { exact: true }).click();
    await expect(
      page.getByText('Regolamento test F2', { exact: true }),
    ).toBeVisible();
    expect((await request.get(`/api${registrationPath}`)).status()).toBe(401);
    expect(
      (
        await page.request.put('/api/profile', {
          headers: { Origin: 'https://untrusted.invalid' },
          data: {},
        })
      ).status(),
    ).toBe(403);
    otherContext = await browser.newContext();
    await signIn(otherContext, otherEmail, password);
    expect(
      (await otherContext.request.get(`/api${registrationPath}`)).status(),
    ).toBe(404);
    await transitionEdition(actor, organizationId, contest.id, edition.id, {
      version: 1,
      status: 'archived',
    });
    await page.reload();
    await expect(page.getByLabel('Nome', { exact: true })).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Salva dati iscrizione' }),
    ).toHaveCount(0);
  } finally {
    await otherContext?.close();
    if (organizationId) {
      const where = { organizationId };
      await owner.outboxEvent.deleteMany({ where });
      await owner.registrationEvent.deleteMany({ where });
      await owner.registration.deleteMany({ where });
      await owner.auditEvent.deleteMany({ where });
      await owner.section.deleteMany({ where });
      await owner.editionRevision.deleteMany({ where });
      await owner.edition.deleteMany({ where });
      await owner.contest.deleteMany({ where });
      await owner.organizationMembership.deleteMany({ where });
      await owner.organization.delete({ where: { id: organizationId } });
    }
    await owner.person.deleteMany({ where: { userId: { in: users } } });
    await owner.user.deleteMany({ where: { id: { in: users } } });
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
  await context.addCookies(
    response.headers
      .getSetCookie()
      .map((cookie) => {
        const pair = cookie.split(';')[0],
          i = pair.indexOf('=');
        return {
          name: pair.slice(0, i),
          value: pair.slice(i + 1),
          url: 'http://127.0.0.1:3100',
          httpOnly: true,
          sameSite: 'Lax' as const,
        };
      })
      .filter((cookie) => cookie.value),
  );
}
