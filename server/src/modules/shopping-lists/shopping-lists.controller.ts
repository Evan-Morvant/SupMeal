import { Request, Response } from 'express';
import { serializeShoppingList, serializeShoppingListItem } from '../../common/serialize';
import * as shoppingListsService from './shopping-lists.service';

export async function generate(req: Request, res: Response): Promise<void> {
  const list = await shoppingListsService.generateShoppingList(req.user!.id, req.body);
  res.status(201).json(serializeShoppingList(list));
}

export async function list(req: Request, res: Response): Promise<void> {
  const lists = await shoppingListsService.listShoppingLists(req.user!.id);
  res.json(lists.map(serializeShoppingList));
}

export async function detail(req: Request, res: Response): Promise<void> {
  const found = await shoppingListsService.findAccessibleListOrFail(req.params.id, req.user!.id);
  res.json(serializeShoppingList(found));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await shoppingListsService.deleteShoppingList(req.params.id, req.user!.id);
  res.status(204).send();
}

export async function updateItem(req: Request, res: Response): Promise<void> {
  const updated = await shoppingListsService.updateItem(
    req.params.id,
    req.params.itemId,
    req.user!.id,
    req.body,
  );
  res.json(serializeShoppingListItem(updated));
}
