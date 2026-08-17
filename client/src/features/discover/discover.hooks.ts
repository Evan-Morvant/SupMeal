import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { keys } from '../../api/query-keys';
import type { DiscoverFilters, Page, Recipe, RecipeSummary } from '../../api/types';
import * as discoverApi from './discover.api';

export function useDiscoverRecipes(
  filters: DiscoverFilters,
): UseQueryResult<Page<RecipeSummary>> {
  return useQuery({
    queryKey: keys.discover(filters),
    queryFn: () => discoverApi.listPublicRecipes(filters),
    placeholderData: keepPreviousData,
  });
}

export function useDiscoverRecipe(id: string | undefined): UseQueryResult<Recipe> {
  return useQuery({
    queryKey: keys.discoverRecipe(id ?? ''),
    queryFn: () => discoverApi.getPublicRecipe(id as string),
    enabled: id !== undefined,
  });
}
