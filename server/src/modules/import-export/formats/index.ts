import { type FormatId, type RecipeFormat } from '../import-export.types';
import { csvFormat } from './csv.format';
import { parseJsonDocument, readRecipeList } from './json';
import { mealieFormat } from './mealie.format';
import { supmealFormat } from './supmeal.format';

/** Registre des formats de fichier. En ajouter un ne touche à rien d'autre. */
const FORMATS: Record<FormatId, RecipeFormat> = {
  json: supmealFormat,
  csv: csvFormat,
  mealie: mealieFormat,
};

export function getFormat(id: FormatId): RecipeFormat {
  return FORMATS[id];
}

/** Clés propres au schéma de Mealie, absentes du format natif. */
const MEALIE_MARKERS = [
  'recipeIngredient',
  'recipe_ingredient',
  'recipeInstructions',
  'recipe_instructions',
  'recipeYield',
  'recipe_yield',
];

/**
 * Format déduit du contenu, lorsque la requête d'import n'en impose aucun.
 * Distinguer JSON de CSV se fait au premier caractère ; distinguer le format
 * natif de celui de Mealie demande de regarder les clés d'une recette, les
 * deux étant du JSON.
 */
export function detectFormat(text: string): RecipeFormat {
  if (!/^\s*[[{]/.test(text)) {
    return csvFormat;
  }
  const first = readRecipeList(parseJsonDocument(text))[0];
  if (first !== undefined && MEALIE_MARKERS.some((key) => key in first)) {
    return mealieFormat;
  }
  return supmealFormat;
}
