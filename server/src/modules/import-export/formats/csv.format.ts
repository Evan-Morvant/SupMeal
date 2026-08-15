import { parseCsv, toCsv } from '../../../common/csv';
import {
  EXPORT_WARNING,
  type ExportPayload,
  type IngredientView,
  type ParsedFile,
  type RecipeFormat,
  type RecipeView,
} from '../import-export.types';
import { isNotNull, malformedFile, readInteger, readNumber, readText } from './values';

/**
 * Format tableur : une recette par ligne, ouvrable tel quel dans Excel ou
 * LibreOffice.
 *
 * Les collections tiennent dans une seule cellule, à raison d'un élément par
 * ligne (le RFC 4180 autorise les sauts de ligne dans un champ cité). Les
 * ingrédients y sont décomposés en « quantité|unité|nom|note » : un libellé
 * libre du type « 200 g de farine » ne se redécouperait pas de façon fiable au
 * retour, un nom d'ingrédient pouvant lui-même contenir des espaces.
 */

/** Séparateur des champs d'un ingrédient, à l'intérieur de sa ligne. */
const FIELD = '|';
/** Séparateur des éléments d'une collection, à l'intérieur d'une cellule. */
const ITEM = '\n';

const COLUMNS = [
  'title',
  'description',
  'prepTimeMin',
  'cookTimeMin',
  'servings',
  'source',
  'tags',
  'ingredients',
  'steps',
] as const;

/** Intitulés acceptés en relecture pour la colonne du titre. */
const TITLE_HEADERS = ['title', 'titre', 'name', 'nom'];

/**
 * Légende placée en tête de fichier : elle porte l'avertissement sur les
 * données en clair et rappelle la convention d'écriture des collections.
 */
const LEGEND =
  '# ' +
  EXPORT_WARNING +
  ' Collections : un element par ligne dans la cellule ; ' +
  'ingredient = quantite|unite|nom|note.';

function ingredientToLine(line: IngredientView): string {
  return [line.quantity ?? '', line.unit ?? '', line.name, line.note ?? ''].join(FIELD);
}

function lineToIngredient(line: string): IngredientView | null {
  const [quantity, unit, name, ...note] = line.split(FIELD);
  // Une cellule remplie à la main peut ne contenir que le nom de l'ingrédient.
  const label = readText(name) ?? readText(quantity);
  if (label === null) {
    return null;
  }
  return {
    name: label,
    quantity: name === undefined ? null : readNumber(quantity),
    unit: readText(unit),
    note: readText(note.join(FIELD)),
  };
}

function joinCell(values: string[]): string {
  return values.join(ITEM);
}

function splitCell(value: string): string[] {
  return value.split(ITEM).map(readText).filter(isNotNull);
}

function toRow(recipe: RecipeView): string[] {
  return [
    recipe.title,
    recipe.description ?? '',
    recipe.prepTimeMin === null ? '' : String(recipe.prepTimeMin),
    recipe.cookTimeMin === null ? '' : String(recipe.cookTimeMin),
    recipe.servings === null ? '' : String(recipe.servings),
    recipe.source ?? '',
    joinCell(recipe.tags),
    joinCell(recipe.ingredients.map(ingredientToLine)),
    joinCell(recipe.steps),
  ];
}

/**
 * Position de chaque colonne connue, repérée par son intitulé : l'ordre des
 * colonnes du fichier relu n'a donc pas d'importance, et les colonnes
 * étrangères sont simplement ignorées.
 */
function indexHeader(header: string[]): Map<string, number> {
  const positions = new Map<string, number>();
  header.forEach((label, index) => {
    const name = label.trim().toLowerCase();
    if (!positions.has(name)) {
      positions.set(name, index);
    }
  });
  return positions;
}

/** Ligne d'en-têtes : la première qui nomme une colonne de titre. */
function findHeaderRow(rows: string[][]): number {
  return rows.findIndex((cells) =>
    cells.some((cell) => TITLE_HEADERS.includes(cell.trim().toLowerCase())),
  );
}

export const csvFormat: RecipeFormat = {
  id: 'csv',
  extension: 'csv',
  contentType: 'text/csv; charset=utf-8',

  serialize(payload: ExportPayload): string {
    return toCsv([[LEGEND], [...COLUMNS], ...payload.recipes.map(toRow)]);
  },

  // Un tableau ne porte que des recettes : ni préférences, ni cookbooks.
  parse(text: string): ParsedFile {
    const rows = parseCsv(text);
    const headerRow = findHeaderRow(rows);
    if (headerRow === -1) {
      throw malformedFile('En-tête CSV introuvable : une colonne « title » est attendue');
    }

    const positions = indexHeader(rows[headerRow]);
    const cellAt = (cells: string[], column: string): string => {
      const index = positions.get(column.toLowerCase());
      return index === undefined ? '' : (cells[index] ?? '');
    };
    const titleColumn = TITLE_HEADERS.find((name) => positions.has(name)) ?? 'title';

    return {
      recipes: rows.slice(headerRow + 1).map((cells) => ({
        title: readText(cellAt(cells, titleColumn)) ?? '',
        description: readText(cellAt(cells, 'description')),
        prepTimeMin: readInteger(cellAt(cells, 'prepTimeMin')),
        cookTimeMin: readInteger(cellAt(cells, 'cookTimeMin')),
        servings: readInteger(cellAt(cells, 'servings')),
        source: readText(cellAt(cells, 'source')),
        tags: splitCell(cellAt(cells, 'tags')),
        ingredients: splitCell(cellAt(cells, 'ingredients'))
          .map(lineToIngredient)
          .filter(isNotNull),
        steps: splitCell(cellAt(cells, 'steps')),
      })),
    };
  },
};
