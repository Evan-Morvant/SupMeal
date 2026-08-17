import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { keys } from '../../api/query-keys';
import type { Page, Recipe, RecipeFilters, RecipeInput, RecipeSummary } from '../../api/types';
import * as recipesApi from './recipes.api';

export function useRecipes(filters: RecipeFilters): UseQueryResult<Page<RecipeSummary>> {
  return useQuery({
    queryKey: keys.recipes(filters),
    queryFn: () => recipesApi.listRecipes(filters),
    // Garde la page précédente pendant le chargement de la suivante : sans
    // cela, chaque changement de filtre vide la grille puis la remplit.
    placeholderData: keepPreviousData,
  });
}

export function useRecipe(id: string | undefined): UseQueryResult<Recipe> {
  return useQuery({
    queryKey: keys.recipe(id ?? ''),
    queryFn: () => recipesApi.getRecipe(id as string),
    enabled: id !== undefined,
  });
}

export function useCreateRecipe(): UseMutationResult<Recipe, unknown, RecipeInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recipesApi.createRecipe,
    onSuccess: (recipe) => {
      queryClient.setQueryData(keys.recipe(recipe.id), recipe);
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useUpdateRecipe(
  id: string,
): UseMutationResult<Recipe, unknown, Partial<RecipeInput>> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<RecipeInput>) => recipesApi.updateRecipe(id, input),
    onSuccess: (recipe) => {
      queryClient.setQueryData(keys.recipe(recipe.id), recipe);
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
      void queryClient.invalidateQueries({ queryKey: keys.tags() });
    },
  });
}

export function useDeleteRecipe(): UseMutationResult<void, unknown, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recipesApi.deleteRecipe,
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: keys.recipe(id) });
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

/**
 * L'identifiant est une variable de la mutation, non une dépendance du hook :
 * à la création, il n'existe pas encore au moment où le formulaire s'affiche.
 */
export function useUploadRecipeImage(): UseMutationResult<
  Recipe,
  unknown,
  { id: string; file: File }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      recipesApi.uploadRecipeImage(id, file),
    onSuccess: (recipe) => {
      queryClient.setQueryData(keys.recipe(recipe.id), recipe);
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

interface FavoriteVariables {
  id: string;
  favorite: boolean;
}

/** Retourne l'état de favori partout où la recette est en cache. */
function writeFavorite(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  favorite: boolean,
): void {
  queryClient.setQueryData<Recipe>(keys.recipe(id), (current) =>
    current === undefined ? current : { ...current, isFavorite: favorite },
  );
  const update = (page: Page<RecipeSummary> | undefined): Page<RecipeSummary> | undefined =>
    page === undefined
      ? page
      : {
          ...page,
          items: page.items.map((item) =>
            item.id === id ? { ...item, isFavorite: favorite } : item,
          ),
        };
  queryClient.setQueriesData<Page<RecipeSummary>>({ queryKey: ['recipes'] }, update);
  queryClient.setQueriesData<Page<RecipeSummary>>({ queryKey: ['discover'] }, update);
}

/**
 * Bascule appliquée avant la réponse du serveur : le cœur doit réagir sous le
 * doigt. Les routes rendant 204, c'est au cache de porter le nouvel état.
 */
export function useToggleFavorite(): UseMutationResult<void, unknown, FavoriteVariables> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, favorite }: FavoriteVariables) => recipesApi.setFavorite(id, favorite),
    async onMutate({ id, favorite }) {
      await queryClient.cancelQueries({ queryKey: keys.recipe(id) });
      writeFavorite(queryClient, id, favorite);
      return { id, previous: !favorite };
    },
    onError(_error, variables) {
      writeFavorite(queryClient, variables.id, !variables.favorite);
    },
    onSettled(_result, _error, variables) {
      // Un filtre « favoris » en cours doit reperdre la recette retirée.
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
      void queryClient.invalidateQueries({ queryKey: keys.recipe(variables.id) });
    },
  });
}
