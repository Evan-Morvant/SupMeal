/** Marque d'ordre des octets, placée en tête de fichier par Excel et Notepad. */
const BYTE_ORDER_MARK = 0xfeff;

/**
 * Retire le BOM éventuel d'un texte décodé. Laissé en place, il collerait au
 * premier caractère utile : un en-tête de colonne méconnaissable en CSV, une
 * accolade ouvrante que `JSON.parse` refuse en JSON.
 */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text;
}

/** Marques diacritiques laissées par une décomposition Unicode (NFD). */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Identifiant lisible tiré d'un libellé : minuscules, sans accent ni
 * ponctuation. Sert au nom des fichiers exportés comme au champ `slug`
 * qu'attend Mealie.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
