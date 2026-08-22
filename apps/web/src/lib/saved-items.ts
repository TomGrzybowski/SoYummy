import type { Recipe } from '@so-yummy/contracts';
import { apiClient } from '@so-yummy/api-client';

export type FavoriteRecipe = Pick<Recipe, 'id' | 'title' | 'thumb' | 'preview'>;

export interface ShoppingItem {
  ingredientId: string;
  title: string;
  thumb: string;
  measure: string;
}

export const savedItemKeys = {
  favorites: ['favorites'] as const,
  shoppingList: ['shopping-list'] as const,
};

export async function getFavorites() {
  const response = await apiClient.get<{ items: FavoriteRecipe[] }>('/favorites');
  return response.items;
}

export async function getShoppingList() {
  const response = await apiClient.get<{ items: ShoppingItem[] }>('/shopping-list');
  return response.items;
}

export function errorMessage(value: unknown) {
  return value instanceof Error ? value.message : 'Please try again.';
}
