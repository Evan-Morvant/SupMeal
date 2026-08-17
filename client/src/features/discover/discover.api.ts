import { api } from '../../api/client';
import type { DiscoverFilters, Page, Recipe, RecipeSummary } from '../../api/types';

/*
 * Découverte : les recettes publiques, lisibles sans compte. Un jeton, s'il y
 * en a un, ne sert qu'à renseigner `isFavorite` — il n'élargit jamais le
 * périmètre.
 */

export async function listPublicRecipes(
  filters: DiscoverFilters,
): Promise<Page<RecipeSummary>> {
  const { data } = await api.get<Page<RecipeSummary>>('/discover/recipes', { params: filters });
  return data;
}

/** Répond 404 sur une recette non publique, jamais 403. */
export async function getPublicRecipe(id: string): Promise<Recipe> {
  const { data } = await api.get<Recipe>('/discover/recipes/' + id);
  return data;
}
