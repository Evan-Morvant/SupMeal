import { z } from 'zod';

/** Schémas de validation du module des listes de courses. */

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');

/**
 * Génération depuis une fenêtre du planning. Les deux bornes sont exigées, à la
 * différence de la consultation du planning : une liste de courses porte sur
 * une période arrêtée — la semaine à venir — et non sur un intervalle ouvert.
 *
 * `name` reste facultatif, un intitulé par défaut étant déduit des dates.
 */
export const generateShoppingListSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    fromDate: dateSchema,
    toDate: dateSchema,
    cookbookId: z.string().uuid().nullable().optional(),
  })
  .refine((body) => body.fromDate <= body.toDate, {
    message: 'La date de début doit précéder la date de fin',
  });

/**
 * Modification d'une ligne. `checked` sert à cocher au fil des courses ;
 * quantité et unité se corrigent à la main quand l'agrégation ne pouvait pas
 * deviner — deux unités qu'aucune table ne convertit, par exemple.
 */
export const updateShoppingListItemSchema = z
  .object({
    checked: z.boolean().optional(),
    quantity: z.number().positive().max(1000000).nullable().optional(),
    unit: z.string().min(1).max(30).nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Aucun champ à modifier',
  });

export const shoppingListParamsSchema = z.object({ id: z.string().uuid() });

export const shoppingListItemParamsSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
});

export type GenerateShoppingListInput = z.infer<typeof generateShoppingListSchema>;
export type UpdateShoppingListItemInput = z.infer<typeof updateShoppingListItemSchema>;
