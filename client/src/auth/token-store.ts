import type { Tokens } from '../api/types';

/*
 * L'access token (15 min) vit en mémoire : il ne traîne pas sur le disque à la
 * portée d'un script injecté. Le refresh token (7 jours) va dans localStorage,
 * sinon fermer l'onglet déconnecterait.
 */

const REFRESH_KEY = 'supmeal.refreshToken';

let accessToken: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    // Navigation privée ou stockage refusé : on dégrade en session volatile.
    return null;
  }
}

export function setTokens(tokens: Tokens): void {
  accessToken = tokens.accessToken;
  try {
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  } catch {
    /* ignoré : la session reste valide le temps de l'onglet */
  }
  notify();
}

export function clearTokens(): void {
  accessToken = null;
  try {
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

/** Prévient d'un changement de session, y compris celui déclenché par un 401. */
export function subscribeTokens(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
