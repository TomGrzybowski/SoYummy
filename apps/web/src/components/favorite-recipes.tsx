'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@so-yummy/api-client';
import { EmptyState } from './empty-state';
import { RecipeCard } from './recipe-card';
import { errorMessage, getFavorites, savedItemKeys, type FavoriteRecipe } from '@/lib/saved-items';

export function FavoriteRecipes() {
  const queryClient = useQueryClient();
  const favorites = useQuery({ queryKey: savedItemKeys.favorites, queryFn: getFavorites });
  const remove = useMutation({
    mutationFn: (recipeId: string) => apiClient.delete(`/favorites/${recipeId}`),
    onSuccess: (_, recipeId) => {
      queryClient.setQueryData<FavoriteRecipe[]>(savedItemKeys.favorites, (current = []) =>
        current.filter((recipe) => recipe.id !== recipeId),
      );
    },
  });

  if (favorites.isPending)
    return (
      <p className="listStatus" role="status">
        Loading favorite recipes…
      </p>
    );
  if (favorites.error)
    return (
      <div className="listStatus" role="alert">
        <p>{errorMessage(favorites.error)}</p>
        <button type="button" onClick={() => favorites.refetch()}>
          Try again
        </button>
      </div>
    );
  if (!favorites.data.length)
    return (
      <EmptyState
        title="No favorite recipes yet"
        text="Save recipes you love and they will appear here."
      />
    );

  return (
    <>
      {remove.error && (
        <p role="alert" className="listError">
          {errorMessage(remove.error)}
        </p>
      )}
      <div className="savedRecipeGrid">
        {favorites.data.map((recipe) => (
          <div className="savedRecipe" key={recipe.id}>
            <RecipeCard recipe={recipe} />
            <button
              type="button"
              aria-label={`Remove ${recipe.title} from favorites`}
              disabled={remove.isPending && remove.variables === recipe.id}
              onClick={() => remove.mutate(recipe.id)}
            >
              {remove.isPending && remove.variables === recipe.id ? 'Removing…' : 'Remove'}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
