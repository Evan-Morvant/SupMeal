import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { validateBody, validateParams } from '../../middlewares/validate';
import { asyncHandler } from '../../common/async-handler';
import * as shoppingListsController from './shopping-lists.controller';
import {
  generateShoppingListSchema,
  shoppingListItemParamsSchema,
  shoppingListParamsSchema,
  updateShoppingListItemSchema,
} from './shopping-lists.schemas';

/**
 * Le cookbook visé arrive par le corps à la génération, puis se lit sur la
 * liste elle-même : le contrôle de rôle se fait donc dans le service, comme
 * pour le planning dont ces listes sont issues.
 */
export const shoppingListsRouter = Router();

shoppingListsRouter.use(authenticate);

shoppingListsRouter.get('/', asyncHandler(shoppingListsController.list));

shoppingListsRouter.post(
  '/',
  validateBody(generateShoppingListSchema),
  asyncHandler(shoppingListsController.generate),
);

shoppingListsRouter.get(
  '/:id',
  validateParams(shoppingListParamsSchema),
  asyncHandler(shoppingListsController.detail),
);

shoppingListsRouter.delete(
  '/:id',
  validateParams(shoppingListParamsSchema),
  asyncHandler(shoppingListsController.remove),
);

shoppingListsRouter.patch(
  '/:id/items/:itemId',
  validateParams(shoppingListItemParamsSchema),
  validateBody(updateShoppingListItemSchema),
  asyncHandler(shoppingListsController.updateItem),
);
