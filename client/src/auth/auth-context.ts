import { createContext, useContext } from 'react';
import type { User } from '../api/types';
import type { LoginInput, RegisterInput } from './auth.api';

/**
 * `loading` couvre la réhydratation au démarrage : tant qu'elle dure, on ne
 * sait pas encore si la session est valide, et rediriger vers la connexion
 * ferait clignoter l'écran à chaque rechargement.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Adopte les jetons reçus autrement que par un formulaire (retour OAuth2). */
  adoptSession: (tokens: { accessToken: string; refreshToken: string }) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return value;
}
