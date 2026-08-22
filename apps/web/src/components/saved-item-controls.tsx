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

async function addShoppingItem(ingredient: RecipeIngredient) {
  const response = await apiClient.post<{ item: ShoppingItem }>('/shopping-list', {
    ingredientId: ingredient.ingredientId,
    measure: ingredient.measure,
  });
  return response.item;
}

function mergeShoppingItems(current: ShoppingItem[] = [], added: ShoppingItem[]) {
  const byIngredient = new Map(current.map((item) => [item.ingredientId, item]));
  for (const item of added) byIngredient.set(item.ingredientId, item);
  return [...byIngredient.values()];
}

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
  const error = mutation.error ?? favorites.error;

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
      {error && (
        <span role="alert" className="inlineError">
          {errorMessage(error, 'Could not update favorite recipes. Please try again.')}
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
    mutationFn: () => addShoppingItem(ingredient),
    onSuccess: (item) => {
      queryClient.setQueryData<ShoppingItem[]>(savedItemKeys.shoppingList, (current) =>
        mergeShoppingItems(current, [item]),
      );
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
      {(mutation.error ?? shoppingList.error) && (
        <span role="alert" className="inlineError">
          {errorMessage(
            mutation.error ?? shoppingList.error,
            `Could not add ${ingredient.title}. Please try again.`,
          )}
        </span>
      )}
    </span>
  );
}

export function AddAllToShoppingListButton({ ingredients }: { ingredients: RecipeIngredient[] }) {
  const queryClient = useQueryClient();
  const shoppingList = useQuery({
    queryKey: savedItemKeys.shoppingList,
    queryFn: getShoppingList,
  });
  const addedIds = new Set(shoppingList.data?.map((item) => item.ingredientId));
  const remaining = ingredients.filter((item) => !addedIds.has(item.ingredientId));
  const mutation = useMutation({
    mutationFn: () => Promise.all(remaining.map(addShoppingItem)),
    onSuccess: (items) => {
      queryClient.setQueryData<ShoppingItem[]>(savedItemKeys.shoppingList, (current) =>
        mergeShoppingItems(current, items),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: savedItemKeys.shoppingList, exact: true }),
  });
  const allAdded = shoppingList.isSuccess && remaining.length === 0;
  const label = mutation.isPending
    ? 'Adding all ingredients to shopping list'
    : allAdded
      ? 'All ingredients are in shopping list'
      : 'Add all ingredients to shopping list';
  const error = mutation.error ?? shoppingList.error;

  return (
    <span className="addAllControl">
      <button
        type="button"
        aria-label={label}
        disabled={shoppingList.isPending || shoppingList.isError || mutation.isPending || allAdded}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Adding…' : allAdded ? 'All added' : 'Add all'}
      </button>
      {error && (
        <span role="alert" className="inlineError">
          {errorMessage(error, 'Could not add all ingredients. Please try again.')}
        </span>
      )}
    </span>
  );
}
