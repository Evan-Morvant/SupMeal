import { z } from 'zod';

/** Le contenu est le seul champ libre : auteur, recette et cookbook viennent du contexte. */
export const commentSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const commentParamsSchema = z.object({ commentId: z.string().uuid() });

export type CommentInput = z.infer<typeof commentSchema>;
