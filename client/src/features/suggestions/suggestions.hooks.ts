import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { keys } from '../../api/query-keys';
import type { Suggestion } from '../../api/types';
import * as suggestionsApi from './suggestions.api';

export function useSuggestions(enabled: boolean): UseQueryResult<Suggestion[]> {
  return useQuery({
    queryKey: keys.suggestions,
    queryFn: () => suggestionsApi.listSuggestions(),
    enabled,
  });
}
