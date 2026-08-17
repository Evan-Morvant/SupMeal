import { api } from '../../api/client';
import type {
  Cookbook,
  CreatedInvitation,
  Invitation,
  Membership,
  Page,
  Recipe,
  RecipeFilters,
  RecipeInput,
  RecipeSummary,
  Role,
} from '../../api/types';

export interface CookbookInput {
  name: string;
  description?: string | null;
}

export async function listCookbooks(): Promise<Cookbook[]> {
  const { data } = await api.get<Cookbook[]>('/cookbooks');
  return data;
}

export async function getCookbook(id: string): Promise<Cookbook> {
  const { data } = await api.get<Cookbook>('/cookbooks/' + id);
  return data;
}

export async function createCookbook(input: CookbookInput): Promise<Cookbook> {
  const { data } = await api.post<Cookbook>('/cookbooks', input);
  return data;
}

export async function updateCookbook(id: string, input: CookbookInput): Promise<Cookbook> {
  const { data } = await api.patch<Cookbook>('/cookbooks/' + id, input);
  return data;
}

/** Supprime le cookbook, jamais les recettes qu'il rassemblait. */
export async function deleteCookbook(id: string): Promise<void> {
  await api.delete('/cookbooks/' + id);
}

/* --- Recettes rangées dans le cookbook --- */

export async function listCookbookRecipes(
  id: string,
  filters: RecipeFilters,
): Promise<Page<RecipeSummary>> {
  const { data } = await api.get<Page<RecipeSummary>>('/cookbooks/' + id + '/recipes', {
    params: filters,
  });
  return data;
}

/** Crée la recette et la range dans le cookbook, en une seule requête. */
export async function createRecipeInCookbook(
  id: string,
  input: RecipeInput,
): Promise<Recipe> {
  const { data } = await api.post<Recipe>('/cookbooks/' + id + '/recipes', input);
  return data;
}

/** Range une recette existante dans le cookbook. */
export async function linkRecipe(id: string, recipeId: string): Promise<void> {
  await api.put('/cookbooks/' + id + '/recipes/' + recipeId);
}

/** Retire la liaison : la recette elle-même reste à son créateur. */
export async function unlinkRecipe(id: string, recipeId: string): Promise<void> {
  await api.delete('/cookbooks/' + id + '/recipes/' + recipeId);
}

/* --- Membres --- */

export async function listMembers(id: string): Promise<Membership[]> {
  const { data } = await api.get<Membership[]>('/cookbooks/' + id + '/members');
  return data;
}

export async function setMemberRole(id: string, userId: string, role: Role): Promise<Membership> {
  const { data } = await api.patch<Membership>('/cookbooks/' + id + '/members/' + userId, {
    role,
  });
  return data;
}

export async function removeMember(id: string, userId: string): Promise<void> {
  await api.delete('/cookbooks/' + id + '/members/' + userId);
}

export async function leaveCookbook(id: string): Promise<void> {
  await api.delete('/cookbooks/' + id + '/members/me');
}

/* --- Invitations --- */

export async function listInvitations(id: string): Promise<Invitation[]> {
  const { data } = await api.get<Invitation[]>('/cookbooks/' + id + '/invitations');
  return data;
}

/**
 * Le lien d'acceptation n'est rendu **qu'ici** : le token est stocké haché et
 * ne pourra plus être relu. L'écran doit donc le donner à copier tout de suite.
 */
export async function inviteMember(
  id: string,
  input: { email: string; role: Role },
): Promise<CreatedInvitation> {
  const { data } = await api.post<CreatedInvitation>('/cookbooks/' + id + '/invitations', input);
  return data;
}

export async function revokeInvitation(id: string, invitationId: string): Promise<void> {
  await api.delete('/cookbooks/' + id + '/invitations/' + invitationId);
}

export async function acceptInvitation(token: string): Promise<Membership> {
  const { data } = await api.post<Membership>('/invitations/' + token + '/accept');
  return data;
}

export async function declineInvitation(token: string): Promise<void> {
  await api.post('/invitations/' + token + '/decline');
}
