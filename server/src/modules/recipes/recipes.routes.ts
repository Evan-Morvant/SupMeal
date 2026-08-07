import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { requireRecipeAccess, requireRecipeOwner } from '../../middlewares/recipe-access';
import { validateBody, validateQuery } from '../../middlewares/validate';
import { asyncHandler } from '../../common/async-handler';
import * as recipesController from './recipes.controller';
import { createRecipeSchema, listRecipesSchema, updateRecipeSchema } from './recipes.schemas';

export const recipesRouter = Router();

// La consultation anonyme des recettes publiques passera par /discover.
recipesRouter.use(authenticate);

recipesRouter.get(
  '/',
  validateQuery(listRecipesSchema),
  asyncHandler(recipesController.list),
);
recipesRouter.post(
  '/',
  validateBody(createRecipeSchema),
  asyncHandler(recipesController.create),
);

recipesRouter.get(
  '/:id',
  asyncHandler(requireRecipeAccess),
  asyncHandler(recipesController.detail),
);
recipesRouter.patch(
  '/:id',
  asyncHandler(requireRecipeOwner),
  validateBody(updateRecipeSchema),
  asyncHandler(recipesController.update),
);
recipesRouter.delete(
  '/:id',
  asyncHandler(requireRecipeOwner),
  asyncHandler(recipesController.remove),
);
