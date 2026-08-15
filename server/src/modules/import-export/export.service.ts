import { Op } from 'sequelize';
import { Cookbook, CookbookMembership, CookbookRecipe, Recipe } from '../../models';
import { listAccessibleRecipesInFull } from '../recipes/recipes.service';
import type { CookbookView, ExportPayload, RecipeView } from './import-export.types';

/**
 * Collecte du contenu exportable d'un utilisateur : ses recettes et ses
 * cookbooks. Les données de la personne relèvent de `/users/me/data`.
 *
 * Le périmètre est celui de la lecture : ses propres recettes et celles des
 * cookbooks dont il est membre, exactement ce que `/recipes` lui montre. Un
 * export plus étroit ne sauvegarderait pas ce qu'il voit ; un export plus large
 * lui livrerait des recettes qu'il n'a pas le droit de consulter.
 *
 * La visibilité n'est volontairement pas exportée : une recette réimportée
 * repart privée, pour qu'un aller-retour de fichier ne puisse jamais publier
 * quelque chose par accident.
 */

/** Passage du modèle à la représentation neutre partagée avec l'import. */
export function toRecipeView(recipe: Recipe): RecipeView {
  return {
    title: recipe.title,
    description: recipe.description,
    prepTimeMin: recipe.prepTimeMin,
    cookTimeMin: recipe.cookTimeMin,
    servings: recipe.servings,
    source: recipe.source,
    tags: (recipe.tags ?? []).map((tag) => tag.name),
    ingredients: (recipe.ingredients ?? []).map((line) => ({
      name: line.ingredient?.name ?? '',
      // `numeric` PostgreSQL revient en chaîne pour préserver sa précision.
      quantity: line.quantity === null ? null : Number(line.quantity),
      unit: line.unit,
      note: line.note,
    })),
    steps: (recipe.steps ?? []).map((step) => step.instruction),
  };
}

/**
 * Cookbooks de l'utilisateur et composition de chacun. Les recettes y sont
 * désignées par leur titre : un identifiant technique ne survivrait pas à un
 * import dans une autre instance, et cette section vaut surtout comme mémoire
 * de l'organisation des recettes.
 */
async function listCookbookViews(
  userId: string,
  titlesById: Map<string, string>,
): Promise<CookbookView[]> {
  const memberships = await CookbookMembership.findAll({
    where: { userId },
    include: [{ model: Cookbook, as: 'cookbook' }],
  });

  const cookbooks = memberships
    .map((membership) => membership.cookbook)
    .filter((cookbook): cookbook is Cookbook => cookbook !== undefined && cookbook !== null);
  if (cookbooks.length === 0) {
    return [];
  }

  // Une seule requête pour toutes les liaisons, plutôt qu'une par cookbook.
  const links = await CookbookRecipe.findAll({
    where: { cookbookId: { [Op.in]: cookbooks.map((cookbook) => cookbook.id) } },
  });

  const titlesByCookbook = new Map<string, string[]>();
  links.forEach((link) => {
    const title = titlesById.get(link.recipeId);
    if (title === undefined) {
      return;
    }
    const titles = titlesByCookbook.get(link.cookbookId) ?? [];
    titles.push(title);
    titlesByCookbook.set(link.cookbookId, titles);
  });

  return cookbooks.map((cookbook) => ({
    name: cookbook.name,
    description: cookbook.description,
    recipeTitles: titlesByCookbook.get(cookbook.id) ?? [],
  }));
}

/** Export de tout ce que l'utilisateur peut lire : ses recettes et ses cookbooks. */
export async function buildExportPayload(userId: string): Promise<ExportPayload> {
  const recipes = await listAccessibleRecipesInFull(userId);
  const titlesById = new Map(recipes.map((recipe) => [recipe.id, recipe.title]));

  return {
    exportedAt: new Date().toISOString(),
    recipes: recipes.map(toRecipeView),
    cookbooks: await listCookbookViews(userId, titlesById),
  };
}

/**
 * Export d'un cookbook : les recettes qu'il contient et sa composition. Le
 * périmètre d'accès continue de s'appliquer aux recettes, un membre n'exporte
 * que ce qu'il pourrait déjà lire.
 */
export async function buildCookbookExportPayload(
  userId: string,
  cookbook: Cookbook,
): Promise<ExportPayload> {
  const recipes = await listAccessibleRecipesInFull(userId, cookbook.id);

  return {
    exportedAt: new Date().toISOString(),
    recipes: recipes.map(toRecipeView),
    cookbooks: [
      {
        name: cookbook.name,
        description: cookbook.description,
        recipeTitles: recipes.map((recipe) => recipe.title),
      },
    ],
  };
}

/**
 * Export d'une seule recette, pour la partager sans livrer tout son livre.
 *
 * L'enveloppe est celle de l'export complet, réduite à une recette : le
 * fichier obtenu se réimporte par le même chemin, sans traitement à part, et
 * les trois formats le produisent aussi bien.
 */
export function buildRecipeExportPayload(recipe: Recipe): ExportPayload {
  return {
    exportedAt: new Date().toISOString(),
    recipes: [toRecipeView(recipe)],
    cookbooks: [],
  };
}
