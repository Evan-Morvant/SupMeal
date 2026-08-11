import { Op, QueryTypes } from 'sequelize';
import { Recipe, Tag, sequelize } from '../../models';
import { accessibleRecipesCondition } from '../recipes/recipes.filters';
import { getPreferences } from '../users/users.service';
import { rankSuggestions, type CandidateRecipe, type SuggestionProfile } from './scoring';
import { notAlreadyPlanned, notFavorite, withoutAllergens } from './suggestions.filters';
import type { ListSuggestionsQuery } from './suggestions.schemas';

/**
 * Suggestions de recettes.
 *
 * Le vivier est celui que l'utilisateur a le droit de lire — ses recettes et
 * celles de ses cookbooks. On ne suggère jamais ce qui n'est pas accessible :
 * une suggestion qui mène à un 403 serait pire que pas de suggestion.
 *
 * Deux temps : SQL écarte ce qui ne doit pas être proposé, puis le classement
 * ordonne ce qui reste. Les exclusions descendent en base parce qu'elles
 * portent sur des tables volumineuses ; le score se calcule en mémoire, sur un
 * vivier déjà réduit, où il reste lisible.
 */

/** Poids des sources d'affinité : ce qu'on distingue pèse plus que ce qu'on prévoit. */
const FAVORITE_WEIGHT = 2;
const PLANNED_WEIGHT = 1;

interface TagAffinityRow {
  tag_id: string;
  weight: string;
}

/**
 * Poids par tag, tiré de ce que l'utilisateur cuisine déjà : ses favoris et
 * les recettes passées par son planning.
 *
 * Une seule requête agrégée plutôt que le chargement des recettes concernées :
 * seuls les totaux par tag nous intéressent, les recettes elles-mêmes n'ont
 * aucune raison de traverser le réseau.
 */
async function loadAffinity(userId: string): Promise<Map<string, number>> {
  const rows = await sequelize.query<TagAffinityRow>(
    `SELECT tag_id, SUM(weight) AS weight FROM (
       SELECT rt.tag_id, :favoriteWeight AS weight
       FROM favorites f
       JOIN recipe_tags rt ON rt.recipe_id = f.recipe_id
       WHERE f.user_id = :userId
       UNION ALL
       SELECT rt.tag_id, :plannedWeight AS weight
       FROM meal_plan_entries m
       JOIN recipe_tags rt ON rt.recipe_id = m.recipe_id
       WHERE m.user_id = :userId
     ) sources
     GROUP BY tag_id`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        userId,
        favoriteWeight: FAVORITE_WEIGHT,
        plannedWeight: PLANNED_WEIGHT,
      },
    },
  );

  return new Map(rows.map((row) => [row.tag_id, Number(row.weight)]));
}

/**
 * Vivier : les recettes accessibles, débarrassées de ce qui ne doit pas être
 * proposé. Rendues du plus récent au plus ancien, ce qui donne au classement
 * un ordre de repli utile quand aucun signal ne départage.
 */
function findCandidates(userId: string, allergies: string[]): Promise<Recipe[]> {
  return Recipe.findAll({
    where: {
      [Op.and]: [
        accessibleRecipesCondition(userId),
        withoutAllergens(allergies),
        notFavorite(userId),
        notAlreadyPlanned(userId),
      ],
    },
    include: [{ model: Tag, as: 'tags', through: { attributes: [] } }],
    order: [['createdAt', 'DESC']],
  });
}

function toCandidate(recipe: Recipe): CandidateRecipe {
  return {
    id: recipe.id,
    title: recipe.title,
    tags: (recipe.tags ?? []).map((tag) => ({ id: tag.id, name: tag.name })),
  };
}

/** Une suggestion : la recette, son score et les motifs qui l'ont fait remonter. */
export interface Suggestion {
  recipe: Recipe;
  score: number;
  reasons: string[];
}

export async function suggestRecipes(
  userId: string,
  query: ListSuggestionsQuery,
): Promise<Suggestion[]> {
  const preferences = await getPreferences(userId);
  const candidates = await findCandidates(userId, preferences.allergies);
  if (candidates.length === 0) {
    return [];
  }

  const profile: SuggestionProfile = {
    diets: preferences.diets,
    preferredCuisines: preferences.preferredCuisines,
    affinity: await loadAffinity(userId),
  };

  const byId = new Map(candidates.map((recipe) => [recipe.id, recipe]));
  return rankSuggestions(candidates.map(toCandidate), profile, query.limit).map((scored) => ({
    recipe: byId.get(scored.id)!,
    score: scored.score,
    reasons: scored.reasons,
  }));
}
