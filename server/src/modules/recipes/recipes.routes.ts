import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import {
  requireRecipeAccess,
  requireRecipeEditor,
  requireRecipeOwner,
} from '../../middlewares/recipe-access';
import { uploadRecipeImage } from '../../middlewares/upload';
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
  asyncHandler(requireRecipeEditor),
  validateBody(updateRecipeSchema),
  asyncHandler(recipesController.update),
);
recipesRouter.delete(
  '/:id',
  asyncHandler(requireRecipeOwner),
  asyncHandler(recipesController.remove),
);

recipesRouter.post(
  '/:id/image',
  asyncHandler(requireRecipeOwner),
  uploadRecipeImage,
  asyncHandler(recipesController.setImage),
);

recipesRouter.post(
  '/:id/favorite',
  asyncHandler(requireRecipeAccess),
  asyncHandler(recipesController.addFavorite),
);

recipesRouter.delete(
  '/:id/favorite',
  asyncHandler(recipesController.removeFavorite),
);
