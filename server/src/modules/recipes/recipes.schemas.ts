import { z } from 'zod';
import { booleanParam } from '../../common/schemas';

/** Schémas de validation des corps de requête du module recipes. */

/**
 * Ligne d'ingrédient. `quantity` reste facultative : « sel », « poivre » ou
 * « quelques feuilles de basilic » n'en ont pas, et l'imposer forcerait une
 * valeur mensongère. La précision libre passe par `note`.
 */
const ingredientLineSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().positive().max(1000000).nullable().optional(),
  unit: z.string().min(1).max(30).nullable().optional(),
  note: z.string().max(255).nullable().optional(),
});

/** Champs communs à la création et à la modification. */
const recipeFields = {
  description: z.string().max(5000).nullable().optional(),
  prepTimeMin: z.number().int().min(0).max(10000).nullable().optional(),
  cookTimeMin: z.number().int().min(0).max(10000).nullable().optional(),
  servings: z.number().int().min(1).max(100).nullable().optional(),
  source: z.string().max(2048).nullable().optional(),
  visibility: z.enum(['private', 'public']).optional(),
  ingredients: z.array(ingredientLineSchema).max(100).optional(),
  steps: z.array(z.string().min(1).max(2000)).max(100).optional(),
  tags: z.array(z.string().min(1).max(50)).max(30).optional(),
};

export const createRecipeSchema = z.object({
  title: z.string().min(1).max(255),
  ...recipeFields,
});

/**
 * Modification partielle des champs simples ; toute collection **présente**
 * remplace intégralement l'ancienne, toute collection absente est conservée.
 */
export const updateRecipeSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    ...recipeFields,
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Aucun champ à modifier',
  });

/** Liste séparée par des virgules : « tomate, basilic » -> ['tomate', 'basilic']. */
const csvSchema = z
  .string()
  .max(500)
  .transform((raw) =>
    raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  )
  .pipe(z.array(z.string().min(1).max(120)).max(20));

/**
 * Critères de recherche communs à `/recipes` et à la recherche interne d'un
 * cookbook, qui ne diffèrent que par la façon de désigner le cookbook :
 * paramètre de requête ici, segment d'URL là-bas.
 */
export const recipeFilterFields = {
  q: z.string().min(1).max(200).optional(),
  tags: csvSchema.optional(),
  ingredients: csvSchema.optional(),
  maxPrep: z.coerce.number().int().min(0).max(10000).optional(),
  maxCook: z.coerce.number().int().min(0).max(10000).optional(),
  favorite: booleanParam.optional(),
  sort: z.enum(['relevance', 'recent', 'prepTime']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const listRecipesSchema = z.object({
  cookbookId: z.string().uuid().optional(),
  ...recipeFilterFields,
});

/**
 * Critères de découverte. Ni `cookbookId` ni `favorite` : ils désignent le
 * périmètre d'un compte, qu'un visiteur n'a pas. Le tri par note remplace le
 * tri par temps de préparation.
 */
export const discoverRecipesSchema = z.object({
  q: recipeFilterFields.q,
  tags: recipeFilterFields.tags,
  sort: z.enum(['relevance', 'rating', 'recent']).optional(),
  page: recipeFilterFields.page,
  pageSize: recipeFilterFields.pageSize,
});

/**
 * Ce que les constructeurs de requête SQL lisent réellement, indépendamment du
 * périmètre : chaque schéma en restreint les valeurs à ce qu'il accepte.
 */
export interface RecipeFilters {
  q?: string;
  tags?: string[];
  ingredients?: string[];
  maxPrep?: number;
  maxCook?: number;
  sort?: 'relevance' | 'recent' | 'prepTime' | 'rating';
  page: number;
  pageSize: number;
}

export type IngredientLineInput = z.infer<typeof ingredientLineSchema>;
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;
export type ListRecipesQuery = z.infer<typeof listRecipesSchema>;
export type DiscoverRecipesQuery = z.infer<typeof discoverRecipesSchema>;
