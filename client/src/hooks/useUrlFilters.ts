import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/*
 * Les critères vivent dans la chaîne de requête : une recherche se partage par
 * son adresse et le retour arrière défait un filtre. Chaque écran lit les
 * siens — ils n'acceptent pas les mêmes — mais l'écriture est commune.
 */

export const PAGE_SIZE = 12;

export function readList(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') {
    return [];
  }
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function readPositive(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** Valeur d'URL restreinte à un ensemble connu : le reste est ignoré. */
export function readEnum<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const raw = params.get(key);
  return allowed.includes(raw as T) ? (raw as T) : undefined;
}

export function readPage(params: URLSearchParams): number {
  return Math.max(1, Number(params.get('page') ?? 1) || 1);
}

export interface UrlFilterControls<TPatch> {
  params: URLSearchParams;
  /** Applique des critères. Toucher un critère ramène à la première page. */
  patch: (values: TPatch, options?: { replace?: boolean }) => void;
  goToPage: (page: number) => void;
  clear: () => void;
}

export function useUrlFilters<TPatch extends object>(): UrlFilterControls<TPatch> {
  const [params, setParams] = useSearchParams();

  const write = useCallback(
    (values: object, keepPage: boolean, replace: boolean) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          Object.entries(values).forEach(([key, value]) => {
            const empty =
              value === undefined ||
              value === null ||
              value === false ||
              value === '' ||
              (Array.isArray(value) && value.length === 0);
            if (empty) {
              next.delete(key);
              return;
            }
            next.set(key, Array.isArray(value) ? value.join(',') : String(value));
          });
          if (!keepPage) {
            // Rester en page 4 après avoir resserré les critères afficherait un
            // vide alors qu'il y a des résultats.
            next.delete('page');
          }
          return next;
        },
        { replace },
      );
    },
    [setParams],
  );

  const patch = useCallback<UrlFilterControls<TPatch>['patch']>(
    (values, options) => write(values, false, options?.replace === true),
    [write],
  );

  const goToPage = useCallback(
    (page: number) => write({ page: page <= 1 ? undefined : page }, true, false),
    [write],
  );

  const clear = useCallback(() => setParams(new URLSearchParams()), [setParams]);

  return { params, patch, goToPage, clear };
}
