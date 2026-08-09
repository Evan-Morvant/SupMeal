import { RequestHandler, Router } from 'express';
import { ZodTypeAny } from 'zod';
import { authenticate } from '../../middlewares/authenticate';
import { loadMembership } from '../../middlewares/load-membership';
import { requireRole, type Role } from '../../middlewares/require-role';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validate';
import { asyncHandler } from '../../common/async-handler';
import { createRecipeSchema } from '../recipes/recipes.schemas';
import * as commentsController from '../comments/comments.controller';
import { commentSchema } from '../comments/comments.schemas';
import * as invitationsController from '../invitations/invitations.controller';
import * as cookbooksController from './cookbooks.controller';
import * as membersController from './members.controller';
import {
  cookbookParamsSchema,
  cookbookRecipeParamsSchema,
  createCookbookSchema,
  invitationParamsSchema,
  inviteMemberSchema,
  listCookbookRecipesSchema,
  memberParamsSchema,
  updateCookbookSchema,
  updateMemberRoleSchema,
} from './cookbooks.schemas';

export const cookbooksRouter = Router();

cookbooksRouter.use(authenticate);

/**
 * Pile commune aux routes ciblant un cookbook : identifiants bien formés,
 * appartenance chargée, puis rôle minimal exigé. Le schéma de paramètres
 * varie selon que la route désigne en plus une recette, un membre ou une
 * invitation.
 */
const guards = (min: Role, params: ZodTypeAny = cookbookParamsSchema): RequestHandler[] => [
  validateParams(params),
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
  ...guards('EDITOR', cookbookRecipeParamsSchema),
  asyncHandler(cookbooksController.linkRecipe),
);
cookbooksRouter.delete(
  '/:id/recipes/:recipeId',
  ...guards('EDITOR', cookbookRecipeParamsSchema),
  asyncHandler(cookbooksController.unlinkRecipe),
);

// Commentaires : privé au cookbook.
// Le lecteur suit la conversation, le commentateur y participe.
cookbooksRouter.get(
  '/:id/recipes/:recipeId/comments',
  ...guards('READER', cookbookRecipeParamsSchema),
  asyncHandler(commentsController.list),
);

cookbooksRouter.post(
  '/:id/recipes/:recipeId/comments',
  ...guards('COMMENTER', cookbookRecipeParamsSchema),
  validateBody(commentSchema),
  asyncHandler(commentsController.create),
);

cookbooksRouter.get(
  '/:id/members',
  ...guards('READER'),
  asyncHandler(membersController.list));

cookbooksRouter.delete(
  '/:id/members/me',
  ...guards('READER'),
  asyncHandler(membersController.leave),
);

cookbooksRouter.patch(
  '/:id/members/:userId',
  ...guards('OWNER', memberParamsSchema),
  validateBody(updateMemberRoleSchema),
  asyncHandler(membersController.updateRole),
);

cookbooksRouter.delete(
  '/:id/members/:userId',
  ...guards('OWNER', memberParamsSchema),
  asyncHandler(membersController.remove),
);

cookbooksRouter.get(
  '/:id/invitations',
  ...guards('OWNER'),
  asyncHandler(invitationsController.list));

cookbooksRouter.post(
  '/:id/invitations',
  ...guards('OWNER'),
  validateBody(inviteMemberSchema),
  asyncHandler(invitationsController.invite),
);

cookbooksRouter.delete(
  '/:id/invitations/:invId',
  ...guards('OWNER', invitationParamsSchema),
  asyncHandler(invitationsController.revoke),
);
