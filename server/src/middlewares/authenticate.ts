import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../common/tokens';
import { AppError } from '../common/app-error';

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User extends AuthUser {}
  }
}

/** Vérifie le JWT Bearer et attache `req.user`. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  if (!req.headers.authorization?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Token manquant');
  }
  attachUser(req);
  next();
}

/**
 * Variante des routes ouvertes aux visiteurs : sans en-tête, la requête passe
 * anonymement et `req.user` reste indéfini ; avec en-tête, le token est vérifié.
 */
export function authenticateOptional(req: Request, _res: Response, next: NextFunction): void {
  if (req.headers.authorization) {
    attachUser(req);
  }
  next();
}

function attachUser(req: Request): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Token manquant');
  }
  try {
    req.user = verifyAccessToken(header.slice(7));
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Token invalide ou expiré');
  }
}
