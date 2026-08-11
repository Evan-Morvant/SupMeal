/**
 * Agrégation des ingrédients d'un planning en une liste de courses.
 *
 * Fonction pure, sans Sequelize ni base : c'est la règle métier du bonus, elle
 * se lit et s'éprouve seule.
 */

/** Une recette telle qu'elle est prévue au planning, réduite à ce qui compte ici. */
export interface PlannedRecipe {
  /** Portions inscrites au planning, `null` si l'entrée n'en précise pas. */
  plannedServings: number | null;
  /** Portions de la recette telle qu'elle est écrite, `null` si non renseignées. */
  recipeServings: number | null;
  ingredients: PlannedIngredient[];
}

export interface PlannedIngredient {
  ingredientId: string;
  quantity: number | null;
  unit: string | null;
}

/** Ligne de la liste : un ingrédient, une unité, la somme des quantités. */
export interface AggregatedItem {
  ingredientId: string;
  quantity: number | null;
  unit: string | null;
}

/**
 * Facteur d'échelle d'une entrée de planning. Prévoir 8 parts d'une recette
 * qui en donne 4, c'est doubler les quantités. À défaut de connaître les deux
 * nombres, on s'abstient.
 */
function scaleFactor(entry: PlannedRecipe): number {
  const { plannedServings, recipeServings } = entry;
  if (plannedServings === null || recipeServings === null || recipeServings <= 0) {
    return 1;
  }
  return plannedServings / recipeServings;
}

/**
 * Deux lignes ne se cumulent que si elles parlent de la même chose : le même
 * ingrédient dans la même unité. « 2 pommes » et « 200 g de pommes » restent
 * donc séparés, faute de table de conversion — additionner les deux
 * donnerait 202 de rien du tout.
 *
 * L'unité est comparée sans casse ni espaces de bordure, pour que « g » et
 * « G » ne fassent pas deux lignes. L'espace sépare les deux parties de la clé
 * sans ambiguïté : un identifiant est un UUID, il n'en contient jamais.
 */
function itemKey(ingredientId: string, unit: string | null): string {
  return ingredientId + ' ' + (unit ?? '').trim().toLowerCase();
}

/** Les quantités sont stockées en `numeric(10,2)` : deux décimales suffisent. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Fusionne les ingrédients de toutes les recettes prévues.
 *
 * Une ligne sans quantité — « sel », « poivre » — reste sans quantité : lui en
 * attribuer une serait inventer. Si la même paire apparaît tantôt chiffrée
 * tantôt non, seules les valeurs chiffrées sont sommées, le reste étant de
 * toute façon impossible à totaliser.
 *
 * Une seule passe sur les lignes, l'accumulation se faisant dans une `Map`
 * indexée par la paire (ingrédient, unité).
 */
export function aggregateIngredients(planned: PlannedRecipe[]): AggregatedItem[] {
  const items = new Map<string, AggregatedItem>();

  for (const entry of planned) {
    const factor = scaleFactor(entry);

    for (const line of entry.ingredients) {
      const key = itemKey(line.ingredientId, line.unit);
      const existing = items.get(key);

      if (existing === undefined) {
        items.set(key, {
          ingredientId: line.ingredientId,
          quantity: line.quantity === null ? null : round(line.quantity * factor),
          unit: line.unit,
        });
        continue;
      }

      if (line.quantity === null) {
        continue;
      }
      const scaled = line.quantity * factor;
      existing.quantity = existing.quantity === null ? round(scaled) : round(existing.quantity + scaled);
    }
  }

  return [...items.values()];
}
