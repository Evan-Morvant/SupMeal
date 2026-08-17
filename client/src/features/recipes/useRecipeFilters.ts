import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { RecipeFilters } from '../../api/types';

/*
 * Les critères de recherche vivent dans la chaîne de requête, pas dans un état
 * de composant : une recherche se partage par son adresse, le retour arrière
 * du navigateur défait un filtre, et recharger la page ne repart pas de zéro.
 */

export const PAGE_SIZE = 12;

const SORTS = ['relevance', 'recent', 'prepTime'] as const;
type Sort = (typeof SORTS)[number];

function readList(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') {
    return [];
  }
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function readPositive(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** Valeurs modifiables par l'interface, `page` et `pageSize` mis à part. */
export type FilterPatch = Partial<Omit<RecipeFilters, 'pageSize'>>;

/** Après lecture de l'URL, les listes et la pagination sont toujours définies. */
export interface ParsedFilters extends RecipeFilters {
  tags: string[];
  ingredients: string[];
  page: number;
  pageSize: number;
}

export interface RecipeFiltersState {
  filters: ParsedFilters;
  /** Applique des critères. Toucher un critère ramène à la première page. */
  patch: (values: FilterPatch, options?: { replace?: boolean }) => void;
  goToPage: (page: number) => void;
  clear: () => void;
  /** Nombre de critères actifs hors recherche plein texte et tri. */
  activeCount: number;
}

export function useRecipeFilters(): RecipeFiltersState {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<ParsedFilters>(() => {
    const sort = params.get('sort');
    return {
      q: params.get('q') ?? undefined,
      tags: readList(params, 'tags'),
      ingredients: readList(params, 'ingredients'),
      maxPrep: readPositive(params, 'maxPrep'),
      maxCook: readPositive(params, 'maxCook'),
      favorite: params.get('favorite') === 'true' ? true : undefined,
      cookbookId: params.get('cookbookId') ?? undefined,
      sort: SORTS.includes(sort as Sort) ? (sort as Sort) : undefined,
      page: Math.max(1, Number(params.get('page') ?? 1) || 1),
      pageSize: PAGE_SIZE,
    };
  }, [params]);

  const write = useCallback(
    (values: FilterPatch, keepPage: boolean, replace: boolean) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          Object.entries(values).forEach(([key, value]) => {
            const empty =
              value === undefined ||
              value === null ||
              value === false ||
              value === '' ||
              (Array.isArray(value) && value.length === 0);
            if (empty) {
              next.delete(key);
              return;
            }
            next.set(key, Array.isArray(value) ? value.join(',') : String(value));
          });
          if (!keepPage) {
            // Rester en page 4 après avoir resserré les critères afficherait
            // un vide alors qu'il y a des résultats.
            next.delete('page');
          }
          return next;
        },
        { replace },
      );
    },
    [setParams],
  );

  const patch = useCallback<RecipeFiltersState['patch']>(
    (values, options) => write(values, false, options?.replace === true),
    [write],
  );

  const goToPage = useCallback(
    (page: number) => write({ page: page <= 1 ? undefined : page }, true, false),
    [write],
  );

  const clear = useCallback(() => setParams(new URLSearchParams()), [setParams]);

  const activeCount =
    filters.tags.length +
    filters.ingredients.length +
    (filters.maxPrep === undefined ? 0 : 1) +
    (filters.maxCook === undefined ? 0 : 1) +
    (filters.favorite === true ? 1 : 0);

  return { filters, patch, goToPage, clear, activeCount };
}
