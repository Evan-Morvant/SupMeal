import { z } from 'zod';

/** Schémas de validation des corps de requête du module users. */

/** PATCH /users/me : modification partielle, au moins un champ fourni. */
export const updateProfileSchema = z
  .object({
    displayName: z.string().min(1).max(255).optional(),
    avatarUrl: z.string().url().max(2048).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Aucun champ à modifier',
  });

/**
 * PUT /users/me/password. `currentPassword` n'est exigé que si un mot de passe
 * existe déjà : un compte purement OAuth n'en a aucun à confirmer.
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

/**
 * PUT /users/me/preferences : représentation complète des préférences.
 * Les valeurs par défaut rendent le remplacement explicite — un champ omis
 * est réinitialisé.
 */
export const preferencesSchema = z.object({
  diets: z.array(z.string().min(1).max(50)).max(20).default([]),
  allergies: z.array(z.string().min(1).max(50)).max(50).default([]),
  preferredCuisines: z.array(z.string().min(1).max(50)).max(20).default([]),
  defaultServings: z.number().int().min(1).max(50).default(2),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
