import { Router } from 'express';
import { authenticate, authenticateOptional } from '../../middlewares/authenticate';
import { requireRecipeAccess } from '../../middlewares/recipe-access';
import { validateBody } from '../../middlewares/validate';
import { asyncHandler } from '../../common/async-handler';
import * as reviewsController from './reviews.controller';
import { reviewSchema } from './reviews.schemas';

/**
 * Avis publics, montés sous `/recipes/:id/reviews` (`mergeParams` pour le
 * `:id` du parent). L'authentification est déclarée route par route : la
 * lecture s'ouvre aux visiteurs, l'écriture non.
 */
export const reviewsRouter = Router({ mergeParams: true });

reviewsRouter.get(
  '/',
  authenticateOptional,
  asyncHandler(requireRecipeAccess),
  asyncHandler(reviewsController.list),
);

reviewsRouter.put(
  '/',
  authenticate,
  asyncHandler(requireRecipeAccess),
  validateBody(reviewSchema),
  asyncHandler(reviewsController.upsert),
);

// Sans garde d'accès : perdre l'accès à une recette ne doit pas y laisser un
// avis qu'on ne pourrait plus effacer.
reviewsRouter.delete('/', authenticate, asyncHandler(reviewsController.remove));
