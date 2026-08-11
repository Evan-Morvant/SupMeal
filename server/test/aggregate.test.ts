import { describe, it, expect } from 'vitest';
import { aggregateIngredients, type PlannedRecipe } from '../src/modules/shopping-lists/aggregate';

/** Identifiants lisibles : l'agrégation ne fait aucune hypothèse sur leur forme. */
const FARINE = 'farine-id';
const POMMES = 'pommes-id';
const SEL = 'sel-id';

function recipe(
  ingredients: PlannedRecipe['ingredients'],
  servings: { planned?: number | null; recipe?: number | null } = {},
): PlannedRecipe {
  return {
    plannedServings: servings.planned ?? null,
    recipeServings: servings.recipe ?? null,
    ingredients,
  };
}

describe('Agrégation des ingrédients', () => {
  it('cumule le même ingrédient dans la même unité', () => {
    const items = aggregateIngredients([
      recipe([{ ingredientId: FARINE, quantity: 200, unit: 'g' }]),
      recipe([{ ingredientId: FARINE, quantity: 300, unit: 'g' }]),
    ]);
    expect(items).toEqual([{ ingredientId: FARINE, quantity: 500, unit: 'g' }]);
  });

  it('sépare le même ingrédient dans deux unités inconvertibles', () => {
    const items = aggregateIngredients([
      recipe([{ ingredientId: POMMES, quantity: 2, unit: null }]),
      recipe([{ ingredientId: POMMES, quantity: 200, unit: 'g' }]),
    ]);
    expect(items).toHaveLength(2);
    expect(items).toContainEqual({ ingredientId: POMMES, quantity: 2, unit: null });
    expect(items).toContainEqual({ ingredientId: POMMES, quantity: 200, unit: 'g' });
  });

  it('ignore la casse et les espaces de bordure de l unité', () => {
    const items = aggregateIngredients([
      recipe([{ ingredientId: FARINE, quantity: 100, unit: 'g' }]),
      recipe([{ ingredientId: FARINE, quantity: 50, unit: ' G ' }]),
    ]);
    expect(items).toEqual([{ ingredientId: FARINE, quantity: 150, unit: 'g' }]);
  });

  it('laisse sans quantité un ingrédient qui n en portait pas', () => {
    const items = aggregateIngredients([
      recipe([{ ingredientId: SEL, quantity: null, unit: null }]),
      recipe([{ ingredientId: SEL, quantity: null, unit: null }]),
    ]);
    expect(items).toEqual([{ ingredientId: SEL, quantity: null, unit: null }]);
  });

  it('ne totalise que ce qui est chiffré quand les deux se mélangent', () => {
    const items = aggregateIngredients([
      recipe([{ ingredientId: SEL, quantity: null, unit: null }]),
      recipe([{ ingredientId: SEL, quantity: 5, unit: null }]),
    ]);
    expect(items).toEqual([{ ingredientId: SEL, quantity: 5, unit: null }]);
  });

  it('met les quantités à l échelle des portions prévues', () => {
    const items = aggregateIngredients([
      // 8 parts prévues d'une recette qui en donne 4 : tout double.
      recipe([{ ingredientId: FARINE, quantity: 250, unit: 'g' }], { planned: 8, recipe: 4 }),
    ]);
    expect(items).toEqual([{ ingredientId: FARINE, quantity: 500, unit: 'g' }]);
  });

  it('met aussi à l échelle vers le bas', () => {
    const items = aggregateIngredients([
      recipe([{ ingredientId: FARINE, quantity: 300, unit: 'g' }], { planned: 2, recipe: 6 }),
    ]);
    expect(items).toEqual([{ ingredientId: FARINE, quantity: 100, unit: 'g' }]);
  });

  it('s abstient de mettre à l échelle si une des deux portions manque', () => {
    const sansPrevu = aggregateIngredients([
      recipe([{ ingredientId: FARINE, quantity: 250, unit: 'g' }], { recipe: 4 }),
    ]);
    expect(sansPrevu[0].quantity).toBe(250);

    const sansRecette = aggregateIngredients([
      recipe([{ ingredientId: FARINE, quantity: 250, unit: 'g' }], { planned: 8 }),
    ]);
    expect(sansRecette[0].quantity).toBe(250);
  });

  it('ne divise pas par une recette annoncée à zéro portion', () => {
    const items = aggregateIngredients([
      recipe([{ ingredientId: FARINE, quantity: 250, unit: 'g' }], { planned: 4, recipe: 0 }),
    ]);
    expect(items[0].quantity).toBe(250);
  });

  it('arrondit à deux décimales, comme la colonne qui les stocke', () => {
    const items = aggregateIngredients([
      // 100 / 3 tombe sur un nombre à décimales infinies.
      recipe([{ ingredientId: FARINE, quantity: 100, unit: 'g' }], { planned: 1, recipe: 3 }),
    ]);
    expect(items[0].quantity).toBe(33.33);
  });

  it('cumule les mises à l échelle de plusieurs entrées', () => {
    const items = aggregateIngredients([
      recipe([{ ingredientId: FARINE, quantity: 100, unit: 'g' }], { planned: 4, recipe: 2 }),
      recipe([{ ingredientId: FARINE, quantity: 100, unit: 'g' }], { planned: 1, recipe: 2 }),
    ]);
    // 200 puis 50.
    expect(items).toEqual([{ ingredientId: FARINE, quantity: 250, unit: 'g' }]);
  });

  it('rend une liste vide pour un planning vide', () => {
    expect(aggregateIngredients([])).toEqual([]);
  });
});
