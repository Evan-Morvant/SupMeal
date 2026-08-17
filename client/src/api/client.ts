import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../auth/token-store';
import { ApiError, toApiError } from './errors';
import type { Tokens } from './types';

/** En Docker, Nginx sert le front et l'API sous la même origine : `/api/v1`. */
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * Origine de l'API sans son préfixe de version : Socket.io écoute à la racine,
 * pas sous `/api/v1`.
 */
export const API_ORIGIN: string = (() => {
  const root = API_URL.replace(/\/api\/v1\/?$/, '');
  return root === '' || root.startsWith('/') ? window.location.origin : root;
})();

/**
 * L'API attend les listes en virgules (`tags=a,b`), là où axios écrirait
 * `tags[]=a&tags[]=b`. Les valeurs vides sont écartées pour qu'un filtre
 * effacé disparaisse de l'URL.
 */
function serializeParams(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) {
        search.set(key, value.join(','));
      }
      return;
    }
    search.set(key, String(value));
  });
  return search.toString();
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  paramsSerializer: serializeParams,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token !== null) {
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});

/**
 * Routes dont un 401 est une réponse, pas une session expirée : tenter de
 * rafraîchir après un mot de passe refusé bouclerait sans jamais aboutir.
 */
const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

interface RetriedConfig extends InternalAxiosRequestConfig {
  retried?: boolean;
}

let pendingRefresh: Promise<Tokens> | null = null;

async function requestRefresh(): Promise<Tokens> {
  const refreshToken = getRefreshToken();
  if (refreshToken === null) {
    throw new ApiError(401, 'NO_SESSION', 'Session expirée. Reconnectez-vous.');
  }
  try {
    // Instance nue : passer par `api` relancerait ses propres intercepteurs.
    const response = await axios.post<Tokens>(API_URL + '/auth/refresh', { refreshToken });
    setTokens(response.data);
    return response.data;
  } catch (error) {
    // Le refresh token est mort ou révoqué : la session ne se rattrape plus.
    clearTokens();
    throw toApiError(error);
  }
}

/**
 * Rafraîchissement en vol unique : six requêtes en 401 simultané déclencheraient
 * sinon six rotations, dont cinq rejetées par la révocation de la première.
 */
export function refreshSession(): Promise<Tokens> {
  if (pendingRefresh === null) {
    pendingRefresh = requestRefresh().finally(() => {
      pendingRefresh = null;
    });
  }
  return pendingRefresh;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriedConfig | undefined;
    const url = config?.url ?? '';
    if (
      error.response?.status !== 401 ||
      config === undefined ||
      config.retried === true ||
      NO_REFRESH.some((route) => url.startsWith(route))
    ) {
      return Promise.reject(error);
    }

    config.retried = true;
    try {
      const tokens = await refreshSession();
      config.headers.Authorization = 'Bearer ' + tokens.accessToken;
      return await api(config);
    } catch {
      // On remonte le 401 d'origine : c'est lui qui décrit l'appel qui a échoué.
      return Promise.reject(error);
    }
  },
);
