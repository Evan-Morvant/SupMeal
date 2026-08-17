import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { keys } from '../../api/query-keys';
import type { Ingredient, Tag, TagType } from '../../api/types';
import { useDebounce } from '../../hooks/useDebounce';
import * as catalogApi from './catalog.api';

/** Une seule lettre ramènerait une part énorme du catalogue : on attend deux. */
export function useIngredientSearch(query: string): UseQueryResult<Ingredient[]> {
  const settled = useDebounce(query.trim(), 250);
  return useQuery({
    queryKey: keys.ingredients(settled),
    queryFn: () => catalogApi.searchIngredients(settled),
    enabled: settled.length >= 2,
    // Le catalogue bouge peu.
    staleTime: 5 * 60 * 1000,
  });
}

export function useTags(options: { type?: TagType; mine?: boolean } = {}): UseQueryResult<Tag[]> {
  return useQuery({
    queryKey: keys.tags(options.type, options.mine),
    queryFn: () => catalogApi.listTags(options),
    staleTime: 5 * 60 * 1000,
  });
}
