import { expect, test } from '@playwright/test';

test('homepage is accessible and displays Lumio', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('Lumio');
  await expect(
    page.getByRole('heading', {
      name: 'La tua fotografia, il prossimo concorso.',
    }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
});

test('public discovery works on phone, tablet and desktop', async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/editions', '/login', '/register']) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.getByRole('navigation', { name: 'Navigazione principale' }),
      ).toBeVisible();
      if (path === '/' || path === '/editions') {
        await expect(
          page.getByRole('heading', { name: 'Come partecipare' }),
        ).toBeVisible();
        const image = page.locator('.discovery-image img');
        await expect(image).toBeVisible();
        await expect
          .poll(() =>
            image.evaluate((element: HTMLImageElement) => element.naturalWidth),
          )
          .toBeGreaterThan(0);
        expect(
          await page
            .locator('h1')
            .evaluate((element) => getComputedStyle(element).color),
        ).toBe('rgb(0, 0, 0)');
        if (
          !process.env.CI &&
          path === '/editions' &&
          [390, 1440].includes(width)
        ) {
          await page.screenshot({
            path: `.tools/design-preview/discovery-${width}.png`,
            fullPage: true,
          });
        }
      }
    }
  }
  await page.goto('/editions');
  await page.getByRole('link', { name: 'Esplora i concorsi' }).click();
  await expect(page).toHaveURL(/#concorsi$/);
});

test('liveness returns HTTP 200 and the expected payload', async ({
  request,
}) => {
  const response = await request.get('/api/health/live');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});
