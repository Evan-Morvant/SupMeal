import { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import { AppError } from '../../common/app-error';
import { signOAuthState, verifyOAuthState } from '../../common/tokens';
import { env } from '../../config/env';
import { isProviderConfigured } from '../../config/passport';
import { isOAuthProvider, type OAuthProvider } from '../../models/oauth-account.model';
import type { User } from '../../models';
import { issueTokens } from './auth.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Renseigné par le callback OAuth quand le flux est une liaison de compte. */
      oauthLinkUserId?: string;
    }
  }
}

/** URL de retour vers la SPA, tokens ou erreur transmis dans le fragment. */
function frontendCallback(fragment: string): string {
  return env.CLIENT_ORIGIN + '/oauth/callback#' + fragment;
}

/** Vérifie que le provider est supporté et configuré, sinon lève une AppError. */
export function assertProvider(provider: string): asserts provider is OAuthProvider {
  if (!isOAuthProvider(provider)) {
    throw new AppError(404, 'UNKNOWN_PROVIDER', 'Provider OAuth inconnu');
  }
  if (!isProviderConfigured(provider)) {
    throw new AppError(503, 'PROVIDER_NOT_CONFIGURED', 'Provider OAuth non configuré');
  }
}

/**
 * URL d'autorisation à ouvrir dans le navigateur pour lier un compte au
 * profil courant. Le `state` signé porte l'utilisateur cible : la SPA ne peut
 * pas poser d'en-tête `Authorization` sur une navigation vers le provider.
 */
export function buildLinkUrl(provider: OAuthProvider, userId: string): string {
  const state = signOAuthState(provider, userId);
  return (
    env.API_PUBLIC_URL + '/api/v1/auth/oauth/' + provider + '?state=' + encodeURIComponent(state)
  );
}

/** GET /auth/oauth/:provider — redirige vers le fournisseur avec un state signé. */
export function start(req: Request, res: Response, next: NextFunction): void {
  const { provider } = req.params;
  assertProvider(provider);

  // Un state déjà signé signale un flux de liaison : on le réutilise tel quel
  // après vérification, sinon on en émet un nouveau pour une simple connexion.
  let state = typeof req.query.state === 'string' ? req.query.state : '';
  if (state) {
    try {
      verifyOAuthState(state, provider);
    } catch {
      throw new AppError(400, 'INVALID_STATE', 'Paramètre state invalide ou expiré');
    }
  } else {
    state = signOAuthState(provider);
  }

  const options: passport.AuthenticateOptions = { session: false };
  (options as { state?: string }).state = state;
  passport.authenticate(provider, options)(req, res, next);
}

/** GET /auth/oauth/:provider/callback — échange le code, émet les tokens, redirige. */
export function callback(req: Request, res: Response, next: NextFunction): void {
  const { provider } = req.params;
  assertProvider(provider);

  let linkUserId: string | undefined;
  try {
    linkUserId = verifyOAuthState(String(req.query.state ?? ''), provider).linkUserId;
  } catch {
    res.redirect(frontendCallback('error=state_invalide'));
    return;
  }
  req.oauthLinkUserId = linkUserId;

  passport.authenticate(
    provider,
    { session: false },
    (err: unknown, user?: Express.User | false | null) => {
      if (err || !user) {
        const code = err instanceof AppError ? err.code : 'oauth_echec';
        res.redirect(frontendCallback('error=' + encodeURIComponent(code)));
        return;
      }

      // Liaison : l'utilisateur est déjà connecté côté SPA, pas de nouveaux tokens.
      if (linkUserId) {
        res.redirect(frontendCallback('linked=' + provider));
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
