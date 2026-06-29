import { Router } from 'express';
import { healthRouter } from './modules/health/health.routes';

/**
 * Routeur racine monté sur /api/v1.
 * Les modules seront ajoutés ici au fil de l'implémentation
 * (cf. docs/conception/06-api-endpoints.md).
 */
export const router = Router();

router.use('/health', healthRouter);

// TODO (Phase 2) :
// router.use('/auth', authRouter);
// router.use('/users', usersRouter);
// router.use('/recipes', recipesRouter);
// router.use('/cookbooks', cookbooksRouter);
// router.use('/meal-plan', mealPlanRouter);
// router.use('/shopping-lists', shoppingListsRouter);
// router.use('/ingredients', ingredientsRouter);
// router.use('/tags', tagsRouter);
