import { z } from 'zod';

/**
 * Date de calendrier, sans heure ni fuseau : un repas est planifié un jour
 * donné, pas à un instant. Le format ISO se compare aussi comme du texte,
 * ce dont profitent le tri et le contrôle de la fenêtre ci-dessous.
 */
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');

const mealTypeSchema = z.enum(['petit-déjeuner', 'déjeuner', 'dîner', 'collation']);

const servingsSchema = z.number().int().min(1).max(100).nullable().optional();

/**
 * Fenêtre de consultation. Les deux bornes sont facultatives — le planning
 * entier reste consultable — mais une fenêtre inversée est refusée : elle ne
 * renverrait jamais rien, ce qui ressemblerait à un planning vide.
 */
export const listMealPlanSchema = z
  .object({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    cookbookId: z.string().uuid().optional(),
  })
  .refine((query) => query.from === undefined || query.to === undefined || query.from <= query.to, {
    message: 'La date de début doit précéder la date de fin',
  });

/** `cookbookId` absent = planning personnel ; renseigné = planning du groupe. */
export const createMealPlanEntrySchema = z.object({
  recipeId: z.string().uuid(),
  cookbookId: z.string().uuid().nullable().optional(),
  date: dateSchema,
  mealType: mealTypeSchema,
  servings: servingsSchema,
});

/**
 * Modification partielle. `cookbookId` en est absent et les clés inconnues
 * sont refusées plutôt qu'ignorées : une entrée ne déménage pas d'un planning
 * personnel vers celui d'un groupe, sans quoi les droits qui l'encadrent
 * changeraient en cours de route. Un tel déplacement se fait en supprimant
 * puis en recréant l'entrée.
 */
export const updateMealPlanEntrySchema = z
  .object({
    recipeId: z.string().uuid().optional(),
    date: dateSchema.optional(),
    mealType: mealTypeSchema.optional(),
    servings: servingsSchema,
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Aucun champ à modifier',
  });

export const mealPlanEntryParamsSchema = z.object({ entryId: z.string().uuid() });

export type ListMealPlanQuery = z.infer<typeof listMealPlanSchema>;
export type CreateMealPlanEntryInput = z.infer<typeof createMealPlanEntrySchema>;
export type UpdateMealPlanEntryInput = z.infer<typeof updateMealPlanEntrySchema>;
