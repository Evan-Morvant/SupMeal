import {
  EXPORT_WARNING,
  type ExportPayload,
  type IngredientView,
  type ParsedFile,
  type RecipeFormat,
  type RecipeView,
} from '../import-export.types';
import { parseJsonDocument, readRecipeList } from './json';
import {
  isNotNull,
  isRecord,
  readArray,
  readInteger,
  readName,
  readNumber,
  readText,
} from './values';

/**
 * Format natif de SUPMEAL : le JSON le plus complet des trois, c'est celui à
 * choisir pour sauvegarder puis restaurer ses données.
 */

export const SUPMEAL_FORMAT_TAG = 'supmeal';
const FORMAT_VERSION = 1;

/** Une étape peut être écrite en clair ou portée par un objet. */
function readStep(raw: unknown): string | null {
  if (isRecord(raw)) {
    return readText(raw.instruction) ?? readText(raw.text);
  }
  return readText(raw);
}

/** Un ingrédient réduit à son nom reste valable : « sel », « poivre ». */
function readIngredient(raw: unknown): IngredientView | null {
  if (!isRecord(raw)) {
    const name = readText(raw);
    return name === null ? null : { name, quantity: null, unit: null, note: null };
  }
  const name = readText(raw.name);
  if (name === null) {
    return null;
  }
  return {
    name,
    quantity: readNumber(raw.quantity),
    unit: readText(raw.unit),
    note: readText(raw.note),
  };
}

function toRecipeView(raw: Record<string, unknown>): RecipeView {
  return {
    // Une recette sans titre sera refusée par le schéma de création, qui
    // nommera le champ fautif dans le rapport d'import.
    title: readText(raw.title) ?? '',
    description: readText(raw.description),
    prepTimeMin: readInteger(raw.prepTimeMin),
    cookTimeMin: readInteger(raw.cookTimeMin),
    servings: readInteger(raw.servings),
    source: readText(raw.source),
    tags: readArray(raw.tags).map(readName).filter(isNotNull),
    ingredients: readArray(raw.ingredients).map(readIngredient).filter(isNotNull),
    steps: readArray(raw.steps).map(readStep).filter(isNotNull),
  };
}

export const supmealFormat: RecipeFormat = {
  id: 'json',
  extension: 'json',
  contentType: 'application/json; charset=utf-8',

  serialize(payload: ExportPayload): string {
    return JSON.stringify(
      {
        format: SUPMEAL_FORMAT_TAG,
        version: FORMAT_VERSION,
        warning: EXPORT_WARNING,
        exportedAt: payload.exportedAt,
        cookbooks: payload.cookbooks,
        recipes: payload.recipes,
      },
      null,
      2,
    );
  },

  parse(text: string): ParsedFile {
    return { recipes: readRecipeList(parseJsonDocument(text)).map(toRecipeView) };
  },
};
