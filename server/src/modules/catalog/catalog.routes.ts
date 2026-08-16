import { Router } from 'express';
import { authenticate, authenticateOptional } from '../../middlewares/authenticate';
import { validateQuery } from '../../middlewares/validate';
import { asyncHandler } from '../../common/async-handler';
import * as catalogController from './catalog.controller';
import { listIngredientsSchema, listTagsSchema } from './catalog.schemas';

/**
 * Catalogue en lecture seule. Deux routeurs plutôt qu'un : les deux ressources
 * vivent à la racine de l'API et n'ont aucun segment d'URL commun, seule leur
 * nature — un vocabulaire partagé, alimenté par l'usage — les rassemble dans ce
 * module.
 *
 * Les ingrédients restent fermés à l'anonyme : c'est le vocabulaire de
 * l'application, pas une page publique, et la découverte n'expose pas de filtre
 * par ingrédient. Les tags s'ouvrent au visiteur, réduits à ceux que porte au
 * moins une recette publique, pour alimenter les filtres de la découverte.
 */

export const ingredientsRouter = Router();

ingredientsRouter.get(
  '/',
  authenticate,
  validateQuery(listIngredientsSchema),
  asyncHandler(catalogController.listIngredients),
);

export const tagsRouter = Router();

tagsRouter.get(
  '/',
  authenticateOptional,
  validateQuery(listTagsSchema),
  asyncHandler(catalogController.listTags),
);
