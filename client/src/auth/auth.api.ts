import { api, API_URL } from '../api/client';
import type { OAuthProvider, Tokens, User } from '../api/types';
import { getRefreshToken } from './token-store';

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function register(input: RegisterInput): Promise<Tokens> {
  const { data } = await api.post<Tokens>('/auth/register', input);
  return data;
}

export async function login(input: LoginInput): Promise<Tokens> {
  const { data } = await api.post<Tokens>('/auth/login', input);
  return data;
}

/**
 * La déconnexion révoque le refresh token côté serveur. Son échec n'empêche
 * pas de vider la session locale : l'utilisateur a demandé à sortir.
 */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken === null) {
    return;
  }
  await api.post('/auth/logout', { refreshToken });
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}

/**
 * Départ du flux OAuth2 : une navigation du navigateur, pas un appel XHR — le
 * fournisseur doit afficher sa propre page de consentement.
 */
export function oauthAuthorizeUrl(provider: OAuthProvider): string {
  return API_URL + '/auth/oauth/' + provider;
}
