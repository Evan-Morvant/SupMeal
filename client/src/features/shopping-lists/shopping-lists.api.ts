import { api } from '../../api/client';
import type { ShoppingList, ShoppingListItem } from '../../api/types';

export interface GenerateListInput {
  name?: string;
  fromDate: string;
  toDate: string;
  cookbookId?: string | null;
}

export async function listShoppingLists(): Promise<ShoppingList[]> {
  const { data } = await api.get<ShoppingList[]>('/shopping-lists');
  return data;
}

export async function getShoppingList(id: string): Promise<ShoppingList> {
  const { data } = await api.get<ShoppingList>('/shopping-lists/' + id);
  return data;
}

/**
 * Génère la liste depuis une fenêtre du planning. Une période sans aucun repas
 * répond 422 : mieux vaut le dire que créer une liste vide, qu'on croirait
 * complète une fois au marché.
 */
export async function generateShoppingList(input: GenerateListInput): Promise<ShoppingList> {
  const { data } = await api.post<ShoppingList>('/shopping-lists', input);
  return data;
}

export async function updateShoppingListItem(
  listId: string,
  itemId: string,
  patch: { checked?: boolean; quantity?: number | null; unit?: string | null },
): Promise<ShoppingListItem> {
  const { data } = await api.patch<ShoppingListItem>(
    '/shopping-lists/' + listId + '/items/' + itemId,
    patch,
  );
  return data;
}

export async function deleteShoppingList(id: string): Promise<void> {
  await api.delete('/shopping-lists/' + id);
}
