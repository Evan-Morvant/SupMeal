import { z } from 'zod';
import { TAG_TYPES } from '../../models/tag.model';

/** Schémas de validation du catalogue : ingrédients et tags. */

/**
 * Autocomplétion des ingrédients. `q` reste facultatif — sans lui, la route
 * rend le début du catalogue par ordre alphabétique, ce dont un client se sert
 * pour amorcer une liste avant la première frappe.
 *
 * `limit` est plafonné : une autocomplétion n'affiche qu'une poignée de
 * propositions, et rien ne justifie de faire traverser le catalogue entier au
 * réseau à chaque caractère tapé.
 */
export const listIngredientsSchema = z.object({
  q: z.string().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Les tags sont peu nombreux : ils se rendent en entier, filtrés par type. */
export const listTagsSchema = z.object({
  type: z.enum(TAG_TYPES).optional(),
});

export type ListIngredientsQuery = z.infer<typeof listIngredientsSchema>;
export type ListTagsQuery = z.infer<typeof listTagsSchema>;
