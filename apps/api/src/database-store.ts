import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { createDatabase, schema } from '@so-yummy/db';
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { AchievementCode, CreateRecipeInput, Recipe, User } from '@so-yummy/contracts';
import type {
  AuthChallenge,
  AuthRepository,
  AuthUser,
  PendingRegistration,
  SessionRecord,
} from './auth-service.js';
import type { AuthEmailPurpose } from './mailer.js';
import { loadCatalog } from './catalog.js';
import { StoreError, type ShoppingItem } from './store.js';

const sourceCatalog = await loadCatalog();
type Database = ReturnType<typeof createDatabase>;

export class DatabaseStore implements AuthRepository {
  readonly catalog = sourceCatalog;
  constructor(private readonly db: Database = createDatabase()) {}

  async login(email: string, password: string) {
    const user = await this.authUserByEmail(email);
    if (!user || !(await verify(user.passwordHash, password)))
      throw new StoreError('INVALID_CREDENTIALS', 'Invalid e-mail or password.', 401);
    const token = randomBytes(32).toString('base64url');
    await this.db.insert(schema.sessions).values({
      id: randomUUID(),
      userId: user.id,
      tokenHash: this.tokenHash(token),
      expiresAt: new Date(Date.now() + 30 * 86_400_000),
    });
    return { user: this.publicUser(user), token };
  }

  async logout(token: string) {
    await this.db
      .delete(schema.sessions)
      .where(eq(schema.sessions.tokenHash, this.tokenHash(token)));
  }

  async userForToken(token?: string) {
    if (!token) return undefined;
    const [row] = await this.db
      .select({
        user: schema.users,
        sessionId: schema.sessions.id,
        expiresAt: schema.sessions.expiresAt,
      })
      .from(schema.sessions)
      .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
      .where(eq(schema.sessions.tokenHash, this.tokenHash(token)))
      .limit(1);
    if (!row) return undefined;
    if (row.expiresAt <= new Date()) {
      await this.db.delete(schema.sessions).where(eq(schema.sessions.id, row.sessionId));
      return undefined;
    }
    return this.publicUser(row.user);
  }

  async updateUser(userId: string, patch: Partial<Pick<User, 'name' | 'avatarUrl'>>) {
    const [user] = await this.db
      .update(schema.users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning();
    if (!user) throw new StoreError('NOT_FOUND', 'User not found.', 404);
    return this.publicUser(user);
  }

  async authUserByEmail(email: string): Promise<AuthUser | undefined> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    return user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
          passwordHash: user.passwordHash,
        }
      : undefined;
  }
  async authUserById(id: string): Promise<AuthUser | undefined> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    return user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
          passwordHash: user.passwordHash,
        }
      : undefined;
  }
  async savePendingRegistration(value: PendingRegistration) {
    const now = new Date();
    await this.db
      .insert(schema.pendingRegistrations)
      .values({ ...value, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: schema.pendingRegistrations.email,
        set: {
          name: value.name,
          passwordHash: value.passwordHash,
          expiresAt: value.expiresAt,
          updatedAt: now,
        },
      });
  }
  async pendingRegistration(email: string): Promise<PendingRegistration | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.pendingRegistrations)
      .where(eq(schema.pendingRegistrations.email, email))
      .limit(1);
    return row
      ? {
          email: row.email,
          name: row.name,
          passwordHash: row.passwordHash,
          expiresAt: row.expiresAt,
        }
      : undefined;
  }
  async challengeCounts(email: string, purpose: AuthEmailPurpose, ipHash: string, since: Date) {
    const [target] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.authChallenges)
      .where(
        and(
          eq(schema.authChallenges.email, email),
          eq(schema.authChallenges.purpose, purpose),
          gt(schema.authChallenges.sentAt, since),
        ),
      );
    const [ip] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.authChallenges)
      .where(
        and(
          eq(schema.authChallenges.requestIpHash, ipHash),
          gt(schema.authChallenges.sentAt, since),
        ),
      );
    return { target: target?.count ?? 0, ip: ip?.count ?? 0 };
  }
  async latestChallenge(
    email: string,
    purpose: AuthEmailPurpose,
  ): Promise<AuthChallenge | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.authChallenges)
      .where(
        and(eq(schema.authChallenges.email, email), eq(schema.authChallenges.purpose, purpose)),
      )
      .orderBy(desc(schema.authChallenges.sentAt))
      .limit(1);
    return row ? this.challenge(row) : undefined;
  }
  async invalidateChallenges(email: string, purpose: AuthEmailPurpose, at: Date) {
    await this.db
      .update(schema.authChallenges)
      .set({ consumedAt: at })
      .where(
        and(
          eq(schema.authChallenges.email, email),
          eq(schema.authChallenges.purpose, purpose),
          isNull(schema.authChallenges.consumedAt),
        ),
      );
  }
  async createChallenge(value: AuthChallenge) {
    await this.db
      .insert(schema.authChallenges)
      .values({ ...value, userId: value.userId ?? null, consumedAt: null });
  }
  async deleteChallenge(id: string) {
    await this.db.delete(schema.authChallenges).where(eq(schema.authChallenges.id, id));
  }
  async failChallenge(id: string) {
    await this.db
      .update(schema.authChallenges)
      .set({ attempts: sql`${schema.authChallenges.attempts} + 1` })
      .where(eq(schema.authChallenges.id, id));
  }
  async consumeChallenge(id: string, at: Date) {
    const rows = await this.db
      .update(schema.authChallenges)
      .set({ consumedAt: at })
      .where(and(eq(schema.authChallenges.id, id), isNull(schema.authChallenges.consumedAt)))
      .returning({ id: schema.authChallenges.id });
    return rows.length === 1;
  }
  async activateRegistration(email: string, session: SessionRecord) {
    const pending = await this.pendingRegistration(email);
    if (!pending || pending.expiresAt <= new Date())
      throw new StoreError('REGISTRATION_NOT_FOUND', 'Start registration again.', 404);
    const user = {
      id: randomUUID(),
      name: pending.name,
      email,
      passwordHash: pending.passwordHash,
    };
    await this.db.transaction(async (tx) => {
      await tx.insert(schema.users).values(user);
      await tx.insert(schema.sessions).values({
        id: session.id,
        userId: user.id,
        tokenHash: session.tokenHash,
        expiresAt: session.expiresAt,
      });
      await tx
        .delete(schema.pendingRegistrations)
        .where(eq(schema.pendingRegistrations.email, email));
    });
    return this.publicUser(user);
  }
  async replacePassword(userId: string, passwordHash: string, session?: SessionRecord) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));
      await tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
      if (session)
        await tx.insert(schema.sessions).values({
          id: session.id,
          userId,
          tokenHash: session.tokenHash,
          expiresAt: session.expiresAt,
        });
    });
  }

  async recipes(): Promise<Recipe[]> {
    const rows = await this.db.select().from(schema.recipes);
    if (!rows.length) return [];
    const links = await this.db
      .select({ link: schema.recipeIngredients, ingredient: schema.ingredients })
      .from(schema.recipeIngredients)
      .innerJoin(
        schema.ingredients,
        eq(schema.recipeIngredients.ingredientId, schema.ingredients.id),
      )
      .where(
        inArray(
          schema.recipeIngredients.recipeId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(schema.recipeIngredients.position);
    return rows.map((row) => ({
      id: row.id,
      ...(row.ownerId ? { ownerId: row.ownerId } : {}),
      title: row.title,
      category: row.category,
      area: row.area,
      instructions: row.instructions,
      description: row.description,
      thumb: row.thumb,
      preview: row.preview,
      time: row.time,
      youtube: row.youtube,
      tags: row.tags,
      ingredients: links
        .filter(({ link }) => link.recipeId === row.id)
        .map(({ link, ingredient }) => ({
          ingredientId: ingredient.id,
          title: ingredient.title,
          thumb: ingredient.thumb,
          measure: link.measure,
        })),
    }));
  }
  async recipe(id: string) {
    return (await this.recipes()).find((item) => item.id === id);
  }
  async addRecipe(userId: string, input: CreateRecipeInput, imageUrl: string) {
    const ids = input.ingredients.map((item) => item.ingredientId);
    const found = await this.db
      .select()
      .from(schema.ingredients)
      .where(inArray(schema.ingredients.id, ids));
    if (found.length !== new Set(ids).size)
      throw new StoreError('INGREDIENT_NOT_FOUND', 'Ingredient not found.', 400);
    const id = randomUUID();
    await this.db.transaction(async (tx) => {
      await tx.insert(schema.recipes).values({
        id,
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
      });
      await tx.insert(schema.recipeIngredients).values(
        input.ingredients.map((item, position) => ({
          recipeId: id,
          ingredientId: item.ingredientId,
          measure: item.measure,
          position,
        })),
      );
    });
    return (await this.recipe(id))!;
  }
  async deleteRecipe(userId: string, recipeId: string) {
    const deleted = await this.db
      .delete(schema.recipes)
      .where(and(eq(schema.recipes.id, recipeId), eq(schema.recipes.ownerId, userId)))
      .returning({ id: schema.recipes.id });
    if (!deleted.length) throw new StoreError('NOT_FOUND', 'Recipe not found.', 404);
  }
  async favoriteIds(userId: string) {
    return new Set(
      (
        await this.db
          .select({ id: schema.favorites.recipeId })
          .from(schema.favorites)
          .where(eq(schema.favorites.userId, userId))
      ).map(({ id }) => id),
    );
  }
  async addFavorite(userId: string, recipeId: string) {
    if (!(await this.recipe(recipeId))) throw new StoreError('NOT_FOUND', 'Recipe not found.', 404);
    await this.db.insert(schema.favorites).values({ userId, recipeId }).onConflictDoNothing();
    await this.unlock(userId, 'first-favorite');
    const [count] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(schema.favorites)
      .where(eq(schema.favorites.userId, userId));
    if ((count?.value ?? 0) >= 10) await this.unlock(userId, 'ten-favorites');
  }
  async removeFavorite(userId: string, recipeId: string) {
    await this.db
      .delete(schema.favorites)
      .where(and(eq(schema.favorites.userId, userId), eq(schema.favorites.recipeId, recipeId)));
  }
  async shoppingItems(userId: string): Promise<ShoppingItem[]> {
    const rows = await this.db
      .select({ item: schema.shoppingListItems, ingredient: schema.ingredients })
      .from(schema.shoppingListItems)
      .innerJoin(
        schema.ingredients,
        eq(schema.shoppingListItems.ingredientId, schema.ingredients.id),
      )
      .where(eq(schema.shoppingListItems.userId, userId));
    return rows.map(({ item, ingredient }) => ({
      ingredientId: ingredient.id,
      title: ingredient.title,
      thumb: ingredient.thumb,
      measure: item.measure,
    }));
  }
  async addShopping(userId: string, ingredientId: string, measure: string) {
    const [ingredient] = await this.db
      .select()
      .from(schema.ingredients)
      .where(eq(schema.ingredients.id, ingredientId))
      .limit(1);
    if (!ingredient) throw new StoreError('NOT_FOUND', 'Ingredient not found.', 404);
    await this.db
      .insert(schema.shoppingListItems)
      .values({ userId, ingredientId, measure })
      .onConflictDoUpdate({
        target: [schema.shoppingListItems.userId, schema.shoppingListItems.ingredientId],
        set: { measure },
      });
    await this.unlock(userId, 'first-shopping-list');
    return { ingredientId, title: ingredient.title, thumb: ingredient.thumb, measure };
  }
  async removeShopping(userId: string, ingredientId: string) {
    await this.db
      .delete(schema.shoppingListItems)
      .where(
        and(
          eq(schema.shoppingListItems.userId, userId),
          eq(schema.shoppingListItems.ingredientId, ingredientId),
        ),
      );
  }
  async subscribe(email: string) {
    const rows = await this.db
      .insert(schema.subscriptions)
      .values({ id: randomUUID(), email })
      .onConflictDoNothing()
      .returning({ id: schema.subscriptions.id });
    return rows.length === 1;
  }
  async unseenAchievements(userId: string): Promise<AchievementCode[]> {
    const rows = await this.db
      .select({ code: schema.userAchievements.code })
      .from(schema.userAchievements)
      .where(
        and(eq(schema.userAchievements.userId, userId), eq(schema.userAchievements.seen, false)),
      );
    return rows.map(({ code }) => code as AchievementCode);
  }
  async markSeen(userId: string, code: AchievementCode) {
    await this.db
      .update(schema.userAchievements)
      .set({ seen: true })
      .where(
        and(eq(schema.userAchievements.userId, userId), eq(schema.userAchievements.code, code)),
      );
  }
  private async unlock(userId: string, code: AchievementCode) {
    await this.db.insert(schema.userAchievements).values({ userId, code }).onConflictDoNothing();
  }
  private tokenHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
  private publicUser(user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  }): User {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    };
  }
  private challenge(row: typeof schema.authChallenges.$inferSelect): AuthChallenge {
    return {
      id: row.id,
      purpose: row.purpose as AuthEmailPurpose,
      email: row.email,
      ...(row.userId ? { userId: row.userId } : {}),
      codeHash: row.codeHash,
      requestIpHash: row.requestIpHash,
      attempts: row.attempts,
      expiresAt: row.expiresAt,
      ...(row.consumedAt ? { consumedAt: row.consumedAt } : {}),
      sentAt: row.sentAt,
    };
  }
}
