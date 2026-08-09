import { z } from 'zod';
import { recipeFilterFields } from '../recipes/recipes.schemas';

/** Schémas de validation du module cookbooks. */

const cookbookFields = {
  name: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
};

export const createCookbookSchema = z.object(cookbookFields);

export const updateCookbookSchema = z
  .object({ ...cookbookFields, name: cookbookFields.name.optional() })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Aucun champ à modifier',
  });

/**
 * Recherche interne au cookbook : mêmes critères que la liste générale, sans
 * `cookbookId` puisque le cookbook est déjà désigné par l'URL.
 */
export const listCookbookRecipesSchema = z.object(recipeFilterFields);

const roleSchema = z.enum(['OWNER', 'EDITOR', 'COMMENTER', 'READER']);

export const updateMemberRoleSchema = z.object({ role: roleSchema });

export const inviteMemberSchema = z.object({
  email: z.string().email().max(255),
  role: roleSchema.default('READER'),
});

export const cookbookParamsSchema = z.object({ id: z.string().uuid() });

export const cookbookRecipeParamsSchema = z.object({
  id: z.string().uuid(),
  recipeId: z.string().uuid(),
});

export const memberParamsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

export const invitationParamsSchema = z.object({
  id: z.string().uuid(),
  invId: z.string().uuid(),
});

export type CreateCookbookInput = z.infer<typeof createCookbookSchema>;
export type UpdateCookbookInput = z.infer<typeof updateCookbookSchema>;
export type ListCookbookRecipesQuery = z.infer<typeof listCookbookRecipesSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
