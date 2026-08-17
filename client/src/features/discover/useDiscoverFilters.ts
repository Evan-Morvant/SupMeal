import { useMemo } from 'react';
import type { DiscoverFilters } from '../../api/types';
import {
  PAGE_SIZE,
  readEnum,
  readList,
  readPage,
  readPositive,
  useUrlFilters,
  type UrlFilterControls,
} from '../../hooks/useUrlFilters';

/*
 * Ni `ingredients`, ni `favorite`, ni `cookbookId` : ils désignent le périmètre
 * d'un compte, qu'un visiteur n'a pas. Le tri par note remplace le tri par
 * temps de préparation.
 */
const SORTS = ['relevance', 'rating', 'recent'] as const;

export type DiscoverPatch = Partial<Omit<DiscoverFilters, 'pageSize'>>;

export interface ParsedDiscoverFilters extends DiscoverFilters {
  tags: string[];
  page: number;
  pageSize: number;
}

export interface DiscoverFiltersState extends UrlFilterControls<DiscoverPatch> {
  filters: ParsedDiscoverFilters;
  activeCount: number;
}

export function useDiscoverFilters(): DiscoverFiltersState {
  const controls = useUrlFilters<DiscoverPatch>();
  const { params } = controls;

  const filters = useMemo<ParsedDiscoverFilters>(
    () => ({
      q: params.get('q') ?? undefined,
      tags: readList(params, 'tags'),
      maxPrep: readPositive(params, 'maxPrep'),
      maxCook: readPositive(params, 'maxCook'),
      sort: readEnum(params, 'sort', SORTS),
      page: readPage(params),
      pageSize: PAGE_SIZE,
    }),
    [params],
  );

  const activeCount =
    filters.tags.length +
    (filters.maxPrep === undefined ? 0 : 1) +
    (filters.maxCook === undefined ? 0 : 1);

  return { ...controls, filters, activeCount };
}
