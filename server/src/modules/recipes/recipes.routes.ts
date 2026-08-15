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
import * as importExportController from '../import-export/import-export.controller';
import { exportQuerySchema } from '../import-export/import-export.schemas';
import { reviewsRouter } from '../reviews/reviews.routes';
import * as suggestionsController from '../suggestions/suggestions.controller';
import { listSuggestionsSchema } from '../suggestions/suggestions.schemas';
import * as recipesController from './recipes.controller';
import { createRecipeSchema, listRecipesSchema, updateRecipeSchema } from './recipes.schemas';

export const recipesRouter = Router();

// Avant l'authentification globale : les avis portent leur propre pile, dont
// une lecture ouverte aux visiteurs.
recipesRouter.use('/:id/reviews', reviewsRouter);

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
  '/suggestions',
  validateQuery(listSuggestionsSchema),
  asyncHandler(suggestionsController.list),
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

// Export d'une recette isolée : mêmes formats que l'export complet, et le
// fichier produit se réimporte par /import sans traitement particulier.
recipesRouter.get(
  '/:id/export',
  asyncHandler(requireRecipeAccess),
  validateQuery(exportQuerySchema),
  asyncHandler(importExportController.exportRecipe),
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
