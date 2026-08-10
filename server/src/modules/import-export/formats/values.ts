import { AppError } from '../../../common/app-error';

/**
 * Lectures défensives des valeurs d'un fichier importé. Rien de ce qui vient
 * d'un fichier n'est digne de confiance : un champ attendu en nombre peut
 * arriver en chaîne, un champ attendu en tableau peut être absent.
 *
 * Ces fonctions ne rejettent pas, elles ramènent à `null` ce qui est
 * inexploitable. Le refus reste la responsabilité du schéma de création de
 * recette, qui produit alors un message d'erreur nommant le champ fautif.
 */

/** Fichier illisible : le contenu n'a pas la forme annoncée par le format. */
export function malformedFile(message: string): AppError {
  return new AppError(422, 'MALFORMED_FILE', message);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Chaîne non vide, débarrassée de ses espaces de bordure, sinon `null`. */
export function readText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

/**
 * Nombre positif. La virgule décimale est acceptée : les fichiers rédigés en
 * français écrivent « 1,5 » là où JSON écrit « 1.5 ».
 */
export function readNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const text = readText(value);
  if (text === null) {
    return null;
  }
  const parsed = Number(text.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function readInteger(value: unknown): number | null {
  const parsed = readNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

/** Prédicat de filtrage : écarte les entrées qu'une lecture a ramenées à `null`. */
export function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

/** Toujours un tableau : un champ absent devient une liste vide. */
export function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Libellé d'une entité qui peut arriver sous deux formes selon l'outil
 * d'origine : la chaîne directement, ou l'objet qui la porte (« unit »,
 * « food » et « tags » de Mealie sont des objets nommés).
 */
export function readName(value: unknown): string | null {
  if (isRecord(value)) {
    return readText(value.name);
  }
  return readText(value);
}
