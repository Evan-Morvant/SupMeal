import { api } from '../../api/client';
import type { MealPlanEntry, MealType } from '../../api/types';

/*
 * Deux plannings distincts : sans `cookbookId`, celui de l'appelant ; avec,
 * celui du groupe, toutes personnes confondues.
 */

export interface MealPlanWindow {
  from: string;
  to: string;
  cookbookId?: string;
}

export interface MealPlanEntryInput {
  recipeId: string;
  date: string;
  mealType: MealType;
  servings?: number | null;
  cookbookId?: string | null;
}

export async function listMealPlan(window: MealPlanWindow): Promise<MealPlanEntry[]> {
  const { data } = await api.get<MealPlanEntry[]>('/meal-plan', { params: window });
  return data;
}

export async function addMealPlanEntry(input: MealPlanEntryInput): Promise<MealPlanEntry> {
  const { data } = await api.post<MealPlanEntry>('/meal-plan', input);
  return data;
}

/**
 * `cookbookId` est absent du corps et les clés inconnues sont refusées : une
 * entrée ne déménage pas d'un planning personnel vers celui d'un groupe, les
 * droits qui l'encadrent changeraient en route. Il faut supprimer puis recréer.
 */
export type MealPlanEntryPatch = Partial<Omit<MealPlanEntryInput, 'cookbookId'>>;

export async function updateMealPlanEntry(
  entryId: string,
  patch: MealPlanEntryPatch,
): Promise<MealPlanEntry> {
  const { data } = await api.patch<MealPlanEntry>('/meal-plan/' + entryId, patch);
  return data;
}

export async function deleteMealPlanEntry(entryId: string): Promise<void> {
  await api.delete('/meal-plan/' + entryId);
}
