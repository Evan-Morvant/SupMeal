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
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Token manquant');
  }
  try {
    req.user = verifyAccessToken(header.slice(7));
    next();
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Token invalide ou expiré');
  }
}
