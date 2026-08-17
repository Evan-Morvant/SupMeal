import { Request, Response } from 'express';
import { AppError } from '../../common/app-error';
import { serializeIngredient, serializeTag } from '../../common/serialize';
import * as catalogService from './catalog.service';
import type { ListIngredientsQuery, ListTagsQuery } from './catalog.schemas';

export async function listIngredients(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListIngredientsQuery;
  const ingredients = await catalogService.searchIngredients(query);
  res.json(ingredients.map(serializeIngredient));
}

export async function listTags(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListTagsQuery;
  // « Les miens » suppose de savoir qui demande : la route est ouverte au
  // visiteur, ce paramètre-là ne l'est pas.
  if (query.mine === true && req.user === undefined) {
    throw new AppError(401, 'UNAUTHORIZED', 'Token manquant');
  }
  const tags = await catalogService.listTags(query, req.user?.id);
  res.json(tags.map(serializeTag));
}
