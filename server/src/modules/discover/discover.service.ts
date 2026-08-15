import { Recipe } from '../../models';
import { AppError } from '../../common/app-error';
import { findRecipeOrFail, searchPublicRecipes, withFavorites } from '../recipes/recipes.service';
import type { RecipePageWithFavorites } from '../recipes/recipes.service';
import type { DiscoverRecipesQuery } from '../recipes/recipes.schemas';

/**
 * Découverte : le fonds public, ouvert aux visiteurs. Un utilisateur connecté
 * y retrouve en prime ses favoris.
 */
export async function discoverRecipes(
  query: DiscoverRecipesQuery,
  userId?: string,
): Promise<RecipePageWithFavorites> {
  return withFavorites(await searchPublicRecipes(query), userId);
}

/**
 * Détail public. Une recette privée répond 404 comme une recette inexistante :
 * la route étant anonyme et adressable par n'importe quel identifiant, un 403
 * confirmerait son existence à qui la cherche.
 */
export async function findPublicRecipeOrFail(recipeId: string): Promise<Recipe> {
  const recipe = await findRecipeOrFail(recipeId);
  if (recipe.visibility !== 'public') {
    throw new AppError(404, 'RECIPE_NOT_FOUND', 'Recette introuvable');
  }
  return recipe;
}
