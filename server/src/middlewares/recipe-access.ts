import { NextFunction, Request, Response } from 'express';
import { AppError } from '../common/app-error';
import { findRecipeOrFail } from '../modules/recipes/recipes.service';
import type { Recipe } from '../models';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Recette chargée par les gardes ci-dessous, réutilisée par le contrôleur. */
      recipe?: Recipe;
    }
  }
}

/**
 * Consultation : le créateur, ou n'importe qui si la recette est publique.
 * L'accès par appartenance à un cookbook s'ajoutera ici avec ce module.
 */
export async function requireRecipeAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const recipe = await findRecipeOrFail(req.params.id);
  const isOwner = recipe.ownerId === req.user?.id;
  if (!isOwner && recipe.visibility !== 'public') {
    throw new AppError(403, 'FORBIDDEN', 'Accès refusé à cette recette');
  }
  req.recipe = recipe;
  next();
}

/** Écriture et suppression : réservées au créateur de la recette. */
export async function requireRecipeOwner(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const recipe = await findRecipeOrFail(req.params.id);
  if (recipe.ownerId !== req.user?.id) {
    throw new AppError(403, 'FORBIDDEN', 'Seul le créateur peut modifier cette recette');
  }
  req.recipe = recipe;
  next();
}
