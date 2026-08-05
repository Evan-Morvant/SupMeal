import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Enrobe un handler asynchrone pour transmettre les rejets de promesse à
 * `next()`.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
