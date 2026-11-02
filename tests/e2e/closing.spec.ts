import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { saveContestCover } from '../../apps/web/src/server/competitions/cover';
import { createDatabase } from '@lumio/database';
import {
  saveContest,
  saveEdition,
  transitionEdition,
} from '../../apps/web/src/server/competitions';
import { closingEditions } from '../../apps/web/src/server/participants';
import { emptyEdition } from '../../apps/web/src/lib/competitions';

test('closing carousel selects five distinct open contests and supports mobile controls', async ({
  page,
}) => {
  test.setTimeout(90000);
  if (!process.env.MIGRATION_DATABASE_URL)
    throw new Error('Isolated database required');
  const owner = createDatabase(process.env.MIGRATION_DATABASE_URL);
  const suffix = randomBytes(8).toString('hex');
  const actor = {
    id: `closing-${suffix}`,
    emailVerified: true,
    twoFactorEnabled: true,
  };
  const orgId = `closing-org-${suffix}`;
  const now = Date.now();
  const date = (days: number) => new Date(now + days * 86400000).toISOString();
  try {
    await owner.user.create({
      data: {
        ...actor,
        name: 'Synthetic organizer',
        email: `${actor.id}@example.invalid`,
      },
    });
    await owner.organization.create({
      data: {
        id: orgId,
        name: 'Synthetic carousel',
        slug: orgId,
        contactEmail: 'carousel@example.invalid',
      },
    });
    await owner.organizationMembership.create({
      data: { organizationId: orgId, userId: actor.id },
    });
    async function edition(
      contestId: string,
      slug: string,
      open: number,
      close: number,
      publish = true,
    ) {
      const saved = await saveEdition(actor, orgId, contestId, {
        configuration: {
          ...emptyEdition(slug, slug, '2026'),
          description: 'Synthetic competition edition',
          opensAt: date(open),
          closesAt: date(close),
          juryAt: date(close + 2),
          awardsAt: date(close + 3),
          regulations: 'Synthetic rules',
          privacy: 'Synthetic privacy',
          sections: [
            {
              name: 'Libero',
              code: 'L',
              description: '',
              theme: '',
              type: 'single',
              minImages: 1,
              maxImages: 1,
              feeCents: 0,
              specificRules: '',
            },
          ],
        },
      });
      if (publish)
        await transitionEdition(actor, orgId, contestId, saved.id, {
          version: 1,
          status: 'published',
        });
      return saved;
    }
    for (let i = 0; i < 7; i++) {
      const contest = await saveContest(actor, orgId, {
        name: `Concorso ${i}`,
        slug: `concorso-${i}`,
        description: '',
      });
      await edition(contest.id, `edizione-${i}`, -1, i + 1);
      if (i === 0) {
        await edition(contest.id, 'duplicate-contest', -1, 0.5);
        await saveContestCover(
          actor,
          orgId,
          contest.id,
          readFileSync('tests/fixtures/contest-cover.png'),
        );
      }
      if (i === 1) {
        await edition(contest.id, 'future', 2, 3);
        await edition(contest.id, 'expired', -3, -2);
        await edition(contest.id, 'draft', -1, 0.25, false);
        const archived = await edition(contest.id, 'archived', -1, 0.3);
        await transitionEdition(actor, orgId, contest.id, archived.id, {
          version: 1,
          status: 'archived',
        });
      }
    }
    const selected = await closingEditions();
    expect(selected.map((row) => row.contestName)).toEqual([
      'Concorso 0',
      'Concorso 1',
      'Concorso 2',
      'Concorso 3',
      'Concorso 4',
    ]);
    expect(selected[0].name).toBe('duplicate-contest');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const carousel = page.getByRole('region', { name: 'Concorsi in scadenza' });
    await expect
      .poll(() =>
        carousel
          .locator('img')
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    if (!process.env.CI) {
      await page.screenshot({
        path: '.tools/design-preview/carousel-mobile.png',
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({
        path: '.tools/design-preview/carousel-desktop.png',
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await expect(
      carousel.getByRole('heading', { name: 'Concorso 0', exact: true }),
    ).toBeVisible();
    await carousel.getByRole('button', { name: 'Concorso successivo' }).click();
    await expect(
      carousel.getByRole('heading', { name: 'Concorso 1', exact: true }),
    ).toBeVisible();
    await carousel.getByRole('button', { name: 'Concorso precedente' }).click();
    await expect(
      carousel.getByRole('heading', { name: 'Concorso 0', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(
      carousel.getByRole('button', { name: 'Riprendi' }),
    ).toBeVisible();
    await carousel.getByRole('button', { name: 'Riprendi' }).click();
    await page.getByRole('link', { name: 'Lumio, home' }).focus();
    await page.mouse.move(0, 0);
    await expect(
      carousel.getByRole('heading', { name: 'Concorso 1', exact: true }),
    ).toBeVisible({ timeout: 10000 });
    await carousel.getByRole('button', { name: 'Pausa', exact: true }).click();
    for (let i = 1; i < 7; i++) {
      const rows = await owner.edition.findMany({
        where: {
          organizationId: orgId,
          contest: { name: `Concorso ${i}` },
          status: 'published',
        },
      });
      for (const row of rows)
        await transitionEdition(actor, orgId, row.contestId, row.id, {
          version: row.version,
          status: 'archived',
        });
    }
    await page.reload();
    await expect(carousel.getByRole('button')).toHaveCount(0);
    await expect(
      carousel.getByRole('link', { name: 'Scopri il concorso' }),
    ).toHaveAttribute('href', `/editions/${selected[0].editionId}`);
    await page.clock.install({ time: new Date(now) });
    await page.clock.setSystemTime(new Date(now + 2 * 86400000));
    await page.clock.runFor(1100);
    await expect(
      carousel.getByRole('link', { name: 'Vai al catalogo' }),
    ).toBeVisible();
    await owner.organization.update({
      where: { id: orgId },
      data: { status: 'suspended' },
    });
    expect(await closingEditions()).toEqual([]);
    await page.reload();
    await expect(
      carousel.getByRole('link', { name: 'Vai al catalogo' }),
    ).toBeVisible();
  } finally {
    const where = { organizationId: orgId };
    await owner.auditEvent.deleteMany({ where });
    await owner.section.deleteMany({ where });
    await owner.editionRevision.deleteMany({ where });
    await owner.edition.deleteMany({ where });
    await owner.contest.deleteMany({ where });
    await owner.organizationMembership.deleteMany({ where });
    await owner.organization.deleteMany({ where: { id: orgId } });
    await owner.person.deleteMany({ where: { userId: actor.id } });
    await owner.user.deleteMany({ where: { id: actor.id } });
    await owner.$disconnect();
  }
});
