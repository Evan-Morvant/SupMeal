import { ReactNode, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { refreshSession } from '../api/client';
import { keys } from '../api/query-keys';
import type { Tokens } from '../api/types';
import * as authApi from './auth.api';
import { AuthContext, AuthContextValue, AuthStatus } from './auth-context';
import { clearTokens, getRefreshToken, setTokens, subscribeTokens } from './token-store';

/** Suit la présence d'un refresh token, y compris quand un 401 l'a effacé. */
function useHasSession(): boolean {
  return useSyncExternalStore(
    subscribeTokens,
    () => getRefreshToken() !== null,
    () => false,
  );
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = useQueryClient();
  const hasSession = useHasSession();
  const [rehydrated, setRehydrated] = useState(false);

  /*
   * L'access token ne survit pas au rechargement : on l'obtient à nouveau
   * depuis le refresh token avant de laisser le premier écran s'afficher.
   */
  useEffect(() => {
    let cancelled = false;
    const finish = (): void => {
      if (!cancelled) {
        setRehydrated(true);
      }
    };
    if (getRefreshToken() === null) {
      finish();
    } else {
      refreshSession()
        .catch(() => undefined)
        .finally(finish);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const meQuery = useQuery({
    queryKey: keys.me,
    queryFn: authApi.fetchMe,
    enabled: rehydrated && hasSession,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const adoptSession = useCallback(
    async (tokens: Tokens): Promise<void> => {
      setTokens(tokens);
      await queryClient.fetchQuery({ queryKey: keys.me, queryFn: authApi.fetchMe });
    },
    [queryClient],
  );

  const login = useCallback(
    async (input: authApi.LoginInput): Promise<void> => {
      await adoptSession(await authApi.login(input));
    },
    [adoptSession],
  );

  const register = useCallback(
    async (input: authApi.RegisterInput): Promise<void> => {
      await adoptSession(await authApi.register(input));
    },
    [adoptSession],
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      // Le cache porte les données du compte sortant : le vider est la sortie.
      clearTokens();
      queryClient.clear();
    }
  }, [queryClient]);

  const status: AuthStatus = useMemo(() => {
    if (!rehydrated) {
      return 'loading';
    }
    if (!hasSession) {
      return 'anonymous';
    }
    if (meQuery.data !== undefined) {
      return 'authenticated';
    }
    return meQuery.isError ? 'anonymous' : 'loading';
  }, [hasSession, meQuery.data, meQuery.isError, rehydrated]);

  const value: AuthContextValue = useMemo(
    () => ({
      status,
      user: meQuery.data ?? null,
      login,
      register,
      logout,
      adoptSession,
    }),
    [adoptSession, login, logout, meQuery.data, register, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
