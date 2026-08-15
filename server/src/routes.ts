import { Router } from 'express';
import { discoverRouter } from './modules/discover/discover.routes';
import { docsRouter } from './modules/docs/docs.routes';
import { healthRouter } from './modules/health/health.routes';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { recipesRouter } from './modules/recipes/recipes.routes';
import { cookbooksRouter } from './modules/cookbooks/cookbooks.routes';
import { invitationsRouter } from './modules/invitations/invitations.routes';
import { commentsRouter } from './modules/comments/comments.routes';
import { mealPlanRouter } from './modules/meal-plan/meal-plan.routes';
import { importExportRouter } from './modules/import-export/import-export.routes';
import { ingredientsRouter, tagsRouter } from './modules/catalog/catalog.routes';
import { shoppingListsRouter } from './modules/shopping-lists/shopping-lists.routes';

/**
 * Routeur racine monté sur /api/v1.
 * Les modules seront ajoutés ici au fil de l'implémentation
 * (cf. docs/conception/06-api-endpoints.md).
 */
export const router = Router();

router.use('/health', healthRouter);
router.use('/swagger', docsRouter);
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/discover', discoverRouter);
router.use('/recipes', recipesRouter);
router.use('/cookbooks', cookbooksRouter);
router.use('/invitations', invitationsRouter);
router.use('/comments', commentsRouter);
router.use('/meal-plan', mealPlanRouter);
router.use('/ingredients', ingredientsRouter);
router.use('/tags', tagsRouter);
router.use('/shopping-lists', shoppingListsRouter);

router.use('/', importExportRouter);
