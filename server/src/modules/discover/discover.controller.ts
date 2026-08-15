import { Request, Response } from 'express';
import { serializeRecipe, serializeRecipePage } from '../../common/serialize';
import { findFavoriteRecipeIds } from '../recipes/recipes.service';
import type { DiscoverRecipesQuery } from '../recipes/recipes.schemas';
import * as discoverService from './discover.service';

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as DiscoverRecipesQuery;
  const page = await discoverService.discoverRecipes(query, req.user?.id);
  res.json(serializeRecipePage(page));
}

export async function detail(req: Request, res: Response): Promise<void> {
  const recipe = await discoverService.findPublicRecipeOrFail(req.params.id);
  const favorites =
    req.user === undefined
      ? new Set<string>()
      : await findFavoriteRecipeIds(req.user.id, [recipe.id]);

  res.json(serializeRecipe(recipe, favorites.has(recipe.id)));
}
