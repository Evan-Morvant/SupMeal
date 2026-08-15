import { slugify } from '../../../common/text';
import {
  type ExportPayload,
  type IngredientView,
  type ParsedFile,
  type RecipeFormat,
  type RecipeView,
} from '../import-export.types';
import { parseJsonDocument, readRecipeList } from './json';
import { isNotNull, isRecord, readArray, readInteger, readName, readNumber, readText } from './values';

/**
 * Interopérabilité avec Mealie, dont le schéma de recette suit schema.org :
 * « recipeIngredient », « recipeInstructions », « recipeYield », durées en
 * ISO 8601. Mealie nomme « performTime » ce que SUPMEAL appelle temps de
 * cuisson, « prepTime » restant la préparation.
 *
 * La lecture est délibérément tolérante : selon qu'un fichier vienne de
 * l'interface, de l'API ou d'une sauvegarde, les clés arrivent en camelCase ou
 * en snake_case, les durées en ISO 8601 ou en texte libre, et les ingrédients
 * tantôt décomposés en aliment + unité, tantôt réduits à un libellé.
 */

/** Première clé renseignée parmi les orthographes possibles d'un champ. */
function field(raw: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (raw[name] !== undefined && raw[name] !== null) {
      return raw[name];
    }
  }
  return undefined;
}

const ISO_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:[\d.]+S)?)?$/i;
const TEXT_HOURS = /(\d+)\s*(?:h\b|hr|heure|hour)/i;
const TEXT_MINUTES = /(\d+)\s*(?:m\b|min|minute)/i;

/**
 * Durée ramenée en minutes. Trois écritures circulent : ISO 8601 (« PT1H30M »,
 * produit par les extracteurs de sites), texte libre (« 1 hour 30 minutes »,
 * saisi à la main) et nombre nu.
 */
function readDurationMinutes(value: unknown): number | null {
  const text = readText(value);
  if (text === null) {
    return null;
  }

  const iso = ISO_DURATION.exec(text);
  if (iso !== null && iso.slice(1).some((part) => part !== undefined)) {
    const [, days, hours, minutes] = iso;
    return Number(days ?? 0) * 24 * 60 + Number(hours ?? 0) * 60 + Number(minutes ?? 0);
  }

  const hours = TEXT_HOURS.exec(text);
  const minutes = TEXT_MINUTES.exec(text);
  if (hours !== null || minutes !== null) {
    return Number(hours?.[1] ?? 0) * 60 + Number(minutes?.[1] ?? 0);
  }

  return readInteger(text);
}

function toIsoDuration(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) {
    return null;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return 'PT' + (hours > 0 ? hours + 'H' : '') + (rest > 0 ? rest + 'M' : '');
}

/** Libellé lisible d'une ligne d'ingrédient, attendu au champ « display ». */
function ingredientDisplay(line: IngredientView): string {
  const parts = [line.quantity === null ? null : String(line.quantity), line.unit, line.name];
  const label = parts.filter(isNotNull).join(' ');
  return line.note === null ? label : label + ' (' + line.note + ')';
}

function toMealieIngredient(line: IngredientView): Record<string, unknown> {
  return {
    quantity: line.quantity ?? 0,
    unit: line.unit === null ? null : { name: line.unit },
    food: { name: line.name },
    note: line.note ?? '',
    isFood: true,
    display: ingredientDisplay(line),
    title: null,
  };
}

function toMealieRecipe(recipe: RecipeView): Record<string, unknown> {
  const total =
    recipe.prepTimeMin === null && recipe.cookTimeMin === null
      ? null
      : (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0);

  return {
    name: recipe.title,
    slug: slugify(recipe.title),
    description: recipe.description ?? '',
    recipeYield: recipe.servings === null ? '' : recipe.servings + ' portions',
    prepTime: toIsoDuration(recipe.prepTimeMin),
    performTime: toIsoDuration(recipe.cookTimeMin),
    cookTime: null,
    totalTime: toIsoDuration(total),
    recipeIngredient: recipe.ingredients.map(toMealieIngredient),
    recipeInstructions: recipe.steps.map((text) => ({ title: '', text, ingredientReferences: [] })),
    tags: recipe.tags.map((name) => ({ name, slug: slugify(name) })),
    recipeCategory: [],
    orgURL: recipe.source,
    notes: [],
  };
}

function readMealieIngredient(raw: unknown): IngredientView | null {
  if (!isRecord(raw)) {
    const name = readText(raw);
    return name === null ? null : { name, quantity: null, unit: null, note: null };
  }

  const food = readName(field(raw, 'food'));
  const note = readText(raw.note);
  // Sans aliment structuré, Mealie garde le libellé complet dans « note » (ou
  // à défaut « display ») : il devient alors le nom de l'ingrédient.
  const name = food ?? note ?? readText(raw.display);
  if (name === null) {
    return null;
  }

  return {
    name,
    quantity: readNumber(raw.quantity),
    unit: readName(field(raw, 'unit')),
    note: food === null ? null : note,
  };
}

function readMealieStep(raw: unknown): string | null {
  if (isRecord(raw)) {
    return readText(raw.text) ?? readText(raw.instruction);
  }
  return readText(raw);
}

/** « 4 servings », « Pour 6 personnes » : le nombre de portions est en tête. */
function readServings(raw: Record<string, unknown>): number | null {
  const quantity = readInteger(field(raw, 'recipeYieldQuantity', 'recipe_yield_quantity'));
  if (quantity !== null) {
    return quantity;
  }
  const yieldText = readText(field(raw, 'recipeYield', 'recipe_yield'));
  const match = yieldText === null ? null : /\d+/.exec(yieldText);
  return match === null ? null : Number(match[0]);
}

/** Les catégories Mealie rejoignent les tags : SUPMEAL n'a qu'un vocabulaire. */
function readTags(raw: Record<string, unknown>): string[] {
  return [
    ...readArray(field(raw, 'tags')),
    ...readArray(field(raw, 'recipeCategory', 'recipe_category')),
  ]
    .map(readName)
    .filter(isNotNull);
}

function toRecipeView(raw: Record<string, unknown>): RecipeView {
  return {
    title: readText(field(raw, 'name', 'title')) ?? '',
    description: readText(raw.description),
    prepTimeMin: readDurationMinutes(field(raw, 'prepTime', 'prep_time')),
    // « cookTime » n'est renseigné que par les fichiers venus de schema.org,
    // Mealie stockant la cuisson sous « performTime ».
    cookTimeMin: readDurationMinutes(field(raw, 'performTime', 'perform_time', 'cookTime')),
    servings: readServings(raw),
    source: readText(field(raw, 'orgURL', 'org_url', 'sourceUrl')),
    tags: readTags(raw),
    ingredients: readArray(field(raw, 'recipeIngredient', 'recipe_ingredient'))
      .map(readMealieIngredient)
      .filter(isNotNull),
    steps: readArray(field(raw, 'recipeInstructions', 'recipe_instructions'))
      .map(readMealieStep)
      .filter(isNotNull),
  };
}

export const mealieFormat: RecipeFormat = {
  id: 'mealie',
  extension: 'json',
  contentType: 'application/json; charset=utf-8',

  // Un tableau nu, sans enveloppe : c'est ce que Mealie sait relire.
  serialize(payload: ExportPayload): string {
    return JSON.stringify(payload.recipes.map(toMealieRecipe), null, 2);
  },

  parse(text: string): ParsedFile {
    return { recipes: readRecipeList(parseJsonDocument(text)).map(toRecipeView) };
  },
};
