import { api } from '../../api/client';
import type { OAuthAccount, OAuthProvider, User, UserPreferences } from '../../api/types';

export async function updateProfile(input: {
  displayName?: string;
  avatarUrl?: string | null;
}): Promise<User> {
  const { data } = await api.patch<User>('/users/me', input);
  return data;
}

/**
 * Changer le mot de passe révoque toutes les sessions. `currentPassword` n'est
 * exigé que s'il en existe un : un compte purement OAuth2 n'en a aucun à
 * confirmer.
 */
export async function changePassword(input: {
  currentPassword?: string;
  newPassword: string;
}): Promise<void> {
  await api.put('/users/me/password', input);
}

export async function getPreferences(): Promise<UserPreferences> {
  const { data } = await api.get<UserPreferences>('/users/me/preferences');
  return data;
}

/** Représentation complète : un champ omis est réinitialisé, non conservé. */
export async function replacePreferences(input: UserPreferences): Promise<UserPreferences> {
  const { data } = await api.put<UserPreferences>('/users/me/preferences', input);
  return data;
}

export async function listOAuthAccounts(): Promise<OAuthAccount[]> {
  const { data } = await api.get<OAuthAccount[]>('/users/me/oauth');
  return data;
}

/**
 * Rend l'URL d'autorisation à ouvrir pour lier un compte. La SPA ne peut pas
 * poser d'en-tête d'authentification sur une navigation vers le fournisseur :
 * l'identité voyage donc dans un `state` signé, préparé par le serveur.
 */
export async function startOAuthLink(provider: OAuthProvider): Promise<string> {
  const { data } = await api.post<{ authorizationUrl: string }>(
    '/users/me/oauth/' + provider,
  );
  return data.authorizationUrl;
}

export async function unlinkOAuthAccount(provider: OAuthProvider): Promise<void> {
  await api.delete('/users/me/oauth/' + provider);
}
