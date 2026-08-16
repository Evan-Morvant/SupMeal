import { Router } from 'express';
import { authenticateOptional } from '../../middlewares/authenticate';
import { validateParams, validateQuery } from '../../middlewares/validate';
import { asyncHandler } from '../../common/async-handler';
import { discoverRecipesSchema, recipeParamsSchema } from '../recipes/recipes.schemas';
import * as discoverController from './discover.controller';

/** Catalogue public. Ouvert aux visiteurs, enrichi pour qui est connecté. */
export const discoverRouter = Router();

discoverRouter.use(authenticateOptional);

discoverRouter.get(
  '/recipes',
  validateQuery(discoverRecipesSchema),
  asyncHandler(discoverController.list),
);

discoverRouter.get(
  '/recipes/:id',
  validateParams(recipeParamsSchema),
  asyncHandler(discoverController.detail),
);
