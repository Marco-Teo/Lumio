import {
  test,
  expect,
  type BrowserContext,
  type Page,
  type Locator,
} from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { mediaRoot } from '@lumio/media/storage';
import { saveContestCover } from '../../apps/web/src/server/competitions/cover';
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
    await saveContestCover(
      actor,
      organizationId,
      contest.id,
      readFileSync('tests/fixtures/contest-cover.png'),
    );
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
      imageRules: {
        ...emptyEdition('Photo rules', 'photo-rules', '2026').imageRules,
        formats: ['png'] as Array<'png'>,
      },
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
        {
          name: 'Portfolio',
          code: 'P',
          description: '',
          theme: '',
          type: 'portfolio' as const,
          minImages: 2,
          maxImages: 2,
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
    await page.goto('/registrations');
    await expect(
      page.getByRole('heading', { name: 'Le mie iscrizioni' }),
    ).toBeVisible();
    await expect(page.locator('.registration-card img')).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator('.registration-card img')
          .evaluate(
            (image) =>
              image instanceof HTMLImageElement && image.naturalWidth > 0,
          ),
      )
      .toBe(true);
    if (!process.env.CI)
      await page.screenshot({
        path: '.tools/design-preview/participant-desktop.png',
        fullPage: true,
      });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (!process.env.CI)
      await page.screenshot({
        path: '.tools/design-preview/participant-mobile.png',
        fullPage: true,
      });
    await page.getByRole('link', { name: 'Apri bozza', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${registrationPath}$`));
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(
      page.getByText('Stato: Opere e fotografie da verificare'),
    ).toBeVisible();
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
    const works = page.getByRole('region', { name: 'Le tue opere' });
    await works
      .getByLabel('Titolo dell’opera', { exact: true })
      .fill('Paesaggio E2E');
    await works
      .getByRole('button', { name: 'Crea opera', exact: true })
      .click();
    const single = works.getByRole('article', { name: 'Paesaggio E2E' });
    await single
      .getByLabel('Aggiungi fotografia 1 a Paesaggio E2E')
      .setInputFiles('tests/fixtures/contest-cover.png');
    await expect(
      single.getByText('Fotografie conformi', { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await expect(single.getByRole('img')).toBeVisible();
    await expect
      .poll(() =>
        single
          .getByRole('img')
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    const registrationId = registrationPath.split('/').pop()!;
    const first = await owner.photoRevision.findFirstOrThrow({
      where: { registrationId },
      orderBy: { createdAt: 'asc' },
    });
    const filePath = `/api${registrationPath}/photos/${first.id}`;
    expect(
      await (await page.request.get(`${filePath}?original=1`)).body(),
    ).toEqual(readFileSync('tests/fixtures/contest-cover.png'));
    expect((await request.get(filePath)).status()).toBe(401);
    expect((await otherContext.request.get(filePath)).status()).toBe(404);
    expect(
      (await otherContext.request.get(`${filePath}?original=1`)).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post(`/api${registrationPath}/entries`, {
          headers: { Origin: 'https://untrusted.invalid' },
          data: { title: 'Forged', sectionCode: 'L' },
        })
      ).status(),
    ).toBe(403);
    await single.getByLabel('Sostituisci fotografia 1').setInputFiles({
      name: 'corrupt.png',
      mimeType: 'image/png',
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]),
    });
    await expect(single.getByText(/Il file non è leggibile/)).toBeVisible({
      timeout: 20000,
    });
    await single
      .getByLabel('Sostituisci fotografia 1')
      .setInputFiles('tests/fixtures/contest-cover.png');
    await expect(
      single.getByText('Fotografie conformi', { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await expect(
      single.getByText('Fotografia 1 · Revisione 3', { exact: true }),
    ).toBeVisible();
    expect(
      await (await page.request.get(`${filePath}?original=1`)).body(),
    ).toEqual(readFileSync('tests/fixtures/contest-cover.png'));
    await works.getByLabel('Sezione', { exact: true }).selectOption('P');
    await works
      .getByLabel('Titolo dell’opera', { exact: true })
      .fill('Portfolio E2E');
    await works
      .getByRole('button', { name: 'Crea opera', exact: true })
      .click();
    const portfolio = works.getByRole('article', { name: 'Portfolio E2E' });
    const fixture = readFileSync('tests/fixtures/contest-cover.png');
    await portfolio
      .getByLabel('Aggiungi fotografie a Portfolio E2E')
      .setInputFiles(
        [1, 2, 3].map((index) => ({
          name: `troppi-${index}.png`,
          mimeType: 'image/png',
          buffer: fixture,
        })),
      );
    await expect(works.getByRole('alert')).toContainText(
      'Seleziona al massimo 2 file',
    );
    await expect(portfolio.getByRole('img')).toHaveCount(0);
    await expect(
      portfolio.getByText('Da completare', { exact: true }),
    ).toBeVisible();
    await dropPhotos(page, portfolio.locator('.photo-dropzone'), fixture, [
      'portfolio-1.png',
      'portfolio-2.png',
    ]);
    const naming = works.getByRole('form', { name: 'Prepara le foto' });
    await naming
      .getByRole('radio', { name: 'Un titolo per ogni foto' })
      .check();
    await naming
      .getByLabel('Titolo foto 1', { exact: true })
      .fill('Alba sull’acqua');
    const revisionCount = await owner.photoRevision.count({
      where: { registrationId },
    });
    await naming.getByRole('button', { name: 'Carica le foto' }).click();
    expect(
      await naming
        .getByLabel('Titolo foto 2', { exact: true })
        .evaluate((input: HTMLInputElement) => input.validity.valid),
    ).toBe(false);
    expect(await owner.photoRevision.count({ where: { registrationId } })).toBe(
      revisionCount,
    );
    await naming.getByLabel('Titolo foto 2', { exact: true }).fill('Tramonto');
    await page.setViewportSize({ width: 320, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (!process.env.CI)
      await page.screenshot({
        path: '.tools/design-preview/photo-naming-mobile.png',
        fullPage: true,
      });
    await page.setViewportSize({ width: 1280, height: 720 });
    await naming.getByRole('button', { name: 'Carica le foto' }).click();
    await expect(
      portfolio.getByText('Fotografie conformi', { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await expect(portfolio.getByRole('img')).toHaveCount(2);
    await expect(
      portfolio.getByRole('heading', { name: 'Alba sull’acqua', exact: true }),
    ).toBeVisible();
    await expect(
      portfolio.getByRole('heading', { name: 'Tramonto', exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      portfolio.getByRole('heading', { name: 'Alba sull’acqua', exact: true }),
    ).toBeVisible();
    await works.getByLabel('Sezione', { exact: true }).selectOption('L');
    const previousEntries = await owner.entry.count({
      where: { registrationId },
    });
    const previousRevisions = await owner.photoRevision.count({
      where: { registrationId },
    });
    let intercepted = false;
    await page.route(
      '**/api/registrations/*/entries/*/photos/*',
      async (route) => {
        if (!intercepted && route.request().method() === 'PUT') {
          intercepted = true;
          const response = await route.fetch();
          expect(response.status()).toBe(202);
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Interruzione di rete simulata. Riprova.',
            }),
          });
        } else await route.continue();
      },
    );
    await dropPhotos(
      page,
      works.locator('.bulk-photo-picker .photo-dropzone'),
      fixture,
      ['singola-1.png', 'singola-2.png'],
    );
    await naming
      .getByRole('radio', { name: 'Nome comune e foto numerate' })
      .check();
    await naming
      .getByLabel('Nome del gruppo', { exact: true })
      .fill('Paesaggi');
    await naming.getByRole('button', { name: 'Carica le foto' }).click();
    const queue = works.getByRole('region', {
      name: 'Caricamenti selezionati',
    });
    await expect(
      queue.getByText('Originale salvato', { exact: true }),
    ).toHaveCount(1);
    await expect(queue.getByText('Non riuscito', { exact: true })).toHaveCount(
      1,
    );
    await expect(
      queue.getByRole('button', { name: 'Riprova file non riusciti' }),
    ).toBeEnabled();
    expect(await owner.entry.count({ where: { registrationId } })).toBe(
      previousEntries + 2,
    );
    expect(await owner.photoRevision.count({ where: { registrationId } })).toBe(
      previousRevisions + 2,
    );
    await queue
      .getByRole('button', { name: 'Riprova file non riusciti' })
      .click();
    await expect(
      queue.getByText('Originale salvato', { exact: true }),
    ).toHaveCount(2);
    expect(await owner.entry.count({ where: { registrationId } })).toBe(
      previousEntries + 2,
    );
    expect(await owner.photoRevision.count({ where: { registrationId } })).toBe(
      previousRevisions + 2,
    );
    await page.unroute('**/api/registrations/*/entries/*/photos/*');
    await expect(
      works.getByText('Fotografie conformi', { exact: true }),
    ).toHaveCount(4, { timeout: 20000 });
    await expect(
      works.getByRole('article', { name: 'Paesaggi — Foto 1', exact: true }),
    ).toBeVisible();
    await expect(
      works.getByRole('article', { name: 'Paesaggi — Foto 2', exact: true }),
    ).toBeVisible();
    // A grouped portfolio needs only its group name, with ordinal photo labels.
    await works.getByLabel('Sezione', { exact: true }).selectOption('P');
    await works
      .getByLabel('Titolo dell’opera', { exact: true })
      .fill('Raccolta');
    await works
      .getByRole('button', { name: 'Crea opera', exact: true })
      .click();
    const collection = works.getByRole('article', {
      name: 'Raccolta',
      exact: true,
    });
    await dropPhotos(page, collection.locator('.photo-dropzone'), fixture, [
      'gruppo-1.png',
      'gruppo-2.png',
    ]);
    await expect(
      naming.getByRole('radio', { name: 'Nome comune e foto numerate' }),
    ).toBeChecked();
    await naming.getByRole('button', { name: 'Carica le foto' }).click();
    await expect(
      collection.getByText('Fotografie conformi', { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await expect(
      collection.getByRole('heading', { name: 'Foto 1', exact: true }),
    ).toBeVisible();
    await expect(
      collection.getByRole('heading', { name: 'Foto 2', exact: true }),
    ).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await collection
      .getByRole('button', { name: 'Rimuovi opera Raccolta', exact: true })
      .click();
    await expect(collection).toHaveCount(0);
    // Removing a photo clears its card; the empty work can then be removed.
    await works.getByLabel('Sezione', { exact: true }).selectOption('L');
    await works
      .getByLabel('Titolo dell’opera', { exact: true })
      .fill('Da rimuovere');
    await works
      .getByRole('button', { name: 'Crea opera', exact: true })
      .click();
    const removable = works.getByRole('article', {
      name: 'Da rimuovere',
      exact: true,
    });
    await dropPhotos(page, removable.locator('.photo-dropzone'), fixture, [
      'unica.png',
    ]);
    await expect(removable.getByRole('img')).toBeVisible({ timeout: 20000 });
    const beforeRemoval = await owner.photoRevision.count({
      where: { registrationId },
    });
    page.once('dialog', (dialog) => dialog.accept());
    await removable
      .getByRole('button', { name: 'Rimuovi fotografia 1', exact: true })
      .click();
    await expect(removable.locator('.photo-card')).toHaveCount(0);
    page.once('dialog', (dialog) => dialog.accept());
    await removable
      .getByRole('button', { name: 'Rimuovi opera Da rimuovere', exact: true })
      .click();
    await expect(removable).toHaveCount(0);
    expect(await owner.photoRevision.count({ where: { registrationId } })).toBe(
      beforeRemoval,
    );
    await page.setViewportSize({ width: 320, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (!process.env.CI)
      await page.screenshot({
        path: '.tools/design-preview/photos-mobile.png',
        fullPage: true,
      });
    await page.setViewportSize({ width: 1440, height: 1000 });
    if (!process.env.CI)
      await page.screenshot({
        path: '.tools/design-preview/photos-desktop.png',
        fullPage: true,
      });
    await transitionEdition(actor, organizationId, contest.id, edition.id, {
      version: 1,
      status: 'archived',
    });
    await page.reload();
    await expect(page.getByLabel('Nome', { exact: true })).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Salva dati iscrizione' }),
    ).toHaveCount(0);
    await expect(
      works.getByRole('button', { name: 'Crea opera', exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await page.request.post(`/api${registrationPath}/entries`, {
          headers: { Origin: 'http://127.0.0.1:3100' },
          data: { title: 'Closed', sectionCode: 'L' },
        })
      ).status(),
    ).toBe(409);
    await saveContestCover(actor, organizationId, contest.id, null);
    await page.goto('/registrations');
    await expect(
      page.locator('.registration-card .cover-placeholder'),
    ).toBeVisible();
    await expect(page.locator('.registration-card img')).toHaveCount(0);
  } finally {
    await otherContext?.close();
    if (organizationId) {
      const where = { organizationId };
      await owner.outboxEvent.deleteMany({ where });
      await owner.photoProcessing.deleteMany({ where });
      await owner.photoRevision.deleteMany({ where });
      await owner.photo.deleteMany({ where });
      await owner.entry.deleteMany({ where });
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
    if (organizationId)
      await rm(resolve(mediaRoot(), organizationId), {
        recursive: true,
        force: true,
      });
  }
});
async function dropPhotos(
  page: Page,
  target: Locator,
  bytes: Buffer,
  names: string[],
) {
  const transfer = await page.evaluateHandle(
    ({ bytes, names }) => {
      const data = new DataTransfer();
      for (const name of names)
        data.items.add(
          new File([new Uint8Array(bytes)], name, { type: 'image/png' }),
        );
      return data;
    },
    { bytes: Array.from(bytes), names },
  );
  await target.dispatchEvent('dragenter', { dataTransfer: transfer });
  await expect(target).toHaveAttribute('data-dragging', 'true');
  await target.dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
}
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
