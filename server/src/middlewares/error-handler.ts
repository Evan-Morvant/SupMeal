import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../common/app-error';

/** 404 pour toute route non déclarée. */
export function notFoundHandler(_req: Request, res: Response): void {
  res
    .status(404)
    .json({ error: { code: 'NOT_FOUND', message: 'Ressource introuvable', details: [] } });
}

/** Gestionnaire d'erreurs centralisé (format de réponse uniforme). */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res
      .status(err.statusCode)
      .json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Données invalides', details: err.issues },
    });
    return;
  }
  console.error(err);
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur interne', details: [] } });
}
