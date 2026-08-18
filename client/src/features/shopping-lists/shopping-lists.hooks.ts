import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { keys } from '../../api/query-keys';
import type { ShoppingList } from '../../api/types';
import * as listsApi from './shopping-lists.api';

export function useShoppingLists(): UseQueryResult<ShoppingList[]> {
  return useQuery({ queryKey: keys.shoppingLists, queryFn: listsApi.listShoppingLists });
}

export function useShoppingList(id: string | undefined): UseQueryResult<ShoppingList> {
  return useQuery({
    queryKey: keys.shoppingList(id ?? ''),
    queryFn: () => listsApi.getShoppingList(id as string),
    enabled: id !== undefined,
  });
}

export function useGenerateShoppingList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: listsApi.generateShoppingList,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.shoppingLists }),
  });
}

export function useDeleteShoppingList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: listsApi.deleteShoppingList,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.shoppingLists }),
  });
}

/**
 * Cocher une ligne, en optimiste : la case doit répondre sous le doigt, on est
 * dans un magasin. Le serveur confirme derrière.
 */
export function useToggleItem(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, checked }: { itemId: string; checked: boolean }) =>
      listsApi.updateShoppingListItem(listId, itemId, { checked }),
    async onMutate({ itemId, checked }) {
      const key = keys.shoppingList(listId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ShoppingList>(key);
      queryClient.setQueryData<ShoppingList>(key, (current) =>
        current === undefined
          ? current
          : {
              ...current,
              items: current.items.map((item) =>
                item.id === itemId ? { ...item, checked } : item,
              ),
            },
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(keys.shoppingList(listId), context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.shoppingList(listId) }),
  });
}
