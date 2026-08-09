import { Request, Response } from 'express';
import { serializeMealPlanEntry } from '../../common/serialize';
import { isRecipeFavorite } from '../recipes/recipes.service';
import * as mealPlanService from './meal-plan.service';
import type { ListMealPlanQuery } from './meal-plan.schemas';

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListMealPlanQuery;
  const { entries, favoriteIds } = await mealPlanService.listEntries(req.user!.id, query);

  res.json(
    entries.map((entry) => serializeMealPlanEntry(entry, favoriteIds.has(entry.recipeId))),
  );
}

export async function create(req: Request, res: Response): Promise<void> {
  const entry = await mealPlanService.createEntry(req.user!.id, req.body);
  const isFavorite = await isRecipeFavorite(req.user!.id, entry.recipeId);
  res.status(201).json(serializeMealPlanEntry(entry, isFavorite));
}

export async function update(req: Request, res: Response): Promise<void> {
  const entry = await mealPlanService.updateEntry(req.params.entryId, req.user!.id, req.body);
  const isFavorite = await isRecipeFavorite(req.user!.id, entry.recipeId);
  res.json(serializeMealPlanEntry(entry, isFavorite));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await mealPlanService.deleteEntry(req.params.entryId, req.user!.id);
  res.status(204).send();
}
