import { Request, Response } from 'express';
import { serializeRecipe, serializeRecipePage } from '../../common/serialize';
import * as recipesService from './recipes.service';
import type { ListRecipesQuery } from './recipes.schemas';

export async function create(req: Request, res: Response): Promise<void> {
  const recipe = await recipesService.createRecipe(req.user!.id, req.body);
  res.status(201).json(serializeRecipe(recipe));
}

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListRecipesQuery;
  const page = await recipesService.searchRecipesForUser(req.user!.id, query);
  res.json(serializeRecipePage(page));
}

/** La recette a déjà été chargée et autorisée par le middleware d'accès. */
export async function detail(req: Request, res: Response): Promise<void> {
  const recipe = req.recipe!;
  const isFavorite = await recipesService.isRecipeFavorite(req.user!.id, recipe.id);
  res.json(serializeRecipe(recipe, isFavorite));
}

export async function update(req: Request, res: Response): Promise<void> {
  const recipe = await recipesService.updateRecipe(req.recipe!, req.body);
  const isFavorite = await recipesService.isRecipeFavorite(req.user!.id, recipe.id);
  res.json(serializeRecipe(recipe, isFavorite));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await recipesService.deleteRecipe(req.recipe!);
  res.status(204).send();
}

export async function setImage(req: Request, res: Response): Promise<void> {
  const recipe = await recipesService.setRecipeImage(req.recipe!, req.file!.filename);
  const isFavorite = await recipesService.isRecipeFavorite(req.user!.id, recipe.id);
  res.json(serializeRecipe(recipe, isFavorite));
}

export async function addFavorite(req: Request, res: Response): Promise<void> {
  await recipesService.addFavorite(req.user!.id, req.params.id);
  res.status(204).send();
}

export async function removeFavorite(req: Request, res: Response): Promise<void> {
  await recipesService.removeFavorite(req.user!.id, req.params.id);
  res.status(204).send();
}
