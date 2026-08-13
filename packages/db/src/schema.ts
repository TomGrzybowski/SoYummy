import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_idx').on(table.userId),
  ],
);

export const categories = pgTable(
  'categories',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    thumb: text('thumb').notNull(),
    description: text('description').notNull(),
  },
  (table) => [uniqueIndex('categories_title_unique').on(table.title)],
);

export const ingredients = pgTable(
  'ingredients',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    thumb: text('thumb').notNull(),
  },
  (table) => [index('ingredients_title_idx').on(table.title)],
);

export const recipes = pgTable(
  'recipes',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    category: text('category').notNull(),
    area: text('area').notNull().default(''),
    instructions: text('instructions').notNull(),
    description: text('description').notNull().default(''),
    thumb: text('thumb').notNull(),
    preview: text('preview').notNull().default(''),
    time: integer('time').notNull(),
    youtube: text('youtube').notNull().default(''),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('recipes_category_idx').on(table.category),
    index('recipes_title_idx').on(table.title),
    index('recipes_owner_idx').on(table.ownerId),
  ],
);

export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    ingredientId: text('ingredient_id')
      .notNull()
      .references(() => ingredients.id),
    measure: text('measure').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [primaryKey({ columns: [table.recipeId, table.ingredientId] })],
);

export const favorites = pgTable(
  'favorites',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.recipeId] }),
    index('favorites_recipe_idx').on(table.recipeId),
  ],
);

export const shoppingListItems = pgTable(
  'shopping_list_items',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ingredientId: text('ingredient_id')
      .notNull()
      .references(() => ingredients.id),
    measure: text('measure').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.ingredientId] })],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('subscriptions_email_unique').on(table.email)],
);

export const userVisitDays = pgTable(
  'user_visit_days',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.day] })],
);

export const userAchievements = pgTable(
  'user_achievements',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).defaultNow().notNull(),
    seen: boolean('seen').notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.userId, table.code] })],
);
