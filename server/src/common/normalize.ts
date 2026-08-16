/**
 * Forme de comparaison d'un nom d'ingrédient ou de tag : casse et espaces
 * neutralisés. Écriture et filtrage doivent passer par la même fonction, sinon
 * ce qui a été stocké devient introuvable.
 */
export function matchName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}
