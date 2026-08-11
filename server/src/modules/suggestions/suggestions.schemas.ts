import { z } from 'zod';

/**
 * Une page de suggestions s'affiche d'un coup d'œil : le plafond est bas à
 * dessein, une liste de cinquante propositions ne suggérerait plus rien.
 */
export const listSuggestionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export type ListSuggestionsQuery = z.infer<typeof listSuggestionsSchema>;
