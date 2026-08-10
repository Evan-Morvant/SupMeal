import { isRecord, malformedFile, readArray } from './values';

/** Lecture commune aux deux formats JSON (natif et Mealie). */

export function parseJsonDocument(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw malformedFile('Fichier JSON illisible');
  }
}

/**
 * Extrait la liste des recettes d'un document JSON, dans les trois
 * dispositions rencontrées : la liste seule, un objet qui la porte sous
 * « recipes », ou une recette unique à la racine (c'est ainsi que Mealie
 * exporte une recette isolée).
 */
export function readRecipeList(document: unknown): Record<string, unknown>[] {
  if (Array.isArray(document)) {
    return document.filter(isRecord);
  }
  if (!isRecord(document)) {
    return [];
  }
  if (document.recipes !== undefined) {
    return readArray(document.recipes).filter(isRecord);
  }
  return [document];
}
