import { Router } from 'express';
import { healthRouter } from './modules/health/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { recipesRouter } from './modules/recipes/recipes.routes';
import { cookbooksRouter } from './modules/cookbooks/cookbooks.routes';
import { invitationsRouter } from './modules/invitations/invitations.routes';
import { commentsRouter } from './modules/comments/comments.routes';
import { mealPlanRouter } from './modules/meal-plan/meal-plan.routes';
import { importExportRouter } from './modules/import-export/import-export.routes';

/**
 * Routeur racine monté sur /api/v1.
 * Les modules seront ajoutés ici au fil de l'implémentation
 * (cf. docs/conception/06-api-endpoints.md).
 */
export const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/recipes', recipesRouter);
router.use('/cookbooks', cookbooksRouter);
router.use('/invitations', invitationsRouter);
router.use('/comments', commentsRouter);
router.use('/meal-plan', mealPlanRouter);

router.use('/', importExportRouter);

// TODO (Phase 2) :
// router.use('/shopping-lists', shoppingListsRouter);
// router.use('/ingredients', ingredientsRouter);
// router.use('/tags', tagsRouter);
