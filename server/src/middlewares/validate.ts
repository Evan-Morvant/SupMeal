import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

/**
 * Valide et type le corps de la requête via un schéma Zod.
 * En cas d'échec, `ZodError` est capturée par `errorHandler` → 400.
 */
export const validateBody =
  <T>(schema: ZodSchema<T>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
