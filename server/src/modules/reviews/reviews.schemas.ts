import { z } from 'zod';

/** La note est obligatoire, le texte non : noter sans écrire reste un avis. */
export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).nullable().optional(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
