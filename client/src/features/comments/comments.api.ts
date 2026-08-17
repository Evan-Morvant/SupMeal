import { api } from '../../api/client';
import type { Comment } from '../../api/types';

/* Commentaires rattachés au couple (recette, cookbook). */

function thread(cookbookId: string, recipeId: string): string {
  return '/cookbooks/' + cookbookId + '/recipes/' + recipeId + '/comments';
}

export async function listComments(cookbookId: string, recipeId: string): Promise<Comment[]> {
  const { data } = await api.get<Comment[]>(thread(cookbookId, recipeId));
  return data;
}

export async function addComment(
  cookbookId: string,
  recipeId: string,
  content: string,
): Promise<Comment> {
  const { data } = await api.post<Comment>(thread(cookbookId, recipeId), { content });
  return data;
}

/** Modification réservée à l'auteur : personne ne réécrit les propos d'autrui. */
export async function updateComment(commentId: string, content: string): Promise<Comment> {
  const { data } = await api.patch<Comment>('/comments/' + commentId, { content });
  return data;
}

/** Suppression : l'auteur, ou le créateur du cookbook au titre de la modération. */
export async function deleteComment(commentId: string): Promise<void> {
  await api.delete('/comments/' + commentId);
}
