import { test, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '@lumio/database';
import { authentication } from '../../apps/web/src/server/auth';
import { listCompetitions } from '../../apps/web/src/server/competitions';

test('shared home and administrative navigation respect roles and mobile focus', async ({
  browser,
  page,
}) => {
  test.setTimeout(90000);
  if (!process.env.MIGRATION_DATABASE_URL)
    throw new Error('Isolated DB required');
  const owner = createDatabase(process.env.MIGRATION_DATABASE_URL);
  const users: string[] = [];
  const contexts: BrowserContext[] = [];
  let organizationId = '';
  try {
    await page.goto('/');
    await expect(
      page.getByRole('navigation', { name: 'Gestione Lumio', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Concorsi da scoprire' }),
    ).toBeVisible();
    for (const role of ['participant', 'organization', 'platform'] as const) {
      const email = `navigation-${randomUUID()}@example.invalid`,
        password = randomUUID();
      const signup = await authentication().api.signUpEmail({
        body: { name: 'Navigation fixture', email, password },
      });
      users.push(signup.user.id);
      await owner.user.update({
        where: { id: signup.user.id },
        data: { emailVerified: true },
      });
      if (role === 'organization') {
        const org = await owner.organization.create({
          data: {
            name: 'Navigation organization',
            slug: `nav-${randomUUID()}`,
            contactEmail: email,
            memberships: { create: { userId: signup.user.id } },
          },
        });
        organizationId = org.id;
      }
      if (role === 'platform')
        await owner.platformRole.create({
          data: { userId: signup.user.id, role: 'super_admin' },
        });
      const context = await browser.newContext();
      contexts.push(context);
      const login = await authentication().api.signInEmail({
        body: { email, password },
        asResponse: true,
      });
      expect(login.status).toBe(200);
      await context.addCookies(
        login.headers
          .getSetCookie()
          .map((cookie) => {
            const pair = cookie.split(';')[0],
              index = pair.indexOf('=');
            return {
              name: pair.slice(0, index),
              value: pair.slice(index + 1),
              url: 'http://127.0.0.1:3100',
            };
          })
          .filter((cookie) => cookie.value),
      );
      const view = await context.newPage();
      await view.setViewportSize({ width: 1440, height: 1000 });
      await view.goto('/');
      const navigation = view.getByRole('navigation', {
        name: 'Gestione Lumio',
        exact: true,
      });
      if (role === 'participant') {
        await expect(navigation).toHaveCount(0);
        await expect(
          view.getByRole('button', { name: 'Menu di gestione', exact: false }),
        ).toHaveCount(0);
        continue;
      }
      await expect(navigation).toHaveCount(1);
      await expect(
        navigation.getByRole('link', { name: 'Home', exact: true }),
      ).toBeVisible();
      await expect(
        navigation.getByRole('link', { name: 'Console Lumio' }),
      ).toHaveCount(role === 'platform' ? 1 : 0);
      await expect(
        view.getByRole('navigation', { name: 'Gestione organizzazione' }),
      ).toHaveCount(0);
      if (!process.env.CI && role === 'organization')
        await view.screenshot({
          path: '.tools/design-preview/admin-home-desktop.png',
          fullPage: true,
        });
      if (role === 'platform') {
        expect(
          (
            await context.request.get(
              `/api/v1/organizations/${organizationId}/contests`,
            )
          ).status(),
        ).toBe(403);
        await expect(
          listCompetitions(
            { id: signup.user.id, emailVerified: true, twoFactorEnabled: true },
            organizationId,
          ),
        ).rejects.toMatchObject({ status: 404 });
        await view.goto('/platform');
        await expect(
          view.getByRole('heading', { name: 'Proteggi la console Lumio' }),
        ).toBeVisible();
      } else {
        expect(
          (
            await context.request.get(
              `/api/v1/organizations/${organizationId}/contests`,
            )
          ).status(),
        ).toBe(403);
        await view.goto(`/organizations/${organizationId}`);
        await expect(
          view.getByRole('navigation', { name: 'Gestione organizzazione' }),
        ).toHaveCount(1);
      }
      await view.goto('/account');
      await expect(navigation).toHaveCount(1);
      for (const width of [320, 390]) {
        await view.setViewportSize({ width, height: 900 });
        const trigger = view.getByRole('button', {
          name: 'Menu di gestione',
          exact: false,
        });
        await trigger.click();
        const menu = view.getByRole('dialog', { name: 'Menu di gestione' });
        await expect(menu).toBeVisible();
        if (!process.env.CI && role === 'organization' && width === 390)
          await view.screenshot({
            path: '.tools/design-preview/admin-menu-mobile.png',
          });
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await view.keyboard.press('Shift+Tab');
        expect(
          await menu.evaluate((element) =>
            element.contains(document.activeElement),
          ),
        ).toBe(true);
        await view.keyboard.press('Escape');
        await expect(menu).not.toBeVisible();
        await expect(trigger).toBeFocused();
        await trigger.click();
        await menu.getByRole('link', { name: 'Home', exact: true }).click();
        await expect(view).toHaveURL('/');
        await expect(menu).not.toBeVisible();
        expect(
          await view.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const bounds = await view.evaluate(() => {
          const main = document.querySelector('main')!,
            footer = document.querySelector('.footer-inner')!;
          return [
            main.getBoundingClientRect().left +
              parseFloat(getComputedStyle(main).paddingLeft),
            footer.getBoundingClientRect().left +
              parseFloat(getComputedStyle(footer).paddingLeft),
          ];
        });
        expect(Math.abs(bounds[0] - bounds[1])).toBeLessThan(1);
      }
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    if (organizationId) {
      await owner.organizationMembership.deleteMany({
        where: { organizationId },
      });
      await owner.organization.delete({ where: { id: organizationId } });
    }
    await owner.person.deleteMany({ where: { userId: { in: users } } });
    await owner.user.deleteMany({ where: { id: { in: users } } });
    await owner.$disconnect();
  }
});
