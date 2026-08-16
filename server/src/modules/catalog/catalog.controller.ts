import { Request, Response } from 'express';
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
  const tags = await catalogService.listTags(query, req.user !== undefined);
  res.json(tags.map(serializeTag));
}
