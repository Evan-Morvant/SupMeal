import { api } from '../../api/client';
import type { Page, Recipe, RecipeFilters, RecipeInput, RecipeSummary } from '../../api/types';

/** Périmètre : ses propres recettes et celles de ses cookbooks. */
export async function listRecipes(filters: RecipeFilters): Promise<Page<RecipeSummary>> {
  const { data } = await api.get<Page<RecipeSummary>>('/recipes', { params: filters });
  return data;
}

export async function getRecipe(id: string): Promise<Recipe> {
  const { data } = await api.get<Recipe>('/recipes/' + id);
  return data;
}

export async function createRecipe(input: RecipeInput): Promise<Recipe> {
  const { data } = await api.post<Recipe>('/recipes', input);
  return data;
}

/**
 * Modification partielle. Toute collection **présente** remplace l'ancienne,
 * toute collection absente est conservée : le formulaire les envoie donc
 * toutes, sans quoi vider les étapes d'une recette serait impossible.
 */
export async function updateRecipe(id: string, input: Partial<RecipeInput>): Promise<Recipe> {
  const { data } = await api.patch<Recipe>('/recipes/' + id, input);
  return data;
}

export async function deleteRecipe(id: string): Promise<void> {
  await api.delete('/recipes/' + id);
}

/** Types et taille acceptés par le serveur (`middlewares/upload.ts`). */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** L'envoi rend la recette complète, image comprise : rien à recharger. */
export async function uploadRecipeImage(id: string, file: File): Promise<Recipe> {
  const body = new FormData();
  body.append('file', file);
  const { data } = await api.post<Recipe>('/recipes/' + id + '/image', body);
  return data;
}

/** Les deux routes de favori répondent 204 : c'est le cache qui suit. */
export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  if (favorite) {
    await api.post('/recipes/' + id + '/favorite');
    return;
  }
  await api.delete('/recipes/' + id + '/favorite');
}
