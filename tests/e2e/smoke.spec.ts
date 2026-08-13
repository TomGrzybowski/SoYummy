import { expect, test } from '@playwright/test';

test('welcome and recipe discovery flow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to the app!' })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  await page.goto('/main');
  await expect(page.getByRole('heading', { name: 'SoYummy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Breakfast' })).toBeVisible();
});

test('theme persists locally', async ({ page }) => {
  await page.goto('/main');
  const toggle = page.getByRole('button', { name: 'Toggle color theme' });
  const initial = await page.locator('html').getAttribute('data-theme');
  const expected = initial === 'dark' ? 'light' : 'dark';
  await toggle.click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', expected);
});

test('search has an accessible empty state', async ({ page }) => {
  await page.goto('/search?q=definitely-no-such-dish');
  await expect(page.getByRole('heading', { name: 'Try looking for something else' })).toBeVisible();
});
