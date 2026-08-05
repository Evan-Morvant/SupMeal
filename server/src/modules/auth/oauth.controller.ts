import { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import { AppError } from '../../common/app-error';
import { signOAuthState, verifyOAuthState } from '../../common/tokens';
import { env } from '../../config/env';
import { isProviderConfigured } from '../../config/passport';
import type { OAuthProvider } from '../../models/oauth-account.model';
import type { User } from '../../models';
import { issueTokens } from './auth.service';

const SUPPORTED_PROVIDERS: OAuthProvider[] = ['github', 'google'];

function isSupportedProvider(value: string): value is OAuthProvider {
  return (SUPPORTED_PROVIDERS as string[]).includes(value);
}

/** URL de retour vers la SPA, tokens ou erreur transmis dans le fragment. */
function frontendCallback(fragment: string): string {
  return env.CLIENT_ORIGIN + '/oauth/callback#' + fragment;
}

/** Vérifie que le provider est supporté et configuré, sinon lève une AppError. */
function assertProvider(provider: string): asserts provider is OAuthProvider {
  if (!isSupportedProvider(provider)) {
    throw new AppError(404, 'UNKNOWN_PROVIDER', 'Provider OAuth inconnu');
  }
  if (!isProviderConfigured(provider)) {
    throw new AppError(503, 'PROVIDER_NOT_CONFIGURED', 'Provider OAuth non configuré');
  }
}

/** GET /auth/oauth/:provider — redirige vers le fournisseur avec un state signé. */
export function start(req: Request, res: Response, next: NextFunction): void {
  const { provider } = req.params;
  assertProvider(provider);

  const options: passport.AuthenticateOptions = { session: false };
  (options as { state?: string }).state = signOAuthState(provider);
  passport.authenticate(provider, options)(req, res, next);
}

/** GET /auth/oauth/:provider/callback — échange le code, émet les tokens, redirige. */
export function callback(req: Request, res: Response, next: NextFunction): void {
  const { provider } = req.params;
  assertProvider(provider);

  try {
    verifyOAuthState(String(req.query.state ?? ''), provider);
  } catch {
    res.redirect(frontendCallback('error=state_invalide'));
    return;
  }

  passport.authenticate(
    provider,
    { session: false },
    (err: unknown, user?: Express.User | false | null) => {
      if (err || !user) {
        res.redirect(frontendCallback('error=oauth_echec'));
        return;
      }
      issueTokens(user as unknown as User)
        .then((tokens) => {
          res.redirect(
            frontendCallback(
              'accessToken=' +
                encodeURIComponent(tokens.accessToken) +
                '&refreshToken=' +
                encodeURIComponent(tokens.refreshToken),
            ),
          );
        })
        .catch(next);
    },
  )(req, res, next);
}
