import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/authenticate';
import { validateParams } from '../../middlewares/validate';
import { asyncHandler } from '../../common/async-handler';
import * as invitationsController from './invitations.controller';

/**
 * Réponse à une invitation. Ces routes ne passent pas par `loadMembership` :
 * l'invité n'est justement pas encore membre du cookbook. C'est le token, et
 * l'email qu'il vise, qui font foi.
 */
export const invitationsRouter = Router();

const tokenParamsSchema = z.object({ token: z.string().length(64).regex(/^[0-9a-f]+$/) });

invitationsRouter.use(authenticate);

invitationsRouter.post(
  '/:token/accept',
  validateParams(tokenParamsSchema),
  asyncHandler(invitationsController.accept),
);
invitationsRouter.post(
  '/:token/decline',
  validateParams(tokenParamsSchema),
  asyncHandler(invitationsController.decline),
);
