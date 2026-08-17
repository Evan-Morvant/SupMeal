import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { keys } from '../../api/query-keys';
import type { Comment } from '../../api/types';
import * as commentsApi from './comments.api';

export function useComments(
  cookbookId: string,
  recipeId: string,
): UseQueryResult<Comment[]> {
  return useQuery({
    queryKey: keys.comments(cookbookId, recipeId),
    queryFn: () => commentsApi.listComments(cookbookId, recipeId),
  });
}

function useThreadMutation<TVariables>(
  cookbookId: string,
  recipeId: string,
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: keys.comments(cookbookId, recipeId) }),
  });
}

export function useAddComment(cookbookId: string, recipeId: string) {
  return useThreadMutation(cookbookId, recipeId, (content: string) =>
    commentsApi.addComment(cookbookId, recipeId, content),
  );
}

export function useUpdateComment(cookbookId: string, recipeId: string) {
  return useThreadMutation(
    cookbookId,
    recipeId,
    ({ commentId, content }: { commentId: string; content: string }) =>
      commentsApi.updateComment(commentId, content),
  );
}

export function useDeleteComment(cookbookId: string, recipeId: string) {
  return useThreadMutation(cookbookId, recipeId, (commentId: string) =>
    commentsApi.deleteComment(commentId),
  );
}
