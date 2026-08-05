import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
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
    req.user = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as AuthUser;
    next();
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Token invalide ou expiré');
  }
}
