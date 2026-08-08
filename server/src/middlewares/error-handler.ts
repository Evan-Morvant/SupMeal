import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../common/app-error';

/** 404 pour toute route non déclarée. */
export function notFoundHandler(_req: Request, res: Response): void {
  res
    .status(404)
    .json({ error: { code: 'NOT_FOUND', message: 'Ressource introuvable', details: [] } });
}

/**
 * Erreur au format `http-errors`, tel qu'en produisent les middlewares
 * d'Express. `expose` distingue les erreurs client, dont le message peut être
 * renvoyé tel quel, des erreurs serveur qu'il ne faut pas divulguer.
 */
function isHttpError(err: unknown): err is { status: number; message: string } {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const candidate = err as { status?: unknown; expose?: unknown };
  return (
    typeof candidate.status === 'number' &&
    candidate.status >= 400 &&
    candidate.status < 500 &&
    candidate.expose === true
  );
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
  // Erreurs levées par Express lui-même (corps JSON malformé, en-tête trop
  // long...). Elles portent un statut : le relayer évite de rendre un 500
  // pour ce qui est en réalité une requête invalide.
  if (isHttpError(err)) {
    res.status(err.status).json({
      error: { code: 'BAD_REQUEST', message: err.message, details: [] },
    });
    return;
  }
  console.error(err);
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur interne', details: [] } });
}
