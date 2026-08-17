import { api } from '../../api/client';
import type { Review, ReviewList } from '../../api/types';

export interface ReviewInput {
  rating: number;
  body?: string | null;
}

/** Lecture ouverte aux visiteurs quand la recette est publique. */
export async function listReviews(recipeId: string): Promise<ReviewList> {
  const { data } = await api.get<ReviewList>('/recipes/' + recipeId + '/reviews');
  return data;
}

/**
 * Un avis par couple (recette, utilisateur) : le `PUT` dépose le sien ou le
 * remplace, d'où l'absence de `POST`.
 */
export async function saveReview(recipeId: string, input: ReviewInput): Promise<Review> {
  const { data } = await api.put<Review>('/recipes/' + recipeId + '/reviews', input);
  return data;
}

export async function deleteReview(recipeId: string): Promise<void> {
  await api.delete('/recipes/' + recipeId + '/reviews');
}
