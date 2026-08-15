import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { validateBody } from '../../middlewares/validate';
import { asyncHandler } from '../../common/async-handler';
import * as personalDataController from '../personal-data/personal-data.controller';
import * as usersController from './users.controller';
import { changePasswordSchema, preferencesSchema, updateProfileSchema } from './users.schemas';

export const usersRouter = Router();

// Tout le module porte sur le profil du porteur du token.
usersRouter.use(authenticate);

usersRouter.get('/me', asyncHandler(usersController.getProfile));
usersRouter.patch(
  '/me',
  validateBody(updateProfileSchema),
  asyncHandler(usersController.updateProfile),
);
usersRouter.put(
  '/me/password',
  validateBody(changePasswordSchema),
  asyncHandler(usersController.changePassword),
);

usersRouter.get('/me/preferences', asyncHandler(usersController.getPreferences));
usersRouter.put(
  '/me/preferences',
  validateBody(preferencesSchema),
  asyncHandler(usersController.replacePreferences),
);

usersRouter.get('/me/data', asyncHandler(personalDataController.download));
usersRouter.get('/me/oauth', asyncHandler(usersController.listOAuthAccounts));
usersRouter.post('/me/oauth/:provider', asyncHandler(usersController.startOAuthLink));
usersRouter.delete('/me/oauth/:provider', asyncHandler(usersController.unlinkOAuthAccount));
