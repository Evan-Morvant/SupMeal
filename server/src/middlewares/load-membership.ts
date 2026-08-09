import { NextFunction, Request, Response } from 'express';
import { CookbookMembership } from '../models';
import { AppError } from '../common/app-error';

/**
 * Charge l'appartenance de l'utilisateur au cookbook ciblé par l'URL et
 * renseigne `req.membership`, sur quoi s'appuie `requireRole`.
 *
 * Un non-membre reçoit 404 et non 403 : répondre « interdit » confirmerait
 * l'existence du cookbook à quelqu'un qui n'a pas à en connaître l'existence.
 * Un cookbook réellement absent produit la même réponse, ce qui rend les deux
 * cas indiscernables de l'extérieur.
 *
 * @param param nom du paramètre d'URL portant l'identifiant du cookbook.
 */
export function loadMembership(param = 'id') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const cookbookId = req.params[param];
    const membership = await CookbookMembership.findOne({
      where: { cookbookId, userId: req.user!.id },
    });

    if (!membership) {
      throw new AppError(404, 'COOKBOOK_NOT_FOUND', 'Cookbook introuvable');
    }
    req.membership = { cookbookId, role: membership.role };
    next();
  };
}
