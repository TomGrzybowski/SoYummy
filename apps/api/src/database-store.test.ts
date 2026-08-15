import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, schema } from '@so-yummy/db';
import { eq } from 'drizzle-orm';
import { AuthService } from './auth-service.js';
import { DatabaseStore } from './database-store.js';
import type { Mailer } from './mailer.js';

const runIntegration = Boolean(process.env.CI && process.env.DATABASE_URL);

describe.runIf(runIntegration)('DatabaseStore integration', () => {
  let db: ReturnType<typeof createDatabase>;
  let store: DatabaseStore;
  const email = `database-store-${randomUUID()}@example.com`;
  let userId = '';
  let token = '';
  const mailer: Mailer = { async sendCode() {}, async sendPasswordChanged() {} };

  beforeAll(() => {
    db = createDatabase();
    store = new DatabaseStore(db);
  });

  afterAll(async () => {
    if (userId) await db.delete(schema.users).where(eq(schema.users.id, userId));
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.email, email));
    await db.$client.end();
  });

  it('persists authentication and every mutable user feature', async () => {
    const auth = new AuthService(
      store,
      mailer,
      'database-integration-pepper',
      undefined,
      () => '123456',
    );
    await auth.requestRegistration(
      { name: 'Database User', email, password: 'strong-password' },
      '127.0.0.10',
    );
    const activated = await auth.verifyRegistration(email, '123456');
    userId = activated.user.id;
    token = activated.token;
    expect((await store.userForToken(token))?.email).toBe(email);
    expect((await store.updateUser(userId, { name: 'Updated User' })).name).toBe('Updated User');

    const ingredient = store.catalog.ingredients[0]!;
    const recipe = await store.addRecipe(
      userId,
      {
        title: 'Database integration recipe',
        category: 'Test',
        area: '',
        instructions: 'These are sufficiently long integration test instructions.',
        description: '',
        time: 10,
        ingredients: [{ ingredientId: ingredient.id, measure: '1 cup' }],
      },
      '/images/recipe-placeholder.svg',
    );
    expect((await store.recipe(recipe.id))?.ownerId).toBe(userId);

    await store.addFavorite(userId, recipe.id);
    expect(await store.favoriteIds(userId)).toContain(recipe.id);
    await store.addShopping(userId, ingredient.id, '2 cups');
    expect(await store.shoppingItems(userId)).toContainEqual(
      expect.objectContaining({ ingredientId: ingredient.id, measure: '2 cups' }),
    );
    expect(await store.unseenAchievements(userId)).toEqual(
      expect.arrayContaining(['first-favorite', 'first-shopping-list']),
    );
    await store.markSeen(userId, 'first-favorite');
    expect(await store.unseenAchievements(userId)).not.toContain('first-favorite');
    expect(await store.subscribe(email)).toBe(true);
    expect(await store.subscribe(email)).toBe(false);

    await store.removeFavorite(userId, recipe.id);
    await store.removeShopping(userId, ingredient.id);
    await store.deleteRecipe(userId, recipe.id);
    expect(await store.recipe(recipe.id)).toBeUndefined();
    await store.logout(token);
    expect(await store.userForToken(token)).toBeUndefined();
  });
});
