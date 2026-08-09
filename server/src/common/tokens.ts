import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessTokenUser {
  id: string;
  email: string;
}

/** Access token court (JWT signé avec le secret d'accès). */
export function signAccessToken(user: AccessTokenUser): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
  };
  return jwt.sign({ id: user.id, email: user.email }, env.JWT_ACCESS_SECRET, options);
}

/**
 * Vérifie la signature et l'expiration d'un access token. Lève si invalide.
 * Partagé par le middleware HTTP et par le handshake WebSocket, pour que les
 * deux portes d'entrée reconnaissent exactement les mêmes jetons.
 */
export function verifyAccessToken(token: string): AccessTokenUser {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenUser;
}

export interface SignedRefreshToken {
  token: string;
  hash: string;
  expiresAt: Date;
}

/** Refresh token long (JWT signé avec le secret de refresh, identifiant unique). */
export function signRefreshToken(user: { id: string }): SignedRefreshToken {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_TTL as SignOptions['expiresIn'],
    jwtid: crypto.randomUUID(),
  };
  const token = jwt.sign({ id: user.id }, env.JWT_REFRESH_SECRET, options);
  const decoded = jwt.decode(token) as { exp: number };
  return { token, hash: hashToken(token), expiresAt: new Date(decoded.exp * 1000) };
}

/** Vérifie la signature et l'expiration d'un refresh token. Lève si invalide. */
export function verifyRefreshToken(token: string): { id: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string };
}

/**
 * Empreinte HMAC d'un token, stockée en base à la place du token en clair.
 * Déterministe (donc recherchable via index) mais inexploitable sans le secret.
 */
export function hashToken(token: string): string {
  return crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
}

export interface OAuthState {
  /** Utilisateur auquel rattacher le compte, en flux de liaison depuis les paramètres. */
  linkUserId?: string;
}

/**
 * Paramètre `state` OAuth (anti-CSRF) : JWT court et signé, lié au provider.
 * Stateless (aucune session serveur nécessaire). Porte aussi l'utilisateur à
 * qui lier le compte lorsque le flux part des paramètres du profil.
 */
export function signOAuthState(provider: string, linkUserId?: string): string {
  return jwt.sign({ provider, linkUserId }, env.JWT_ACCESS_SECRET, { expiresIn: '10m' });
}

/** Vérifie le `state` reçu au callback et qu'il correspond bien au provider. */
export function verifyOAuthState(state: string, provider: string): OAuthState {
  const decoded = jwt.verify(state, env.JWT_ACCESS_SECRET) as {
    provider?: string;
    linkUserId?: string;
  };
  if (decoded.provider !== provider) {
    throw new Error('OAuth state provider mismatch');
  }
  return { linkUserId: decoded.linkUserId };
}
