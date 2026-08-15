import { NextFunction, Request, Response } from 'express';
import { AppError } from '../common/app-error';
import {
  findAccessibleRecipeOrFail,
  findRecipeOrFail,
  isRecipeEditable,
} from '../modules/recipes/recipes.service';
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
 * pouvoir être ouverte. `req.user` est facultatif : derrière
 * `authenticateOptional`, la même garde sert les routes ouvertes aux visiteurs.
 */
export async function requireRecipeAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  req.recipe = await findAccessibleRecipeOrFail(req.params.id, req.user?.id);
  next();
}

/**
 * Suppression, image, bascule en public : réservées au créateur. Ces actions
 * engagent la recette elle-même, pas seulement son contenu.
 */
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

/**
 * Modification du contenu : le créateur, ou un Éditeur+ d'un cookbook où la
 * recette est rangée. Partager une recette dans un groupe, c'est accepter que
 * le groupe la corrige.
 */
export async function requireRecipeEditor(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const recipe = await findRecipeOrFail(req.params.id);
  const allowed =
    recipe.ownerId === req.user!.id || (await isRecipeEditable(recipe.id, req.user!.id));

  if (!allowed) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Modification réservée au créateur ou à un éditeur du cookbook',
    );
  }
  req.recipe = recipe;
  next();
}
