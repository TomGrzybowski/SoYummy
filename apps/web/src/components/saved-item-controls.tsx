'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@so-yummy/api-client';
import type { RecipeIngredient } from '@so-yummy/contracts';
import {
  errorMessage,
  getFavorites,
  getShoppingList,
  savedItemKeys,
  type FavoriteRecipe,
  type ShoppingItem,
} from '@/lib/saved-items';

export function FavoriteButton({ recipe }: { recipe: FavoriteRecipe }) {
  const queryClient = useQueryClient();
  const favorites = useQuery({ queryKey: savedItemKeys.favorites, queryFn: getFavorites });
  const isFavorite = favorites.data?.some((item) => item.id === recipe.id) ?? false;
  const mutation = useMutation({
    mutationFn: () =>
      isFavorite
        ? apiClient.delete(`/favorites/${recipe.id}`)
        : apiClient.post<void>(`/favorites/${recipe.id}`),
    onSuccess: () => {
      queryClient.setQueryData<FavoriteRecipe[]>(savedItemKeys.favorites, (current = []) =>
        isFavorite ? current.filter((item) => item.id !== recipe.id) : [...current, recipe],
      );
    },
  });

  return (
    <div className="favoriteControl">
      <button
        type="button"
        aria-pressed={isFavorite}
        disabled={favorites.isPending || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {favorites.isPending
          ? 'Loading favorites…'
          : mutation.isPending
            ? 'Saving…'
            : isFavorite
              ? 'Remove from favorite recipes'
              : 'Add to favorite recipes'}
      </button>
      {mutation.error && (
        <span role="alert" className="inlineError">
          {errorMessage(mutation.error)}
        </span>
      )}
    </div>
  );
}

export function ShoppingListButton({ ingredient }: { ingredient: RecipeIngredient }) {
  const queryClient = useQueryClient();
  const shoppingList = useQuery({
    queryKey: savedItemKeys.shoppingList,
    queryFn: getShoppingList,
  });
  const isAdded =
    shoppingList.data?.some((item) => item.ingredientId === ingredient.ingredientId) ?? false;
  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ item: ShoppingItem }>('/shopping-list', {
        ingredientId: ingredient.ingredientId,
        measure: ingredient.measure,
      }),
    onSuccess: ({ item }) => {
      queryClient.setQueryData<ShoppingItem[]>(savedItemKeys.shoppingList, (current = []) => [
        ...current.filter((entry) => entry.ingredientId !== item.ingredientId),
        item,
      ]);
    },
  });

  const label = mutation.isPending
    ? `Adding ${ingredient.title} to shopping list`
    : shoppingList.isPending
      ? `Loading shopping list for ${ingredient.title}`
      : isAdded
        ? `${ingredient.title} is in shopping list`
        : `Add ${ingredient.title} to shopping list`;

  return (
    <span className="ingredientAction">
      <button
        type="button"
        aria-label={label}
        disabled={shoppingList.isPending || isAdded || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? '…' : isAdded ? '✓' : '＋'}
      </button>
      {mutation.error && (
        <span role="alert" className="inlineError">
          {errorMessage(mutation.error)}
        </span>
      )}
    </span>
  );
}
