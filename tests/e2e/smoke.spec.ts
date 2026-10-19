import { expect, test } from '@playwright/test';

test('homepage is accessible and displays Lumio', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('Lumio');
  await expect(
    page.getByRole('heading', { name: 'Lumio', exact: true }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
});

test('liveness returns HTTP 200 and the expected payload', async ({
  request,
}) => {
  const response = await request.get('/api/health/live');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});
