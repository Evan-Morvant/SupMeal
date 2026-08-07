import { NextFunction, Request, Response } from 'express';
import { ZodType, ZodTypeDef } from 'zod';

/**
 * Les schémas qui appliquent une valeur par défaut ou une transformation ont
 * un type d'entrée différent de leur type de sortie : la signature les
 * distingue, sinon `z.coerce`, `.default()` et `.transform()` seraient refusés.
 */
type Schema<TOut, TIn> = ZodType<TOut, ZodTypeDef, TIn>;

/**
 * Valide et type le corps de la requête via un schéma Zod.
 * En cas d'échec, `ZodError` est capturée par `errorHandler` → 400.
 */
export const validateBody =
  <TOut, TIn>(schema: Schema<TOut, TIn>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };

/**
 * Même principe pour la chaîne de requête, où tout arrive en texte : le schéma
 * se charge des conversions (`z.coerce`) et des valeurs par défaut.
 */
export const validateQuery =
  <TOut, TIn>(schema: Schema<TOut, TIn>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    req.query = schema.parse(req.query) as Request['query'];
    next();
  };
