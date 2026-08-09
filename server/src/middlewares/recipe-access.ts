import { NextFunction, Request, Response } from 'express';
import { AppError } from '../common/app-error';
import { findAccessibleRecipeOrFail, findRecipeOrFail } from '../modules/recipes/recipes.service';
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
 * Consultation : le créateur, un membre d'un cookbook contenant la recette,
 * ou n'importe qui si elle est publique. Le périmètre est celui qui filtre la
 * liste — sans quoi une recette pourrait apparaître dans les résultats sans
 * pouvoir être ouverte.
 */
export async function requireRecipeAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  req.recipe = await findAccessibleRecipeOrFail(req.params.id, req.user!.id);
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
