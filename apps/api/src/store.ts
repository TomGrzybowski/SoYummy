import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { AchievementCode, CreateRecipeInput, Recipe, User } from '@so-yummy/contracts';
import { loadCatalog } from './catalog';

type InternalUser = User & { passwordHash: string };
export type ShoppingItem = { ingredientId: string; title: string; thumb: string; measure: string };

const sourceCatalog = await loadCatalog();

export class Store {
  readonly catalog = sourceCatalog;
  private users = new Map<string, InternalUser>();
  private sessions = new Map<string, { userId: string; expiresAt: number }>();
  private favorites = new Map<string, Set<string>>();
  private shopping = new Map<string, Map<string, ShoppingItem>>();
  private ownRecipes = new Map<string, Recipe>();
  private subscriptions = new Set<string>();
  private achievements = new Map<string, Map<AchievementCode, boolean>>();

  async register(name: string, email: string, password: string) {
    if ([...this.users.values()].some((user) => user.email === email))
      throw new StoreError('EMAIL_TAKEN', 'An account with this e-mail already exists.', 409);
    const user: InternalUser = {
      id: randomUUID(),
      name,
      email,
      passwordHash: await hash(password),
    };
    this.users.set(user.id, user);
    return { user: this.publicUser(user), token: this.session(user.id) };
  }
  async login(email: string, password: string) {
    const user = [...this.users.values()].find((candidate) => candidate.email === email);
    if (!user || !(await verify(user.passwordHash, password)))
      throw new StoreError('INVALID_CREDENTIALS', 'Invalid e-mail or password.', 401);
    return { user: this.publicUser(user), token: this.session(user.id) };
  }
  logout(token: string) {
    this.sessions.delete(this.tokenHash(token));
  }
  userForToken(token?: string) {
    if (!token) return undefined;
    const session = this.sessions.get(this.tokenHash(token));
    if (!session || session.expiresAt < Date.now()) return undefined;
    const user = this.users.get(session.userId);
    return user ? this.publicUser(user) : undefined;
  }
  updateUser(userId: string, patch: Partial<Pick<User, 'name' | 'avatarUrl'>>) {
    const user = this.users.get(userId);
    if (!user) throw new StoreError('NOT_FOUND', 'User not found.', 404);
    Object.assign(user, patch);
    return this.publicUser(user);
  }
  recipes() {
    return [...this.catalog.recipes, ...this.ownRecipes.values()];
  }
  recipe(id: string) {
    return this.recipes().find((recipe) => recipe.id === id);
  }
  addRecipe(userId: string, input: CreateRecipeInput, imageUrl: string) {
    const ingredientMap = new Map(this.catalog.ingredients.map((item) => [item.id, item]));
    const recipe: Recipe = {
      id: randomUUID(),
      ownerId: userId,
      title: input.title,
      category: input.category,
      area: input.area,
      instructions: input.instructions,
      description: input.description,
      thumb: imageUrl,
      preview: imageUrl,
      time: input.time,
      youtube: '',
      tags: [],
      ingredients: input.ingredients.map((entry) => {
        const ingredient = ingredientMap.get(entry.ingredientId);
        if (!ingredient) throw new StoreError('INGREDIENT_NOT_FOUND', 'Ingredient not found.', 400);
        return {
          ingredientId: ingredient.id,
          title: ingredient.title,
          thumb: ingredient.thumb,
          measure: entry.measure,
        };
      }),
    };
    this.ownRecipes.set(recipe.id, recipe);
    return recipe;
  }
  deleteRecipe(userId: string, recipeId: string) {
    const recipe = this.ownRecipes.get(recipeId);
    if (!recipe || recipe.ownerId !== userId)
      throw new StoreError('NOT_FOUND', 'Recipe not found.', 404);
    this.ownRecipes.delete(recipeId);
  }
  favoriteIds(userId: string) {
    return this.favorites.get(userId) ?? new Set<string>();
  }
  addFavorite(userId: string, recipeId: string) {
    if (!this.recipe(recipeId)) throw new StoreError('NOT_FOUND', 'Recipe not found.', 404);
    const list = this.favoriteIds(userId);
    list.add(recipeId);
    this.favorites.set(userId, list);
    this.unlock(userId, 'first-favorite');
    if (list.size >= 10) this.unlock(userId, 'ten-favorites');
  }
  removeFavorite(userId: string, recipeId: string) {
    this.favoriteIds(userId).delete(recipeId);
  }
  shoppingItems(userId: string) {
    return [...(this.shopping.get(userId)?.values() ?? [])];
  }
  addShopping(userId: string, ingredientId: string, measure: string) {
    const ingredient = this.catalog.ingredients.find((item) => item.id === ingredientId);
    if (!ingredient) throw new StoreError('NOT_FOUND', 'Ingredient not found.', 404);
    const list = this.shopping.get(userId) ?? new Map();
    list.set(ingredientId, {
      ingredientId,
      title: ingredient.title,
      thumb: ingredient.thumb,
      measure,
    });
    this.shopping.set(userId, list);
    this.unlock(userId, 'first-shopping-list');
    return list.get(ingredientId)!;
  }
  removeShopping(userId: string, ingredientId: string) {
    this.shopping.get(userId)?.delete(ingredientId);
  }
  subscribe(email: string) {
    const created = !this.subscriptions.has(email);
    this.subscriptions.add(email);
    return created;
  }
  unseenAchievements(userId: string) {
    return [...(this.achievements.get(userId)?.entries() ?? [])]
      .filter(([, seen]) => !seen)
      .map(([code]) => code);
  }
  markSeen(userId: string, code: AchievementCode) {
    const values = this.achievements.get(userId);
    if (values?.has(code)) values.set(code, true);
  }
  private unlock(userId: string, code: AchievementCode) {
    const values = this.achievements.get(userId) ?? new Map();
    if (!values.has(code)) values.set(code, false);
    this.achievements.set(userId, values);
  }
  private session(userId: string) {
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(this.tokenHash(token), { userId, expiresAt: Date.now() + 30 * 86_400_000 });
    return token;
  }
  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
  private publicUser({ passwordHash: _, ...user }: InternalUser): User {
    return user;
  }
}

export class StoreError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
  }
}
