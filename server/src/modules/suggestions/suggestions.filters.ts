import { literal } from 'sequelize';
import { sequelize } from '../../models';

/**
 * Exclusions SQL du vivier de suggestions.
 *
 * Elles s'expriment en sous-requêtes corrélées, comme les filtres de recherche
 * de recettes : une jointure multiplierait les lignes et fausserait le
 * comptage. Toute valeur venue du profil passe par `sequelize.escape`.
 */

function quote(value: string): string {
  return sequelize.escape(value);
}

/** Neutralise les jokers d'un terme saisi par l'utilisateur. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => '\\' + char);
}

/**
 * Écarte toute recette contenant un ingrédient dont le nom rappelle une
 * allergie déclarée.
 */
export function withoutAllergens(allergies: string[]) {
  const terms = allergies
    .map((allergy) => allergy.trim().toLowerCase())
    .filter((allergy) => allergy.length > 0);

  if (terms.length === 0) {
    return literal('TRUE');
  }

  const conditions = terms
    .map((term) => 'i.name LIKE ' + quote('%' + escapeLike(term) + '%'))
    .join(' OR ');

  return literal(`NOT EXISTS (
    SELECT 1
    FROM recipe_ingredients ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    WHERE ri.recipe_id = "Recipe"."id" AND (${conditions})
  )`);
}

/**
 * Écarte ce que l'utilisateur a déjà mis en favori. Une suggestion sert à
 * faire découvrir : lui remontrer ce qu'il a lui-même distingué n'apprend
 * rien, et ses favoris sont déjà à un filtre de distance.
 */
export function notFavorite(userId: string) {
  return literal(`NOT EXISTS (
    SELECT 1 FROM favorites f
    WHERE f.recipe_id = "Recipe"."id" AND f.user_id = ${quote(userId)}
  )`);
}

/**
 * Écarte ce qui est déjà prévu à venir : la recette est au menu, la proposer
 * de nouveau ne rendrait aucun service. Le passé reste éligible, une recette
 * cuisinée le mois dernier pouvant tout à fait revenir.
 */
export function notAlreadyPlanned(userId: string) {
  return literal(`NOT EXISTS (
    SELECT 1 FROM meal_plan_entries m
    WHERE m.recipe_id = "Recipe"."id"
      AND m.user_id = ${quote(userId)}
      AND m.date >= CURRENT_DATE
  )`);
}
