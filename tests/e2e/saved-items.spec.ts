import { expect, test, type Page } from '@playwright/test';

const recipeId = '640cd5ac2d9fecf12e8897fc';
const ingredientId = '640c2dd963a319ea671e372e';

async function mockSavedItems(page: Page) {
  await page.route('**/api/v1/favorites**', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ contentType: 'application/json', body: '{"items":[]}' });
    return route.fulfill({ status: 204 });
  });
  await page.route('**/api/v1/shopping-list**', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ contentType: 'application/json', body: '{"items":[]}' });
    if (route.request().method() === 'POST')
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          item: {
            ingredientId,
            title: 'Onions',
            thumb: 'https://ftp.goit.study/img/so-yummy/ingredients/640c2dd963a319ea671e372e.png',
            measure: '2',
          },
        }),
      });
    return route.fulfill({ status: 204 });
  });
}

async function navigateFromHeader(page: Page, name: 'Favorites' | 'Shopping list') {
  const header = page.locator('header');
  const mobileNav = header.locator('.mobileNav');
  if ((page.viewportSize()?.width ?? 0) < 1280 && (await mobileNav.getAttribute('open')) === null)
    await header.getByLabel('Open navigation').click();
  await header.getByRole('link', { name, exact: true }).click();
}

test('favorite and shopping actions persist into their list pages and can be removed', async ({
  page,
}) => {
  await mockSavedItems(page);
  await page.goto(`/recipe/${recipeId}`);

  const favorite = page.getByRole('button', { name: 'Add to favorite recipes' });
  await favorite.click();
  await expect(page.getByRole('button', { name: 'Remove from favorite recipes' })).toBeVisible();

  const addOnions = page.getByRole('button', { name: 'Add Onions to shopping list' });
  const shoppingRequest = page.waitForRequest(
    (request) => request.url().endsWith('/api/v1/shopping-list') && request.method() === 'POST',
  );
  await addOnions.click();
  expect((await shoppingRequest).postDataJSON()).toEqual({ ingredientId, measure: '2' });
  await expect(page.getByRole('button', { name: 'Onions is in shopping list' })).toBeDisabled();

  await navigateFromHeader(page, 'Favorites');
  await expect(page.getByRole('link', { name: /Spaghetti Bolognese/ })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Spaghetti Bolognese from favorites' }).click();
  await expect(page.getByRole('heading', { name: 'No favorite recipes yet' })).toBeVisible();

  await navigateFromHeader(page, 'Shopping list');
  await expect(page.getByText('Onions', { exact: true })).toBeVisible();
  await expect(page.getByText('2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Onions from shopping list' }).click();
  await expect(page.getByRole('heading', { name: 'Your shopping list is empty' })).toBeVisible();
});

test('adds every remaining recipe ingredient from the heading control', async ({ page }) => {
  const requests: Array<{ ingredientId: string; measure: string }> = [];
  const items: Array<{
    ingredientId: string;
    title: string;
    thumb: string;
    measure: string;
  }> = [];
  await page.route('**/api/v1/favorites**', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ contentType: 'application/json', body: '{"items":[]}' });
    return route.fulfill({ status: 204 });
  });
  await page.route('**/api/v1/shopping-list**', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ items }),
      });
    const input = route.request().postDataJSON() as { ingredientId: string; measure: string };
    requests.push(input);
    const item = { ...input, title: 'Ingredient', thumb: '' };
    items.push(item);
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ item }),
    });
  });
  await page.goto(`/recipe/${recipeId}`);
  const ingredientCount = await page.locator('.ingredients > li').count();

  await page.getByRole('button', { name: 'Add all ingredients to shopping list' }).click();

  await expect(
    page.getByRole('button', { name: 'All ingredients are in shopping list' }),
  ).toBeDisabled();
  expect(requests).toHaveLength(ingredientCount);
  expect(new Set(requests.map((item) => item.ingredientId)).size).toBe(ingredientCount);
  expect(requests.every((item) => item.measure.length > 0)).toBe(true);
});

test('saved-item failures are announced without changing state', async ({ page }) => {
  await page.route('**/api/v1/favorites**', async (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ contentType: 'application/json', body: '{"items":[]}' });
    return route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: '{"message":"Authentication is required."}',
    });
  });
  await page.route('**/api/v1/shopping-list**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '{"items":[]}' }),
  );
  await page.goto(`/recipe/${recipeId}`);
  await page.getByRole('button', { name: 'Add to favorite recipes' }).click();
  await expect(page.locator('.inlineError[role="alert"]')).toHaveText(
    'Authentication is required.',
  );
  await expect(page.getByRole('button', { name: 'Add to favorite recipes' })).toBeVisible();
});

test('fixed light and dark surfaces keep readable colors in dark mode', async ({ page }) => {
  await mockSavedItems(page);
  await page.addInitScript(() => localStorage.setItem('so-yummy-theme', 'dark'));

  await page.goto('/search');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.largeSearch button')).toHaveCSS(
    'background-color',
    'rgb(34, 37, 42)',
  );
  await expect(page.locator('.largeSearch button')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.locator('.profile > a')).toHaveCSS('color', 'rgb(34, 37, 42)');

  await page.goto(`/recipe/${recipeId}`);
  await expect(page.locator('.recipeHero > div')).toHaveCSS('color', 'rgb(34, 37, 42)');
  await expect(page.getByRole('button', { name: 'Add to favorite recipes' })).toHaveCSS(
    'background-color',
    'rgb(34, 37, 42)',
  );
  await expect(page.getByRole('button', { name: 'Add to favorite recipes' })).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  );
  await expect(page.locator('.ingredients li').first()).toHaveCSS('color', 'rgb(34, 37, 42)');
  await expect(page.locator('.ingredients li').first()).toHaveCSS(
    'background-color',
    'rgb(235, 243, 212)',
  );
  await expect(page.locator('.ingredients button').first()).toHaveCSS('color', 'rgb(34, 37, 42)');
  await expect(
    page.getByRole('button', { name: 'Add all ingredients to shopping list' }),
  ).toHaveCSS('color', 'rgb(255, 255, 255)');
});
