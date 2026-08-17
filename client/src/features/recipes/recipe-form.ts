import { z } from 'zod';
import type { Recipe, RecipeInput, Visibility } from '../../api/types';

/*
 * Forme du formulaire de recette et sa traduction vers le corps attendu par
 * l'API. Tous les champs sont des chaînes, même les nombres : un champ vidé
 * rendrait `NaN`, et « vide » doit rester distinct de « zéro » — une recette
 * sans cuisson n'est pas une recette qui cuit zéro minute.
 */

/** Bornes reprises de `server/src/modules/recipes/recipes.schemas.ts`. */
const LIMITS = {
  title: 255,
  description: 5000,
  source: 2048,
  ingredientName: 120,
  unit: 30,
  note: 255,
  instruction: 2000,
  minutes: 10000,
  servings: 100,
  quantity: 1000000,
};

/** Entier facultatif saisi au clavier : vide accepté, texte refusé. */
function optionalInteger(max: number, message: string) {
  return z
    .string()
    .trim()
    .refine((value) => value === '' || (/^\d+$/.test(value) && Number(value) <= max), message);
}

const ingredientRowSchema = z.object({
  name: z.string().trim().max(LIMITS.ingredientName, 'Nom trop long'),
  quantity: z
    .string()
    .trim()
    .refine((value) => {
      if (value === '') {
        return true;
      }
      // La virgule décimale est la norme française : on l'accepte à la saisie.
      const parsed = Number(value.replace(',', '.'));
      return Number.isFinite(parsed) && parsed > 0 && parsed <= LIMITS.quantity;
    }, 'Quantité invalide'),
  unit: z.string().trim().max(LIMITS.unit, 'Unité trop longue'),
  note: z.string().trim().max(LIMITS.note, 'Précision trop longue'),
});

const stepRowSchema = z.object({
  instruction: z.string().trim().max(LIMITS.instruction, 'Étape trop longue'),
});

export const recipeFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Le titre est obligatoire').max(LIMITS.title, 'Titre trop long'),
    description: z.string().trim().max(LIMITS.description, 'Description trop longue'),
    prepTimeMin: optionalInteger(LIMITS.minutes, 'Durée en minutes, sans décimale'),
    cookTimeMin: optionalInteger(LIMITS.minutes, 'Durée en minutes, sans décimale'),
    servings: optionalInteger(LIMITS.servings, 'Nombre de portions invalide'),
    source: z.string().trim().max(LIMITS.source, 'Source trop longue'),
    visibility: z.enum(['private', 'public']),
    ingredients: z.array(ingredientRowSchema).max(100, 'Cent ingrédients au maximum'),
    steps: z.array(stepRowSchema).max(100, 'Cent étapes au maximum'),
    tags: z.array(z.string()).max(30, 'Trente tags au maximum'),
  })
  .superRefine((values, ctx) => {
    // Une ligne sans nom est abandonnée à l'envoi : si elle porte une saisie,
    // la jeter en silence serait une perte.
    values.ingredients.forEach((row, index) => {
      const filled = row.quantity !== '' || row.unit !== '' || row.note !== '';
      if (row.name === '' && filled) {
        ctx.addIssue({
          code: 'custom',
          path: ['ingredients', index, 'name'],
          message: "Nommez l'ingrédient, ou videz la ligne",
        });
      }
    });
  });

export type RecipeFormValues = z.infer<typeof recipeFormSchema>;

/** Formulaire d'une recette neuve : une ligne et une étape, prêtes à remplir. */
export function emptyRecipeForm(defaultServings: number | null): RecipeFormValues {
  return {
    title: '',
    description: '',
    prepTimeMin: '',
    cookTimeMin: '',
    servings: defaultServings === null ? '' : String(defaultServings),
    source: '',
    visibility: 'private',
    ingredients: [{ name: '', quantity: '', unit: '', note: '' }],
    steps: [{ instruction: '' }],
    tags: [],
  };
}

/** Remplit le formulaire depuis une recette existante. */
export function recipeToForm(recipe: Recipe): RecipeFormValues {
  return {
    title: recipe.title,
    description: recipe.description ?? '',
    prepTimeMin: recipe.prepTimeMin === null ? '' : String(recipe.prepTimeMin),
    cookTimeMin: recipe.cookTimeMin === null ? '' : String(recipe.cookTimeMin),
    servings: recipe.servings === null ? '' : String(recipe.servings),
    source: recipe.source ?? '',
    visibility: recipe.visibility,
    ingredients:
      recipe.ingredients.length > 0
        ? recipe.ingredients.map((line) => ({
            name: line.name ?? '',
            quantity: line.quantity === null ? '' : String(line.quantity),
            unit: line.unit ?? '',
            note: line.note ?? '',
          }))
        : [{ name: '', quantity: '', unit: '', note: '' }],
    steps:
      recipe.steps.length > 0
        ? recipe.steps.map((step) => ({ instruction: step.instruction }))
        : [{ instruction: '' }],
    tags: recipe.tags.map((tag) => tag.name),
  };
}

function textOrNull(value: string): string | null {
  return value.trim() === '' ? null : value.trim();
}

function numberOrNull(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

/** Traduit le formulaire en corps de requête, collections comprises. */
export function formToInput(values: RecipeFormValues): RecipeInput {
  return {
    title: values.title.trim(),
    description: textOrNull(values.description),
    prepTimeMin: numberOrNull(values.prepTimeMin),
    cookTimeMin: numberOrNull(values.cookTimeMin),
    servings: numberOrNull(values.servings),
    source: textOrNull(values.source),
    visibility: values.visibility as Visibility,
    ingredients: values.ingredients
      .filter((row) => row.name.trim() !== '')
      .map((row) => ({
        name: row.name.trim(),
        quantity: row.quantity === '' ? null : Number(row.quantity.replace(',', '.')),
        unit: textOrNull(row.unit),
        note: textOrNull(row.note),
      })),
    steps: values.steps
      .map((row) => row.instruction.trim())
      .filter((instruction) => instruction !== ''),
    tags: values.tags.map((tag) => tag.trim()).filter((tag) => tag !== ''),
  };
}
