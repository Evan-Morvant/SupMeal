import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { validateBody, validateParams } from '../../middlewares/validate';
import { asyncHandler } from '../../common/async-handler';
import * as commentsController from './comments.controller';
import { commentParamsSchema, commentSchema } from './comments.schemas';

/**
 * Modification et suppression d'un commentaire déjà écrit. Ces routes ne
 * passent pas par `loadMembership` : le commentaire porte lui-même son
 * cookbook, et l'autorisation se joue sur l'auteur (ou le créateur du
 * cookbook pour la suppression), pas sur un rôle minimal.
 */
export const commentsRouter = Router();

commentsRouter.use(authenticate);

commentsRouter.patch(
  '/:commentId',
  validateParams(commentParamsSchema),
  validateBody(commentSchema),
  asyncHandler(commentsController.update),
);

commentsRouter.delete(
  '/:commentId',
  validateParams(commentParamsSchema),
  asyncHandler(commentsController.remove),
);
