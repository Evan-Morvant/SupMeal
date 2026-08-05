import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { validateBody } from '../../middlewares/validate';
import { authLimiter } from '../../middlewares/rate-limit';
import { asyncHandler } from '../../common/async-handler';
import * as authController from './auth.controller';
import * as oauthController from './oauth.controller';
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from './auth.schemas';

export const authRouter = Router();

authRouter.post(
  '/register',
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(authController.register),
);
authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(authController.login),
);
authRouter.post('/refresh', validateBody(refreshSchema), asyncHandler(authController.refresh));
authRouter.post(
  '/logout',
  authenticate,
  validateBody(logoutSchema),
  asyncHandler(authController.logout),
);
authRouter.get('/me', authenticate, asyncHandler(authController.me));

// OAuth2 (GitHub, Google) — flux redirect géré par Passport.
authRouter.get('/oauth/:provider', oauthController.start);
authRouter.get('/oauth/:provider/callback', oauthController.callback);
