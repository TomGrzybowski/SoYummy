'use client';

import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@so-yummy/api-client';
import { EmptyState } from './empty-state';
import { errorMessage, getShoppingList, savedItemKeys, type ShoppingItem } from '@/lib/saved-items';

export function ShoppingList() {
  const queryClient = useQueryClient();
  const shoppingList = useQuery({
    queryKey: savedItemKeys.shoppingList,
    queryFn: getShoppingList,
  });
  const remove = useMutation({
    mutationFn: (ingredientId: string) => apiClient.delete(`/shopping-list/${ingredientId}`),
    onSuccess: (_, ingredientId) => {
      queryClient.setQueryData<ShoppingItem[]>(savedItemKeys.shoppingList, (current = []) =>
        current.filter((item) => item.ingredientId !== ingredientId),
      );
    },
  });

  if (shoppingList.isPending)
    return (
      <p className="listStatus" role="status">
        Loading shopping list…
      </p>
    );
  if (shoppingList.error)
    return (
      <div className="listStatus" role="alert">
        <p>{errorMessage(shoppingList.error)}</p>
        <button type="button" onClick={() => shoppingList.refetch()}>
          Try again
        </button>
      </div>
    );
  if (!shoppingList.data.length)
    return (
      <EmptyState
        title="Your shopping list is empty"
        text="Open a recipe and add the ingredients you need."
      />
    );

  return (
    <>
      {remove.error && (
        <p role="alert" className="listError">
          {errorMessage(remove.error)}
        </p>
      )}
      <ul className="shoppingItems">
        {shoppingList.data.map((item) => (
          <li key={item.ingredientId}>
            <span className="shoppingProduct">
              <Image src={item.thumb} alt="" width={64} height={64} />
              <strong>{item.title}</strong>
            </span>
            <span>{item.measure}</span>
            <button
              type="button"
              aria-label={`Remove ${item.title} from shopping list`}
              disabled={remove.isPending && remove.variables === item.ingredientId}
              onClick={() => remove.mutate(item.ingredientId)}
            >
              {remove.isPending && remove.variables === item.ingredientId ? '…' : '×'}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
