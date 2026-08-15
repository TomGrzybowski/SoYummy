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

test('registration waits for and verifies an emailed code', async ({ page }) => {
  await page.route('**/api/v1/auth/**', async (route) => {
    const url = route.request().url();
    if (url.endsWith('/register'))
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ email: 'browser@example.com', codeExpiresInSeconds: 600 }),
      });
    if (url.endsWith('/register/verify'))
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'user-1', name: 'Browser User', email: 'browser@example.com' },
        }),
      });
    return route.fulfill({ status: 202, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/register');
  await page.getByLabel('Name').fill('Browser User');
  await page.getByLabel('Email').fill('browser@example.com');
  await page.getByLabel('Password').fill('browser-strong-password');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/verify-email\?email=browser%40example.com/);
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify account' }).click();
  await expect(page).toHaveURL('/main');
});

test('forgot-password flow requests a code and resets the password', async ({ page }) => {
  await page.route('**/api/v1/auth/password/**', (route) =>
    route.request().url().endsWith('/reset')
      ? route.fulfill({ status: 204 })
      : route.fulfill({ status: 202, contentType: 'application/json', body: '{"accepted":true}' }),
  );
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill('browser@example.com');
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByLabel('New password', { exact: true }).fill('new-browser-password');
  await page.getByLabel('Confirm new password').fill('new-browser-password');
  await page.getByRole('button', { name: 'Reset password' }).click();
  await expect(page).toHaveURL('/signin?passwordReset=1');
});

test('account security requires current password and emailed code', async ({ page }) => {
  await page.route('**/api/v1/auth/password/change/**', (route) =>
    route.request().url().endsWith('/confirm')
      ? route.fulfill({ status: 204 })
      : route.fulfill({ status: 202, contentType: 'application/json', body: '{"accepted":true}' }),
  );
  await page.goto('/account/security');
  await page.getByLabel('Current password').fill('current-browser-password');
  await page.getByLabel('New password', { exact: true }).fill('new-browser-password');
  await page.getByLabel('Confirm new password').fill('new-browser-password');
  await page.getByRole('button', { name: 'Email verification code' }).click();
  await page.getByLabel('Verification code').fill('123456');
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('status')).toContainText('Other sessions were signed out');
});
