import { RequestHandler, Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { loadMembership } from '../../middlewares/load-membership';
import { requireRole, type Role } from '../../middlewares/require-role';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate';
import { asyncHandler } from '../../common/async-handler';
import { createRecipeSchema } from '../recipes/recipes.schemas';
import * as cookbooksController from './cookbooks.controller';
import {
  cookbookParamsSchema,
  cookbookRecipeParamsSchema,
  createCookbookSchema,
  listCookbookRecipesSchema,
  updateCookbookSchema,
} from './cookbooks.schemas';

export const cookbooksRouter = Router();

cookbooksRouter.use(authenticate);

/**
 * Pile commune aux routes ciblant un cookbook : identifiants bien formés,
 * appartenance chargée, puis rôle minimal exigé.
 */
const guards = (min: Role): RequestHandler[] => [
  validateParams(cookbookParamsSchema),
  asyncHandler(loadMembership()),
  requireRole(min),
];

/** Même pile pour les routes qui désignent en plus une recette. */
const recipeGuards = (min: Role): RequestHandler[] => [
  validateParams(cookbookRecipeParamsSchema),
  asyncHandler(loadMembership()),
  requireRole(min),
];

cookbooksRouter.get('/', asyncHandler(cookbooksController.list));
cookbooksRouter.post(
  '/',
  validateBody(createCookbookSchema),
  asyncHandler(cookbooksController.create),
);

cookbooksRouter.get('/:id', ...guards('READER'), asyncHandler(cookbooksController.detail));
cookbooksRouter.patch(
  '/:id',
  ...guards('OWNER'),
  validateBody(updateCookbookSchema),
  asyncHandler(cookbooksController.update),
);
cookbooksRouter.delete('/:id', ...guards('OWNER'), asyncHandler(cookbooksController.remove));

cookbooksRouter.get(
  '/:id/recipes',
  ...guards('READER'),
  validateQuery(listCookbookRecipesSchema),
  asyncHandler(cookbooksController.listRecipes),
);
cookbooksRouter.post(
  '/:id/recipes',
  ...guards('EDITOR'),
  validateBody(createRecipeSchema),
  asyncHandler(cookbooksController.createRecipe),
);

cookbooksRouter.put(
  '/:id/recipes/:recipeId',
  ...recipeGuards('EDITOR'),
  asyncHandler(cookbooksController.linkRecipe),
);
cookbooksRouter.delete(
  '/:id/recipes/:recipeId',
  ...recipeGuards('EDITOR'),
  asyncHandler(cookbooksController.unlinkRecipe),
);
