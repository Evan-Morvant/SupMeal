import { NextFunction, Request, Response } from 'express';
import { AppError } from '../common/app-error';

/** Hiérarchie des rôles d'un membre de cookbook (cf. conception). */
export const ROLE_LEVEL = {
  READER: 1,
  COMMENTER: 2,
  EDITOR: 3,
  OWNER: 4,
} as const;

export type Role = keyof typeof ROLE_LEVEL;

/**
 * Garde d'autorisation : exige un rôle >= `min` sur le cookbook ciblé.
 * Suppose qu'un middleware `loadMembership` a renseigné `req.membership`.
 */
export function requireRole(min: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.membership?.role;
    if (!role || ROLE_LEVEL[role] < ROLE_LEVEL[min]) {
      throw new AppError(403, 'FORBIDDEN', 'Rôle insuffisant');
    }
    next();
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      membership?: { cookbookId: string; role: Role };
    }
  }
}
