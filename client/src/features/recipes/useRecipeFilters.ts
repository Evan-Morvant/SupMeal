import { useMemo } from 'react';
import type { RecipeFilters } from '../../api/types';
import {
  PAGE_SIZE,
  readEnum,
  readList,
  readPage,
  readPositive,
  useUrlFilters,
  type UrlFilterControls,
} from '../../hooks/useUrlFilters';

const SORTS = ['relevance', 'recent', 'prepTime'] as const;

/** Valeurs modifiables par l'interface, `pageSize` mis à part. */
export type FilterPatch = Partial<Omit<RecipeFilters, 'pageSize'>>;

/** Après lecture de l'URL, les listes et la pagination sont toujours définies. */
export interface ParsedFilters extends RecipeFilters {
  tags: string[];
  ingredients: string[];
  page: number;
  pageSize: number;
}

export interface RecipeFiltersState extends UrlFilterControls<FilterPatch> {
  filters: ParsedFilters;
  /** Nombre de critères actifs hors recherche plein texte et tri. */
  activeCount: number;
}

export function useRecipeFilters(): RecipeFiltersState {
  const controls = useUrlFilters<FilterPatch>();
  const { params } = controls;

  const filters = useMemo<ParsedFilters>(
    () => ({
      q: params.get('q') ?? undefined,
      tags: readList(params, 'tags'),
      ingredients: readList(params, 'ingredients'),
      maxPrep: readPositive(params, 'maxPrep'),
      maxCook: readPositive(params, 'maxCook'),
      favorite: params.get('favorite') === 'true' ? true : undefined,
      cookbookId: params.get('cookbookId') ?? undefined,
      sort: readEnum(params, 'sort', SORTS),
      page: readPage(params),
      pageSize: PAGE_SIZE,
    }),
    [params],
  );

  const activeCount =
    filters.tags.length +
    filters.ingredients.length +
    (filters.maxPrep === undefined ? 0 : 1) +
    (filters.maxCook === undefined ? 0 : 1) +
    (filters.favorite === true ? 1 : 0);

  return { ...controls, filters, activeCount };
}
