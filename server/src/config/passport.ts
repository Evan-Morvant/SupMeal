import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env';
import { findOrCreateOAuthUser } from '../modules/auth/auth.service';
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

/** Mappe un profil provider vers nos données de compte, puis résout l'utilisateur. */
function verify(provider: OAuthProvider) {
  return (
    _accessToken: string,
    _refreshToken: string,
    profile: RawProfile,
    done: (err: unknown, user?: Express.User) => void,
  ): void => {
    findOrCreateOAuthUser({
      provider,
      providerUserId: profile.id,
      email: profile.emails?.[0]?.value ?? null,
      displayName: profile.displayName || profile.username || 'Utilisateur ' + provider,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    })
      .then((user) => done(null, user))
      .catch(done);
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
        },
        verify('google'),
      ),
    );
  }
}
