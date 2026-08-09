import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate';
import { asyncHandler } from '../../common/async-handler';
import * as mealPlanController from './meal-plan.controller';
import {
  createMealPlanEntrySchema,
  listMealPlanSchema,
  mealPlanEntryParamsSchema,
  updateMealPlanEntrySchema,
} from './meal-plan.schemas';

/**
 * Le cookbook visé arrive par la chaîne de requête ou par le corps, et le
 * contrôle de rôle est fait dans le service (`assertCookbookRole`).
 */
export const mealPlanRouter = Router();

mealPlanRouter.use(authenticate);

mealPlanRouter.get(
  '/',
  validateQuery(listMealPlanSchema),
  asyncHandler(mealPlanController.list),
);

mealPlanRouter.post(
  '/',
  validateBody(createMealPlanEntrySchema),
  asyncHandler(mealPlanController.create),
);

mealPlanRouter.patch(
  '/:entryId',
  validateParams(mealPlanEntryParamsSchema),
  validateBody(updateMealPlanEntrySchema),
  asyncHandler(mealPlanController.update),
);

mealPlanRouter.delete(
  '/:entryId',
  validateParams(mealPlanEntryParamsSchema),
  asyncHandler(mealPlanController.remove),
);
