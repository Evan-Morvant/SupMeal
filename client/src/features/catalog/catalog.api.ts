import { api } from '../../api/client';
import type { Ingredient, Tag, TagType } from '../../api/types';

/** Recherche par fragment : « olive » retrouve « huile d'olive ». */
export async function searchIngredients(q: string, limit = 20): Promise<Ingredient[]> {
  const { data } = await api.get<Ingredient[]>('/ingredients', { params: { q, limit } });
  return data;
}

/**
 * `mine` limite aux tags portés par une recette accessible : ce qu'il faut à
 * un filtre, jamais à l'autocomplétion d'un formulaire.
 */
export async function listTags(options: { type?: TagType; mine?: boolean } = {}): Promise<Tag[]> {
  const { data } = await api.get<Tag[]>('/tags', {
    params: { type: options.type, mine: options.mine === true ? 'true' : undefined },
  });
  return data;
}
