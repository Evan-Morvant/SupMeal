/**
 * Erreur applicative typée, transformée par `errorHandler` en réponse JSON
 * au format uniforme : { error: { code, message, details } }.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = 'AppError';
  }
}
