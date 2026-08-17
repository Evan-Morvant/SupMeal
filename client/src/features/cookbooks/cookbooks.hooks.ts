import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { keys } from '../../api/query-keys';
import type {
  Cookbook,
  Invitation,
  Membership,
  Page,
  RecipeFilters,
  RecipeInput,
  RecipeSummary,
  Role,
} from '../../api/types';
import * as cookbooksApi from './cookbooks.api';

export function useCookbooks(): UseQueryResult<Cookbook[]> {
  return useQuery({ queryKey: keys.cookbooks, queryFn: cookbooksApi.listCookbooks });
}

export function useCookbook(id: string | undefined): UseQueryResult<Cookbook> {
  return useQuery({
    queryKey: keys.cookbook(id ?? ''),
    queryFn: () => cookbooksApi.getCookbook(id as string),
    enabled: id !== undefined,
  });
}

export function useCookbookRecipes(
  id: string,
  filters: RecipeFilters,
): UseQueryResult<Page<RecipeSummary>> {
  return useQuery({
    queryKey: keys.cookbookRecipes(id, filters),
    queryFn: () => cookbooksApi.listCookbookRecipes(id, filters),
    placeholderData: keepPreviousData,
  });
}

export function useMembers(id: string): UseQueryResult<Membership[]> {
  return useQuery({ queryKey: keys.members(id), queryFn: () => cookbooksApi.listMembers(id) });
}

export function useInvitations(id: string, enabled: boolean): UseQueryResult<Invitation[]> {
  return useQuery({
    queryKey: keys.invitations(id),
    queryFn: () => cookbooksApi.listInvitations(id),
    enabled,
  });
}

export function useCreateCookbook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cookbooksApi.createCookbook,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.cookbooks }),
  });
}

/*
 * Les clés sont hiérarchiques : invalider ['cookbook', id] emporte ses membres,
 * ses recettes et ses invitations. La liste, elle, porte des compteurs que la
 * moindre de ces opérations déplace.
 */
function useCookbookMutation<TVariables, TResult>(
  id: string,
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.cookbook(id) });
      void queryClient.invalidateQueries({ queryKey: keys.cookbooks });
    },
  });
}

export function useUpdateCookbook(id: string) {
  return useCookbookMutation(id, (input: cookbooksApi.CookbookInput) =>
    cookbooksApi.updateCookbook(id, input),
  );
}

export function useDeleteCookbook(id: string) {
  return useCookbookMutation(id, () => cookbooksApi.deleteCookbook(id));
}

export function useCreateRecipeInCookbook(id: string) {
  return useCookbookMutation(id, (input: RecipeInput) =>
    cookbooksApi.createRecipeInCookbook(id, input),
  );
}

export function useLinkRecipe(id: string) {
  return useCookbookMutation(id, (recipeId: string) => cookbooksApi.linkRecipe(id, recipeId));
}

export function useUnlinkRecipe(id: string) {
  return useCookbookMutation(id, (recipeId: string) => cookbooksApi.unlinkRecipe(id, recipeId));
}

export function useSetMemberRole(id: string) {
  return useCookbookMutation(id, ({ userId, role }: { userId: string; role: Role }) =>
    cookbooksApi.setMemberRole(id, userId, role),
  );
}

export function useRemoveMember(id: string) {
  return useCookbookMutation(id, (userId: string) => cookbooksApi.removeMember(id, userId));
}

export function useLeaveCookbook(id: string) {
  return useCookbookMutation(id, () => cookbooksApi.leaveCookbook(id));
}

export function useInviteMember(id: string) {
  return useCookbookMutation(id, (input: { email: string; role: Role }) =>
    cookbooksApi.inviteMember(id, input),
  );
}

export function useRevokeInvitation(id: string) {
  return useCookbookMutation(id, (invitationId: string) =>
    cookbooksApi.revokeInvitation(id, invitationId),
  );
}

/** Acceptation : la liste des cookbooks s'enrichit, mais aucun n'était chargé. */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cookbooksApi.acceptInvitation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.cookbooks }),
  });
}

export function useDeclineInvitation() {
  return useMutation({ mutationFn: cookbooksApi.declineInvitation });
}
