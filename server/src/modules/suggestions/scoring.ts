/**
 * Classement des suggestions de recettes.
 *
 * Le score n'a rien d'un modèle statistique, c'est une somme de signaux
 * nommés, et chaque suggestion sort accompagnée des raisons qui l'ont fait
 * remonter. Une recommandation qu'on ne sait pas expliquer n'a pas sa place
 * dans une application de cuisine : l'utilisateur doit pouvoir juger si le
 * motif le concerne.
 */

/** Un régime satisfait pèse plus qu'une cuisine appréciée : c'est une contrainte, pas un goût. */
const DIET_WEIGHT = 3;

/** Une cuisine préférée, déclarée explicitement dans le profil. */
const CUISINE_WEIGHT = 2;

/**
 * Plafond de l'affinité apportée par un même tag. Sans lui, un tag présent
 * cent fois dans l'historique écraserait tous les autres signaux et le
 * classement se figerait sur une seule catégorie.
 */
const AFFINITY_CAP = 3;

/** Profil sur lequel s'appuie le classement. */
export interface SuggestionProfile {
  diets: string[];
  preferredCuisines: string[];
  /**
   * Poids par identifiant de tag, tiré de ce que l'utilisateur cuisine déjà :
   * ses favoris comptent double de ce qu'il a seulement planifié.
   */
  affinity: Map<string, number>;
}

export interface CandidateTag {
  id: string;
  name: string;
}

export interface CandidateRecipe {
  id: string;
  title: string;
  tags: CandidateTag[];
}

export interface ScoredRecipe {
  id: string;
  score: number;
  reasons: string[];
}

/** Comparaison de libellés saisis à la main : casse et espaces indifférents. */
function sameLabel(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function matches(labels: string[], tagName: string): boolean {
  return labels.some((label) => sameLabel(label, tagName));
}

/**
 * Score d'une recette et motifs qui l'accompagnent. Trois signaux, cumulables :
 * le régime déclaré, les cuisines préférées, et la proximité avec ce que
 * l'utilisateur cuisine déjà.
 */
export function scoreRecipe(recipe: CandidateRecipe, profile: SuggestionProfile): ScoredRecipe {
  let score = 0;
  const reasons: string[] = [];

  for (const tag of recipe.tags) {
    if (matches(profile.diets, tag.name)) {
      score += DIET_WEIGHT;
      reasons.push('correspond à votre régime : ' + tag.name);
      continue;
    }
    if (matches(profile.preferredCuisines, tag.name)) {
      score += CUISINE_WEIGHT;
      reasons.push('cuisine que vous appréciez : ' + tag.name);
      continue;
    }

    const affinity = profile.affinity.get(tag.id);
    if (affinity !== undefined && affinity > 0) {
      score += Math.min(affinity, AFFINITY_CAP);
      reasons.push('proche de ce que vous cuisinez : ' + tag.name);
    }
  }

  return { id: recipe.id, score, reasons };
}

/**
 * Classement décroissant. À score égal, l'ordre des candidats fait foi : la
 * requête les rend déjà du plus récent au plus ancien, ce qui donne une
 * suggestion utile même à un profil vide — les dernières recettes ajoutées.
 */
export function rankSuggestions(
  recipes: CandidateRecipe[],
  profile: SuggestionProfile,
  limit: number,
): ScoredRecipe[] {
  return recipes
    .map((recipe) => scoreRecipe(recipe, profile))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
