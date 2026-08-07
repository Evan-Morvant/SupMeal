import { Request } from 'express';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env';
import { findOrCreateOAuthUser, linkOAuthAccount } from '../modules/auth/auth.service';
import type { OAuthProvider } from '../models/oauth-account.model';

/** Profil OAuth minimal commun aux providers (sous-ensemble structurel). */
interface RawProfile {
  id: string;
  displayName?: string;
  username?: string;
  emails?: { value: string }[];
  photos?: { value: string }[];
}

/** Construit le callback de callback URL pour un provider donné. */
function callbackURL(provider: OAuthProvider): string {
  return env.API_PUBLIC_URL + '/api/v1/auth/oauth/' + provider + '/callback';
}

/**
 * Mappe un profil provider vers nos données de compte, puis résout l'utilisateur.
 * `req.oauthLinkUserId`, extrait du `state` signé par le contrôleur, bascule du
 * flux de connexion vers le flux de liaison à un compte déjà connecté.
 */
function verify(provider: OAuthProvider) {
  return (
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: RawProfile,
    done: (err: unknown, user?: Express.User) => void,
  ): void => {
    const data = {
      provider,
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value ?? null,
      displayName: profile.displayName || profile.username || 'Utilisateur ' + provider,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
    const linkUserId = req.oauthLinkUserId;
    const resolve = linkUserId
      ? linkOAuthAccount(linkUserId, data)
      : findOrCreateOAuthUser(data);

    resolve.then((user) => done(null, user)).catch(done);
  };
}

/** Indique si un provider dispose d'identifiants configurés. */
export function isProviderConfigured(provider: OAuthProvider): boolean {
  if (provider === 'github') {
    return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
  }
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/** Enregistre les stratégies OAuth pour les providers configurés. */
export function configurePassport(): void {
  if (isProviderConfigured('github')) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
          callbackURL: callbackURL('github'),
          scope: ['user:email'],
          passReqToCallback: true,
        },
        verify('github'),
      ),
    );
  }

  if (isProviderConfigured('google')) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackURL: callbackURL('google'),
          scope: ['profile', 'email'],
          passReqToCallback: true,
        },
        verify('google'),
      ),
    );
  }
}
