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

/**
 * Même principe pour la chaîne de requête, où tout arrive en texte : le schéma
 * se charge des conversions (`z.coerce`) et des valeurs par défaut.
 */
export const validateQuery =
  <T>(schema: ZodSchema<T>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    req.query = schema.parse(req.query) as Request['query'];
    next();
  };
