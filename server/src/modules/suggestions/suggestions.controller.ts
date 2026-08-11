import { Request, Response } from 'express';
import { serializeRecipeSummary } from '../../common/serialize';
import * as suggestionsService from './suggestions.service';
import type { ListSuggestionsQuery } from './suggestions.schemas';

/**
 * Les motifs accompagnent chaque suggestion : le client doit pouvoir dire
 * pourquoi une recette est proposée, sans quoi le classement ressemblerait à
 * un oracle.
 */
export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListSuggestionsQuery;
  const suggestions = await suggestionsService.suggestRecipes(req.user!.id, query);

  res.json(
    suggestions.map((suggestion) => ({
      recipe: serializeRecipeSummary(suggestion.recipe),
      score: suggestion.score,
      reasons: suggestion.reasons,
    })),
  );
}
