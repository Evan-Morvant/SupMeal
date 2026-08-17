import axios from 'axios';

/*
 * L'API rend toujours la même enveloppe : { error: { code, message, details } }.
 * On la traduit une fois ici, pour que chaque écran affiche une erreur sans
 * refaire la même inspection de `err.response?.data?.error?.message`.
 */

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown[] };
}

/** Champ invalide remonté par la validation Zod du serveur. */
export interface FieldIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** La session est perdue : l'appelant doit renvoyer vers la connexion. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /**
   * Chemins invalides signalés par Zod, prêts à être posés sur les champs d'un
   * formulaire. Le premier segment est sauté : c'est 'body', 'query' ou
   * 'params', qui ne désigne rien pour l'utilisateur.
   */
  get fieldIssues(): FieldIssue[] {
    if (this.code !== 'VALIDATION_ERROR') {
      return [];
    }
    return this.details.flatMap((detail) => {
      const issue = detail as { path?: unknown[]; message?: string };
      if (!Array.isArray(issue.path) || typeof issue.message !== 'string') {
        return [];
      }
      const path = issue.path.slice(1).join('.') || issue.path.join('.');
      return [{ path, message: issue.message }];
    });
  }
}

/** Messages des situations où celui du serveur ne suffit pas à l'utilisateur. */
const FALLBACKS: Record<string, string> = {
  NETWORK: 'Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.',
  TIMEOUT: 'La demande a mis trop de temps. Réessayez dans un instant.',
  INTERNAL_ERROR: 'Le serveur a rencontré une erreur. Réessayez dans un instant.',
};

/** Ramène n'importe quelle exception à une ApiError exploitable. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      const code = error.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK';
      return new ApiError(0, code, FALLBACKS[code]);
    }
    const body = error.response.data as ApiErrorBody | undefined;
    const code = body?.error?.code ?? 'UNKNOWN';
    const message = body?.error?.message ?? FALLBACKS[code] ?? 'Une erreur est survenue.';
    return new ApiError(error.response.status, code, message, body?.error?.details ?? []);
  }
  const message = error instanceof Error ? error.message : 'Une erreur est survenue.';
  return new ApiError(0, 'UNKNOWN', message);
}

/**
 * Message affichable. Deux cas seulement méritent d'écraser celui du serveur :
 * le 429, dont le message brut ne dit pas quoi faire, et le 500, qu'on ne
 * détaille pas à l'utilisateur.
 */
export function errorMessage(error: unknown): string {
  const apiError = toApiError(error);
  if (apiError.status === 429) {
    return 'Trop de tentatives. Patientez une minute avant de réessayer.';
  }
  if (apiError.status >= 500) {
    return FALLBACKS.INTERNAL_ERROR;
  }
  return apiError.message;
}
