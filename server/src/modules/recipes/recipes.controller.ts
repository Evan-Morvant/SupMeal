import { Request, Response } from 'express';
import { serializeRecipe, serializeRecipeSummary } from '../../common/serialize';
import * as recipesService from './recipes.service';
import type { ListRecipesQuery } from './recipes.schemas';

export async function create(req: Request, res: Response): Promise<void> {
  const recipe = await recipesService.createRecipe(req.user!.id, req.body);
  res.status(201).json(serializeRecipe(recipe));
}

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListRecipesQuery;
  const page = await recipesService.listOwnedRecipes(req.user!.id, query);
  res.json({
    items: page.items.map(serializeRecipeSummary),
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
  });
}

/** La recette a déjà été chargée et autorisée par le middleware d'accès. */
export async function detail(req: Request, res: Response): Promise<void> {
  res.json(serializeRecipe(req.recipe!));
}

export async function update(req: Request, res: Response): Promise<void> {
  const recipe = await recipesService.updateRecipe(req.recipe!, req.body);
  res.json(serializeRecipe(recipe));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await recipesService.deleteRecipe(req.recipe!);
  res.status(204).send();
}
