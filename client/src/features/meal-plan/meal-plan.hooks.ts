import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { keys } from '../../api/query-keys';
import type { MealPlanEntry } from '../../api/types';
import * as mealPlanApi from './meal-plan.api';

export function useMealPlan(
  window: mealPlanApi.MealPlanWindow,
): UseQueryResult<MealPlanEntry[]> {
  return useQuery({
    queryKey: keys.mealPlan(window.from, window.to, window.cookbookId),
    queryFn: () => mealPlanApi.listMealPlan(window),
  });
}

/**
 * Toute écriture invalide le planning entier : une entrée déplacée change de
 * semaine, et une liste de courses se génère depuis ces mêmes entrées.
 */
function useMealPlanMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meal-plan'] }),
  });
}

export function useAddMealPlanEntry() {
  return useMealPlanMutation(mealPlanApi.addMealPlanEntry);
}

export function useUpdateMealPlanEntry() {
  return useMealPlanMutation(
    ({ entryId, patch }: { entryId: string; patch: mealPlanApi.MealPlanEntryPatch }) =>
      mealPlanApi.updateMealPlanEntry(entryId, patch),
  );
}

export function useDeleteMealPlanEntry() {
  return useMealPlanMutation(mealPlanApi.deleteMealPlanEntry);
}
