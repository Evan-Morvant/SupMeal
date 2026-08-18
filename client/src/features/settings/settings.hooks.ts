import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { keys } from '../../api/query-keys';
import type { OAuthAccount, UserPreferences } from '../../api/types';
import * as settingsApi from './settings.api';

export function usePreferences(): UseQueryResult<UserPreferences> {
  return useQuery({ queryKey: keys.preferences, queryFn: settingsApi.getPreferences });
}

export function useOAuthAccounts(): UseQueryResult<OAuthAccount[]> {
  return useQuery({ queryKey: keys.oauthAccounts, queryFn: settingsApi.listOAuthAccounts });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.updateProfile,
    // Le nom affiché figure dans le rail et sur chaque message signé.
    onSuccess: (user) => queryClient.setQueryData(keys.me, user),
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: settingsApi.changePassword });
}

export function useReplacePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.replacePreferences,
    onSuccess: (preferences) => {
      queryClient.setQueryData(keys.preferences, preferences);
      // Les suggestions s'appuient sur le régime, les allergies et les cuisines.
      void queryClient.invalidateQueries({ queryKey: keys.suggestions });
    },
  });
}

export function useUnlinkOAuthAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.unlinkOAuthAccount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.oauthAccounts }),
  });
}
