import type { DiscoverFilters, RecipeFilters, TagType } from './types';

/*
 * Clés de cache rassemblées ici pour que les invalidations visent juste :
 * un `invalidateQueries(['recipe', id])` écrit à la main dans dix mutations
 * finit toujours par diverger de la clé employée à la lecture.
 *
 * Les clés sont hiérarchiques : invalider ['cookbook', id] invalide aussi ses
 * membres, ses recettes et son fil de discussion.
 */
export const keys = {
  me: ['me'] as const,
  preferences: ['me', 'preferences'] as const,
  oauthAccounts: ['me', 'oauth'] as const,

  recipes: (filters: RecipeFilters) => ['recipes', filters] as const,
  recipe: (id: string) => ['recipe', id] as const,
  suggestions: ['suggestions'] as const,
  reviews: (recipeId: string) => ['recipe', recipeId, 'reviews'] as const,

  discover: (filters: DiscoverFilters) => ['discover', filters] as const,
  discoverRecipe: (id: string) => ['discover', 'recipe', id] as const,

  cookbooks: ['cookbooks'] as const,
  cookbook: (id: string) => ['cookbook', id] as const,
  cookbookRecipes: (id: string, filters: RecipeFilters) =>
    ['cookbook', id, 'recipes', filters] as const,
  members: (id: string) => ['cookbook', id, 'members'] as const,
  invitations: (id: string) => ['cookbook', id, 'invitations'] as const,
  comments: (cookbookId: string, recipeId: string) =>
    ['cookbook', cookbookId, 'comments', recipeId] as const,
  messages: (cookbookId: string) => ['cookbook', cookbookId, 'messages'] as const,

  mealPlan: (from: string, to: string, cookbookId?: string) =>
    ['meal-plan', from, to, cookbookId ?? 'me'] as const,
  shoppingLists: ['shopping-lists'] as const,
  shoppingList: (id: string) => ['shopping-list', id] as const,

  tags: (type?: TagType, mine?: boolean) =>
    ['tags', type ?? 'all', mine === true ? 'mine' : 'catalogue'] as const,
  ingredients: (q: string) => ['ingredients', q] as const,
};
