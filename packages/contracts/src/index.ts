import { z } from 'zod';

export const objectIdSchema = z.string().min(1);
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: passwordSchema,
});
export const loginSchema = z.object({ email: emailSchema, password: passwordSchema });
export const updateProfileSchema = z.object({ name: z.string().trim().min(2).max(80) });
export const subscriptionSchema = z.object({ email: emailSchema });

export const ingredientAmountSchema = z.object({
  ingredientId: objectIdSchema,
  measure: z.string().trim().min(1).max(80),
});
export const createRecipeSchema = z.object({
  title: z.string().trim().min(3).max(160),
  category: z.string().trim().min(1).max(80),
  area: z.string().trim().max(80).default(''),
  instructions: z.string().trim().min(20).max(20_000),
  description: z.string().trim().max(500).default(''),
  time: z.coerce.number().int().min(1).max(1_440),
  ingredients: z.array(ingredientAmountSchema).min(1).max(100),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});
export const searchQuerySchema = paginationQuerySchema.extend({
  query: z.string().trim().max(120).optional(),
  ingredient: objectIdSchema.optional(),
});

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  requestId: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export interface Category {
  id: string;
  title: string;
  thumb: string;
  description: string;
}
export interface Ingredient {
  id: string;
  title: string;
  description: string;
  thumb: string;
}
export interface RecipeIngredient {
  ingredientId: string;
  title: string;
  thumb: string;
  measure: string;
}
export interface Recipe {
  id: string;
  title: string;
  category: string;
  area: string;
  instructions: string;
  description: string;
  thumb: string;
  preview: string;
  time: number;
  youtube: string;
  tags: string[];
  ingredients: RecipeIngredient[];
  ownerId?: string;
}
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}
export type AchievementCode =
  'first-shopping-list' | 'hundred-active-days' | 'first-favorite' | 'ten-favorites';
