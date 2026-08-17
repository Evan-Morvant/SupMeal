import { api } from '../../api/client';
import type { Suggestion } from '../../api/types';

/**
 * Recettes proposées, chacune accompagnée de ses motifs en clair : un
 * classement qu'on ne sait pas expliquer n'a pas sa place devant l'utilisateur.
 * Le vivier est celui qu'il peut lire — on ne suggère jamais un 403.
 */
export async function listSuggestions(limit = 6): Promise<Suggestion[]> {
  const { data } = await api.get<Suggestion[]>('/recipes/suggestions', { params: { limit } });
  return data;
}
