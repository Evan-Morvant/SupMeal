import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { keys } from '../../api/query-keys';
import type { ReviewList } from '../../api/types';
import * as reviewsApi from './reviews.api';

export function useReviews(recipeId: string): UseQueryResult<ReviewList> {
  return useQuery({
    queryKey: keys.reviews(recipeId),
    queryFn: () => reviewsApi.listReviews(recipeId),
  });
}

/**
 * Écrire un avis déplace la moyenne portée par la recette : le détail et les
 * listes qui l'affichent sont donc invalidés avec le fil d'avis.
 */
function useReviewMutation<TVariables>(
  recipeId: string,
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.reviews(recipeId) });
      void queryClient.invalidateQueries({ queryKey: keys.recipe(recipeId) });
      void queryClient.invalidateQueries({ queryKey: keys.discoverRecipe(recipeId) });
      void queryClient.invalidateQueries({ queryKey: ['recipes'] });
      void queryClient.invalidateQueries({ queryKey: ['discover'] });
    },
  });
}

export function useSaveReview(recipeId: string) {
  return useReviewMutation(recipeId, (input: reviewsApi.ReviewInput) =>
    reviewsApi.saveReview(recipeId, input),
  );
}

export function useDeleteReview(recipeId: string) {
  return useReviewMutation(recipeId, () => reviewsApi.deleteReview(recipeId));
}
