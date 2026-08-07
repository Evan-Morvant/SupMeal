import { OAuthAccount, User, UserPreferences } from '../models';

/** Représentation publique d'un utilisateur. */
export function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Représentation des préférences culinaires. */
export function serializeUserPreferences(preferences: UserPreferences) {
  return {
    diets: preferences.diets,
    allergies: preferences.allergies,
    preferredCuisines: preferences.preferredCuisines,
    defaultServings: preferences.defaultServings,
  };
}

/** Compte OAuth2 lié : jamais l'identifiant côté fournisseur. */
export function serializeOAuthAccount(account: OAuthAccount) {
  return {
    id: account.id,
    provider: account.provider,
    createdAt: account.createdAt,
  };
}
