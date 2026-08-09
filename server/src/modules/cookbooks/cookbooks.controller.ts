import { Request, Response } from 'express';
import { serializeCookbook, serializeRecipe, serializeRecipePage } from '../../common/serialize';
import * as cookbooksService from './cookbooks.service';
import type { ListCookbookRecipesQuery } from './cookbooks.schemas';

export async function list(req: Request, res: Response): Promise<void> {
  const views = await cookbooksService.listCookbooks(req.user!.id);
  res.json(views.map(serializeCookbook));
}

export async function create(req: Request, res: Response): Promise<void> {
  const view = await cookbooksService.createCookbook(req.user!.id, req.body);
  res.status(201).json(serializeCookbook(view));
}

/** Appartenance et rôle sont déjà établis par `loadMembership`. */
export async function detail(req: Request, res: Response): Promise<void> {
  const { cookbookId, role } = req.membership!;
  res.json(serializeCookbook(await cookbooksService.getCookbookView(cookbookId, role)));
}

export async function update(req: Request, res: Response): Promise<void> {
  const { cookbookId, role } = req.membership!;
  const view = await cookbooksService.updateCookbook(cookbookId, role, req.body);
  res.json(serializeCookbook(view));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await cookbooksService.deleteCookbook(req.membership!.cookbookId);
  res.status(204).send();
}

export async function listRecipes(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListCookbookRecipesQuery;
  const page = await cookbooksService.listCookbookRecipes(
    req.user!.id,
    req.membership!.cookbookId,
    query,
  );
  res.json(serializeRecipePage(page));
}

export async function createRecipe(req: Request, res: Response): Promise<void> {
  const recipe = await cookbooksService.createRecipeInCookbook(
    req.user!.id,
    req.membership!.cookbookId,
    req.body,
  );
  res.status(201).json(serializeRecipe(recipe));
}

export async function linkRecipe(req: Request, res: Response): Promise<void> {
  await cookbooksService.linkRecipe(
    req.user!.id,
    req.membership!.cookbookId,
    req.params.recipeId,
  );
  res.status(204).send();
}

export async function unlinkRecipe(req: Request, res: Response): Promise<void> {
  await cookbooksService.unlinkRecipe(req.membership!.cookbookId, req.params.recipeId);
  res.status(204).send();
}
