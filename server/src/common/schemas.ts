import { z } from 'zod';

/** Fragments de schémas Zod réutilisés par plusieurs modules. */

/**
 * Booléen transmis en texte : chaîne de requête ou champ d'un envoi
 * multipart. `z.coerce.boolean()` est inutilisable ici, la chaîne « false »
 * étant truthy, elle serait convertie en `true` : les deux valeurs sont donc
 * lues explicitement.
 */
export const booleanParam = z.enum(['true', 'false']).transform((value) => value === 'true');
