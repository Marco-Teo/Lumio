import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { createDatabase } from '@lumio/database';
import { authentication } from '../../apps/web/src/server/auth';
import { totp } from './helpers';
import { regulatoryCatalog } from '../../apps/web/src/lib/regulatory-profiles';
import { editionSchema } from '../../apps/web/src/lib/competitions';

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
    await page
      .getByRole('main')
      .getByRole('link', { name: 'Le tue organizzazioni' })
      .click();
    await page.getByRole('link', { name: org.name }).click();
    await expect(page.getByRole('heading', { name: org.name })).toBeVisible();
    expect(
      (
        await page.request.get('/api/v1/organizations/demo-org-b/contests')
      ).status(),
    ).toBe(404);
    const parallel = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        page.request.get(
          index % 2 === 0
            ? `/api/v1/organizations/${organizationId}/contests`
            : '/api/v1/organizations/demo-org-b/contests',
        ),
      ),
    );
    expect(parallel.map((response) => response.status())).toEqual(
      Array.from({ length: 12 }, (_, index) => (index % 2 === 0 ? 200 : 404)),
    );
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
    await page.getByLabel('Nome concorso').fill('A');
    await page.getByLabel('Slug concorso').fill('Non valido');
    await page.getByRole('button', { name: 'Salva concorso' }).click();
    await expect(
      page.getByRole('alert', { name: 'Errori di compilazione' }),
    ).toContainText('Nome concorso: Inserisci almeno 2 caratteri.');
    await expect(
      page.getByRole('alert', { name: 'Errori di compilazione' }),
    ).toContainText('Slug concorso: Usa da 2 a 80 caratteri');
    await page.getByRole('link', { name: /^Slug concorso:/ }).click();
    await expect(page.getByLabel('Slug concorso')).toBeFocused();
    await page.getByLabel('Nome concorso').fill('Concorso annuale');
    await page.getByLabel('Slug concorso').fill('concorso-annuale');
    await page
      .getByLabel('Descrizione concorso')
      .fill('Contenitore permanente');
    await page
      .getByLabel('Immagine del concorso')
      .setInputFiles('tests/fixtures/contest-cover.png');
    await page.getByRole('button', { name: 'Salva concorso' }).click();
    await expect(page.getByRole('status')).toContainText('Concorso salvato');
    await page.getByRole('button', { name: 'Nuova edizione' }).click();
    await page.getByRole('button', { name: 'Salva bozza' }).click();
    await expect(
      page.getByRole('alert', { name: 'Errori di compilazione' }),
    ).toContainText('Nome edizione:');
    await expect(page.getByLabel('Nome edizione')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
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
    await expect(
      page.getByLabel('Dimensione massima file (MiB)', { exact: true }),
    ).toHaveValue('4.76837158203125');
    await expect(
      page.getByText('Massimo 25 MiB.', { exact: false }),
    ).toBeVisible();
    await page.getByLabel('Nome edizione').fill('Edizione 2027');
    await page.getByLabel('Slug edizione').fill('edizione-2027');
    await page.getByLabel('Anno o identificatore').fill('2027');
    await page.getByRole('button', { name: 'Salva bozza' }).click();
    await expect(page.getByRole('status')).toContainText('Bozza salvata');
    const savedIndependent = await owner.edition.findFirstOrThrow({
      where: { organizationId, name: 'Edizione 2027' },
    });
    const originalRevision = await owner.editionRevision.findFirstOrThrow({
      where: { editionId: savedIndependent.id, version: 1 },
    });
    expect(originalRevision.configuration).not.toHaveProperty(
      'regulatoryProfile',
    );
    const profileIds = regulatoryCatalog.profiles
      .filter((profile) => profile.normativeVersion === '2027')
      .map((profile) => profile.id);
    const editionApi = `/api/v1/organizations/${organizationId}/contests/${savedIndependent.contestId}/editions/${savedIndependent.id}`;
    const forged = await page.request.put(editionApi, {
      headers: { Origin: 'http://127.0.0.1:3100' },
      data: {
        version: 1,
        configuration: {
          ...(originalRevision.configuration as object),
          regulatoryProfile: {
            id: profileIds[0],
            normativeVersion: 'invented',
          },
        },
      },
    });
    expect(forged.status()).toBe(400);
    expect(
      (
        await owner.edition.findUniqueOrThrow({
          where: { id: savedIndependent.id },
        })
      ).version,
    ).toBe(1);
    for (const id of [...profileIds, '', profileIds[0]]) {
      await page.setViewportSize({
        width: id === profileIds[0] ? 320 : 390,
        height: 844,
      });
      await page.getByRole('button', { name: 'Configura edizione' }).click();
      const selector = page.getByLabel('Tipo di configurazione', {
        exact: true,
      });
      const previous = await selector.inputValue();
      const before = await owner.edition.findUniqueOrThrow({
        where: { id: savedIndependent.id },
      });
      await selector.selectOption(id);
      const confirmation = page.getByRole('group', {
        name: 'Conferma cambio configurazione',
        exact: true,
      });
      await expect(confirmation).toContainText('Da:');
      await expect(confirmation).toContainText('A:');
      await expect(
        page.getByRole('button', { name: 'Salva bozza' }),
      ).toBeDisabled();
      await page
        .getByRole('button', { name: 'Annulla cambio profilo' })
        .focus();
      await page.keyboard.press('Enter');
      await expect(selector).toHaveValue(previous);
      await expect(selector).toBeFocused();
      await expect(
        page.getByText('Modifiche non salvate', { exact: true }),
      ).toHaveCount(0);
      expect(
        (
          await owner.edition.findUniqueOrThrow({
            where: { id: savedIndependent.id },
          })
        ).version,
      ).toBe(before.version);
      await selector.selectOption(id);
      await page
        .getByRole('button', { name: 'Conferma cambio profilo' })
        .focus();
      await page.keyboard.press('Enter');
      await expect(selector).toBeFocused();
      await expect(
        page.getByText('Modifiche non salvate', { exact: true }),
      ).toBeVisible();
      const box = await selector.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(
        page.viewportSize()!.width,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      if (id === profileIds[1]) {
        await page
          .getByLabel('Descrizione edizione')
          .fill('Testo locale da conservare');
        for (const failure of ['http', 'network', 'conflict'] as const) {
          await page.route(
            `**${editionApi}`,
            async (route) => {
              if (failure === 'network') await route.abort('failed');
              else
                await route.fulfill({
                  status: failure === 'conflict' ? 409 : 503,
                  contentType: 'application/json',
                  body: JSON.stringify({
                    message:
                      failure === 'conflict'
                        ? 'La bozza è cambiata. Ricarica la pagina.'
                        : 'Servizio temporaneamente non disponibile',
                  }),
                });
            },
            { times: 1 },
          );
          await page.getByRole('button', { name: 'Salva bozza' }).click();
          await expect(
            page.locator('.edition-form').getByRole('alert'),
          ).toContainText('Salvataggio non confermato');
          await expect(
            page.getByText('Modifiche non salvate', { exact: true }),
          ).toBeVisible();
          await expect(selector).toHaveValue(id);
          await expect(page.getByLabel('Descrizione edizione')).toHaveValue(
            'Testo locale da conservare',
          );
          await expect(page.getByRole('status')).not.toContainText(
            'Bozza salvata',
          );
          expect(
            (
              await owner.edition.findUniqueOrThrow({
                where: { id: savedIndependent.id },
              })
            ).version,
          ).toBe(before.version);
        }
        await page.getByLabel('Descrizione edizione').fill('');
      }
      if (id)
        await expect(
          page
            .getByText(
              'Configurazione FIAF selezionata — verifiche normative non ancora disponibili',
              { exact: true },
            )
            .last(),
        ).toBeVisible();
      await page.getByRole('button', { name: 'Salva bozza' }).click();
      await expect(page.getByRole('status')).toContainText('Bozza salvata');
      await expect(
        page.getByText('Modifiche non salvate', { exact: true }),
      ).toHaveCount(0);
      const updated = await owner.edition.findUniqueOrThrow({
        where: { id: savedIndependent.id },
      });
      const revision = await owner.editionRevision.findFirstOrThrow({
        where: { editionId: updated.id, version: updated.version },
      });
      expect(revision.configuration).toEqual({
        ...(originalRevision.configuration as object),
        ...(id ? { regulatoryProfile: { id } } : {}),
      });
      await page.reload();
      await page.getByRole('button', { name: 'Configura edizione' }).click();
      await expect(selector).toHaveValue(id);
      await page.getByRole('button', { name: 'Chiudi configurazione' }).click();
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(
      (
        await owner.editionRevision.findFirstOrThrow({
          where: { editionId: savedIndependent.id, version: 1 },
        })
      ).configuration,
    ).toEqual(originalRevision.configuration);
    for (const [input, bytes] of [
      ['25', 26_214_400],
      ['12,5', 13_107_200],
      ['4.76837158203125', 5_000_000],
      ['25', 26_214_400],
    ] as const) {
      await page.getByRole('button', { name: 'Configura edizione' }).click();
      const limit = page.getByLabel('Dimensione massima file (MiB)', {
        exact: true,
      });
      await limit.fill('25.00000095367431640625');
      await page.getByRole('button', { name: 'Salva bozza' }).click();
      await expect(
        page.getByRole('alert', { name: 'Errori di compilazione' }),
      ).toContainText('25 MiB');
      await limit.fill('0.1');
      await page.getByRole('button', { name: 'Salva bozza' }).click();
      await expect(
        page.getByRole('alert', { name: 'Errori di compilazione' }),
      ).toContainText('numero intero di byte');
      await limit.fill(input);
      const [response] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === 'PUT' &&
            response.url().includes('/editions/'),
        ),
        page.getByRole('button', { name: 'Salva bozza' }).click(),
      ]);
      expect(response.ok()).toBe(true);
      const saved = await owner.edition.findFirstOrThrow({
        where: { organizationId, name: 'Edizione 2027' },
      });
      const revision = await owner.editionRevision.findFirstOrThrow({
        where: { editionId: saved.id, version: saved.version },
      });
      expect(revision.configuration).toMatchObject({
        imageRules: { maxBytes: bytes },
      });
      await page.reload();
      await page.getByRole('button', { name: 'Configura edizione' }).click();
      await expect(
        page.getByLabel('Dimensione massima file (MiB)', { exact: true }),
      ).toHaveValue(input.replace(',', '.'));
      await page.getByRole('button', { name: 'Chiudi configurazione' }).click();
    }
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
    await second.getByLabel('Codice sezione').fill('L');
    await page.getByLabel('Data giuria').fill('2027-01-15T10:00');
    await page.getByRole('button', { name: 'Salva bozza' }).click();
    await expect(
      page.getByRole('alert', { name: 'Errori di compilazione' }),
    ).toContainText('Sezione 2 · Codice sezione: Codice già utilizzato');
    await expect(
      page.getByRole('alert', { name: 'Errori di compilazione' }),
    ).toContainText(
      'Data giuria: Scegli una data e un’ora successive a «Chiusura iscrizioni»',
    );
    await second.getByLabel('Codice sezione').fill('P');
    await page.getByLabel('Data giuria').fill('2027-03-01T10:00');
    await first.getByLabel('Quota sezione').fill('500');
    await page.getByRole('button', { name: 'Salva bozza' }).click();
    await expect(
      page.getByRole('alert', { name: 'Errori di compilazione' }),
    ).toContainText('Sezione 1 · Quota sezione: Imposta la quota a 0');
    await first.getByLabel('Quota sezione').fill('0');
    await expect(
      page.getByRole('alert', { name: 'Errori di compilazione' }),
    ).toHaveCount(0);
    await second.getByRole('button', { name: 'Sposta su' }).click();
    await expect(first.getByLabel('Nome sezione')).toHaveValue('Racconto');
    await page.getByRole('link', { name: 'Generale', exact: true }).click();
    if (!process.env.CI)
      await page.screenshot({
        path: '.tools/design-preview/organizer-desktop.png',
      });
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
    const savedContest = await owner.contest.findUniqueOrThrow({
      where: { id: savedEdition.contestId },
    });
    expect(savedContest.coverVersion).toMatch(/^[a-f0-9]{64}$/);
    const image = await request.get(`/api/contests/${savedContest.id}/cover`);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/webp');
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
      .getByRole('link', { name: 'Concorso annuale', exact: true })
      .click();
    await expect(
      publicPage.getByRole('heading', { name: 'Edizione 2027', exact: true }),
    ).toBeVisible();
    await expect(
      publicPage.getByText(/Dimensione massima: 25 MiB/),
    ).toBeVisible();
    await publicPage.close();
    await expect(
      page.getByRole('button', { name: 'Configura edizione' }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Visualizza configurazione' })
      .click();
    await expect(page.getByLabel('Nome edizione')).toBeDisabled();
    await expect(
      page.getByLabel('Tipo di configurazione', { exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByLabel('Tipo di configurazione', { exact: true }),
    ).toHaveValue(profileIds[0]);
    await page.getByRole('button', { name: 'Chiudi configurazione' }).click();
    await page.getByRole('button', { name: 'Archivia edizione' }).click();
    await expect(page.getByRole('status')).toContainText('Edizione archiviata');
    await expect(
      page.getByText('Stato: Archiviata', { exact: false }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Modifica concorso', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Rimuovi immagine', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('Immagine rimossa');
    expect(
      (
        await owner.contest.findUniqueOrThrow({
          where: { id: savedContest.id },
        })
      ).coverVersion,
    ).toBeNull();
    await page.getByRole('link', { name: 'Il tuo account' }).click();
    await page.getByRole('link', { name: 'Torna alla home' }).click();
    await expect(page).toHaveURL('/');
    // New editions can start with either profile without an existing-draft confirmation.
    await page.goto(`/organizations/${organizationId}`);
    page.removeAllListeners('dialog');
    for (const [index, id] of profileIds.entries()) {
      await page.setViewportSize({
        width: index === 0 ? 320 : 390,
        height: 844,
      });
      const name = `Nuova guidata ${index}`;
      await page
        .getByRole('button', { name: 'Nuova edizione', exact: true })
        .click();
      await page
        .getByLabel('Tipo di configurazione', { exact: true })
        .selectOption(id);
      await expect(
        page.getByRole('group', {
          name: 'Conferma cambio configurazione',
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        page.getByText('Modifiche non salvate', { exact: true }),
      ).toBeVisible();
      await page.getByLabel('Nome edizione').fill(name);
      await page.getByLabel('Slug edizione').fill(`nuova-guidata-${index}`);
      await page.getByLabel('Anno o identificatore').fill('2027');
      for (let sectionIndex = 0; sectionIndex < 3; sectionIndex++)
        await page.getByRole('button', { name: 'Aggiungi sezione' }).click();
      const classificationIds = await page
        .getByLabel('Sezione normativa FIAF', { exact: true })
        .evaluateAll((elements) => elements.map((element) => element.id));
      expect(classificationIds).toHaveLength(3);
      expect(new Set(classificationIds).size).toBe(3);
      for (const [position, sectionType] of [
        'DIG',
        'PORTFOLIO',
        'IS',
      ].entries()) {
        const group = page.getByRole('group', {
          name: `Sezione ${position + 1}`,
          exact: true,
        });
        await group
          .getByLabel('Nome sezione', { exact: true })
          .fill(`Classificata ${sectionType}`);
        await group
          .getByLabel('Codice sezione', { exact: true })
          .fill(`OWN-${position + 1}`);
        await group
          .getByLabel('Tema', { exact: true })
          .fill('Testo libero dell’organizzatore');
        if (position === 1) {
          const first = page.getByRole('group', {
            name: 'Sezione 1',
            exact: true,
          });
          await group
            .getByLabel('Codice sezione', { exact: true })
            .fill('OWN-1');
          await expect(
            group.getByLabel('Codice sezione', { exact: true }),
          ).toHaveValue('OWN-2');
          await expect(
            group.getByText('Codice già utilizzato', { exact: false }),
          ).toBeVisible();
          await group
            .getByLabel('Codice sezione', { exact: true })
            .fill('OWN-B');
          await expect(
            first.getByLabel('Codice tema normativo FIAF'),
          ).toHaveValue('PA');
          await expect(
            first.getByLabel('Categoria normativa FIAF'),
          ).toHaveValue('TRAD');
          await group
            .getByRole('button', { name: 'Rimuovi sezione', exact: true })
            .click();
          await expect(
            page.getByRole('button', { name: 'Aggiungi sezione' }),
          ).toBeFocused();
          await expect(
            first.getByLabel('Codice tema normativo FIAF'),
          ).toHaveValue('PA');
          await expect(
            first.getByLabel('Categoria normativa FIAF'),
          ).toHaveValue('TRAD');
          await page.getByRole('button', { name: 'Aggiungi sezione' }).click();
          await group
            .getByLabel('Nome sezione', { exact: true })
            .fill(`Classificata ${sectionType}`);
          await group
            .getByLabel('Codice sezione', { exact: true })
            .fill('OWN-2');
          await group
            .getByLabel('Tema', { exact: true })
            .fill('Testo libero dell’organizzatore');
        }
        if (sectionType === 'PORTFOLIO')
          await group
            .getByLabel('Tipo opera', { exact: true })
            .selectOption('portfolio');
        const beforeMin = await group
          .getByLabel('Minimo immagini per opera')
          .inputValue();
        const beforeMax = await group
          .getByLabel('Massimo immagini per opera')
          .inputValue();
        await group
          .getByLabel('Sezione normativa FIAF', { exact: true })
          .selectOption(sectionType);
        await group
          .getByLabel('Codice tema normativo FIAF')
          .fill(sectionType === 'IS' ? 'LB' : 'PA');
        if (sectionType === 'DIG')
          await group
            .getByLabel('Categoria normativa FIAF')
            .selectOption('TRAD');
        await expect(group.getByLabel('Minimo immagini per opera')).toHaveValue(
          beforeMin,
        );
        await expect(
          group.getByLabel('Massimo immagini per opera'),
        ).toHaveValue(beforeMax);
        await expect(group.getByLabel('Tema', { exact: true })).toHaveValue(
          'Testo libero dell’organizzatore',
        );
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.getByRole('button', { name: 'Salva bozza' }).click();
      await expect(page.getByRole('status')).toContainText('Bozza salvata');
      await expect(
        page.getByText('Modifiche non salvate', { exact: true }),
      ).toHaveCount(0);
      await page.reload();
      const row = page.locator('.edition-row').filter({
        has: page.getByRole('heading', {
          name: `${name} — 2027`,
          exact: true,
        }),
      });
      await row
        .getByRole('button', { name: 'Configura edizione', exact: true })
        .click();
      await expect(
        page.getByLabel('Tipo di configurazione', { exact: true }),
      ).toHaveValue(id);
      const firstGroup = page.getByRole('group', {
        name: 'Sezione 1',
        exact: true,
      });
      await expect(
        firstGroup.getByLabel('Sezione normativa FIAF', { exact: true }),
      ).toHaveValue('DIG');
      await expect(
        firstGroup.getByLabel('Categoria normativa FIAF'),
      ).toHaveValue('TRAD');
      const savedMapping = await owner.edition.findFirstOrThrow({
        where: { organizationId, name },
      });
      const firstRevision = await owner.editionRevision.findFirstOrThrow({
        where: { editionId: savedMapping.id, version: 1 },
      });
      for (const theme of ['NA', 'NW', 'RP', 'TR']) {
        await firstGroup.getByLabel('Codice tema normativo FIAF').fill(theme);
        await expect(
          firstGroup.getByLabel('Categoria normativa FIAF'),
        ).toHaveValue('TRAD');
        await expect(
          firstGroup
            .getByLabel('Categoria normativa FIAF')
            .locator('option[value="TRAD"]'),
        ).toBeDisabled();
      }
      await firstGroup.getByLabel('Codice tema normativo FIAF').fill('PA');
      await firstGroup
        .getByLabel('Sezione normativa FIAF', { exact: true })
        .selectOption('IS');
      await expect(
        firstGroup
          .getByLabel('Categoria normativa FIAF')
          .locator('option[value="TRAD"]'),
      ).toBeDisabled();
      await expect(
        firstGroup.getByLabel('Categoria normativa FIAF'),
      ).toHaveValue('TRAD');
      await firstGroup.getByLabel('Categoria normativa FIAF').selectOption('');
      await firstGroup
        .getByLabel('Sezione normativa FIAF', { exact: true })
        .selectOption('DIG');
      await firstGroup
        .getByLabel('Categoria normativa FIAF')
        .selectOption('TRAD');
      const mappingApi = `/api/v1/organizations/${organizationId}/contests/${savedMapping.contestId}/editions/${savedMapping.id}`;
      await firstGroup.getByLabel('Codice tema normativo FIAF').fill('AR');
      for (const status of [503, 409]) {
        await page.route(
          `**${mappingApi}`,
          (route) =>
            route.fulfill({
              status,
              contentType: 'application/json',
              body: JSON.stringify({
                message:
                  status === 409
                    ? 'La bozza è cambiata.'
                    : 'Servizio non disponibile.',
              }),
            }),
          { times: 1 },
        );
        await page.getByRole('button', { name: 'Salva bozza' }).click();
        await expect(
          page.locator('.edition-form').getByRole('alert').last(),
        ).toContainText('Salvataggio non confermato');
        await expect(
          firstGroup.getByLabel('Codice tema normativo FIAF'),
        ).toHaveValue('AR');
        await expect(page.getByRole('status')).not.toContainText(
          'Bozza salvata',
        );
        expect(
          (
            await owner.edition.findUniqueOrThrow({
              where: { id: savedMapping.id },
            })
          ).version,
        ).toBe(savedMapping.version);
      }
      await firstGroup.getByLabel('Codice tema normativo FIAF').fill('PA');
      expect(firstRevision.configuration).toMatchObject({
        regulatorySections: {
          profileId: id,
          sections: [
            {
              sectionCode: 'OWN-1',
              sectionType: 'DIG',
              themeCode: 'PA',
              category: 'TRAD',
            },
            { sectionCode: 'OWN-2', sectionType: 'PORTFOLIO', themeCode: 'PA' },
            { sectionCode: 'OWN-3', sectionType: 'IS', themeCode: 'LB' },
          ],
        },
      });
      if (index === 0) {
        await page
          .getByRole('button', { name: 'Chiudi configurazione' })
          .click();
        const listApi = `/api/v1/organizations/${organizationId}/contests`;
        await page.route(
          `**${listApi}`,
          async (route) => {
            const response = await route.fetch();
            const list = (await response.json()) as {
              contests: Array<{
                editions: Array<{
                  id: string;
                  revisions: Array<{ configuration: unknown }>;
                }>;
              }>;
            };
            const edition = list.contests
              .flatMap((contest) => contest.editions)
              .find((edition) => edition.id === savedMapping.id)!;
            const config = editionSchema.parse(
              edition.revisions[0].configuration,
            );
            const mapping = config.regulatorySections!;
            edition.revisions[0].configuration = {
              ...config,
              regulatorySections: {
                ...mapping,
                sections: [...mapping.sections, mapping.sections[0]],
              },
            };
            await route.fulfill({ response, json: list });
          },
          { times: 1 },
        );
        await page.reload();
        await row
          .getByRole('button', { name: 'Configura edizione', exact: true })
          .click();
        await expect(
          firstGroup.getByLabel('Sezione normativa FIAF', { exact: true }),
        ).toBeDisabled();
        await expect(
          firstGroup.getByLabel('Codice tema normativo FIAF'),
        ).toBeDisabled();
        await expect(
          firstGroup.getByLabel('Categoria normativa FIAF'),
        ).toBeDisabled();
        await firstGroup
          .getByRole('button', { name: 'Rimuovi sezione', exact: true })
          .click();
        await expect(
          page
            .locator('.edition-form')
            .getByText('Associazione ambigua:', { exact: false })
            .first(),
        ).toBeVisible();
        await firstGroup
          .getByRole('button', {
            name: 'Rinomina codice e aggiorna classificazione',
          })
          .click();
        await page
          .getByRole('link', {
            name: /^Classificazione normativa delle sezioni:/,
          })
          .first()
          .click();
        await expect(
          page.getByRole('group', {
            name: 'Classificazione normativa delle sezioni',
            exact: true,
          }),
        ).toBeFocused();
        await page.getByRole('button', { name: 'Salva bozza' }).click();
        await page
          .getByRole('link', {
            name: /^Classificazione normativa delle sezioni:/,
          })
          .first()
          .click();
        await expect(
          page.getByRole('group', {
            name: 'Classificazione normativa delle sezioni',
            exact: true,
          }),
        ).toBeFocused();
        expect(
          (
            await owner.editionRevision.findFirstOrThrow({
              where: { editionId: savedMapping.id, version: 1 },
            })
          ).configuration,
        ).toEqual(firstRevision.configuration);
        // Historical incompatibility is injected only in the browser response.
        await page.route(
          `**${listApi}`,
          async (route) => {
            const response = await route.fetch();
            const list = (await response.json()) as {
              contests: Array<{
                editions: Array<{
                  id: string;
                  revisions: Array<{ configuration: unknown }>;
                }>;
              }>;
            };
            const edition = list.contests
              .flatMap((contest) => contest.editions)
              .find((edition) => edition.id === savedMapping.id)!;
            const config = editionSchema.parse(
              edition.revisions[0].configuration,
            );
            const mapping = config.regulatorySections!;
            edition.revisions[0].configuration = {
              ...config,
              regulatorySections: {
                ...mapping,
                sections: mapping.sections.map((classification, i) =>
                  i === 0
                    ? {
                        ...classification,
                        sectionType: 'IS',
                        themeCode: 'LB',
                        category: 'TRAD',
                      }
                    : classification,
                ),
              },
            };
            await route.fulfill({ response, json: list });
          },
          { times: 1 },
        );
        await page.reload();
        await row
          .getByRole('button', { name: 'Configura edizione', exact: true })
          .click();
        await expect(
          firstGroup.getByLabel('Categoria normativa FIAF'),
        ).toHaveValue('TRAD');
        await expect(
          firstGroup
            .getByLabel('Categoria normativa FIAF')
            .locator('option[value="TRAD"]'),
        ).toBeDisabled();
        await firstGroup
          .getByLabel('Categoria normativa FIAF')
          .selectOption('');
        await expect(
          firstGroup.getByLabel('Categoria normativa FIAF'),
        ).toHaveValue('');
        page.once('dialog', (dialog) => dialog.accept());
        await firstGroup
          .getByLabel('Sezione normativa FIAF', { exact: true })
          .selectOption('');
        await expect(
          firstGroup.getByLabel('Sezione normativa FIAF', { exact: true }),
        ).toBeFocused();
        await firstGroup
          .getByLabel('Sezione normativa FIAF', { exact: true })
          .selectOption('DIG');
        await firstGroup.getByLabel('Codice tema normativo FIAF').fill('PA');
        await firstGroup
          .getByLabel('Categoria normativa FIAF')
          .selectOption('TRAD');
        page.once('dialog', (dialog) => dialog.dismiss());
        await firstGroup
          .getByRole('button', {
            name: 'Rinomina codice e aggiorna classificazione',
          })
          .click();
        await expect(
          firstGroup.getByLabel('Codice sezione', { exact: true }),
        ).toHaveValue('OWN-1');
        page.once('dialog', (dialog) => dialog.accept('OWN-NEW'));
        await firstGroup
          .getByRole('button', {
            name: 'Rinomina codice e aggiorna classificazione',
          })
          .click();
        await expect(
          firstGroup.getByLabel('Codice sezione', { exact: true }),
        ).toHaveValue('OWN-NEW');
        const secondGroup = page.getByRole('group', {
          name: 'Sezione 2',
          exact: true,
        });
        page.once('dialog', (dialog) => dialog.dismiss());
        await secondGroup
          .getByRole('button', { name: 'Rimuovi sezione', exact: true })
          .click();
        await expect(
          secondGroup.getByLabel('Sezione normativa FIAF', { exact: true }),
        ).toHaveValue('PORTFOLIO');
        page.once('dialog', (dialog) => dialog.accept());
        await secondGroup
          .getByRole('button', { name: 'Rimuovi sezione', exact: true })
          .click();
        await expect(
          page.getByRole('button', { name: 'Aggiungi sezione' }),
        ).toBeFocused();
        await page.getByRole('button', { name: 'Salva bozza' }).click();
        await expect(page.getByRole('status')).toContainText('Bozza salvata');
        await row
          .getByRole('button', { name: 'Configura edizione', exact: true })
          .click();
        await expect(
          firstGroup.getByLabel('Codice sezione', { exact: true }),
        ).toHaveValue('OWN-NEW');
        await expect(
          page
            .getByRole('group', { name: 'Sezione 2', exact: true })
            .getByLabel('Sezione normativa FIAF', { exact: true }),
        ).toHaveValue('IS');
      }
      await page
        .getByLabel('Tipo di configurazione', { exact: true })
        .selectOption(index === 0 ? profileIds[1] : '');
      page.once('dialog', (dialog) => dialog.dismiss());
      await page
        .getByRole('button', { name: 'Conferma cambio profilo' })
        .click();
      await expect(
        firstGroup.getByLabel('Sezione normativa FIAF', { exact: true }),
      ).toHaveValue('DIG');
      await page
        .getByRole('button', { name: 'Annulla cambio profilo' })
        .click();
      await expect(
        page.getByLabel('Tipo di configurazione', { exact: true }),
      ).toHaveValue(id);
      await page
        .getByLabel('Tipo di configurazione', { exact: true })
        .selectOption(index === 0 ? profileIds[1] : '');
      page.once('dialog', (dialog) => dialog.accept());
      await page
        .getByRole('button', { name: 'Conferma cambio profilo' })
        .click();
      await page.getByRole('button', { name: 'Salva bozza' }).click();
      await expect(page.getByRole('status')).toContainText('Bozza salvata');
      const latestMapping = await owner.editionRevision.findFirstOrThrow({
        where: { editionId: savedMapping.id },
        orderBy: { version: 'desc' },
      });
      expect(latestMapping.configuration).not.toHaveProperty(
        'regulatorySections',
      );
      expect(
        (
          await owner.editionRevision.findFirstOrThrow({
            where: { editionId: savedMapping.id, version: 1 },
          })
        ).configuration,
      ).toEqual(firstRevision.configuration);
      await row
        .getByRole('button', { name: 'Configura edizione', exact: true })
        .click();
      await page.getByRole('button', { name: 'Chiudi configurazione' }).click();
    }
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
