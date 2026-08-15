import { Transaction } from 'sequelize';
import { sequelize } from '../../config/database';
import { Recipe, Review, User } from '../../models';
import { AppError } from '../../common/app-error';
import type { ReviewInput } from './reviews.schemas';

/** Avis accompagné de son auteur, pour l'affichage de la liste. */
const AUTHOR_INCLUDE = [{ model: User, as: 'author' }];

export interface ReviewList {
  avgRating: number | null;
  reviewCount: number;
  items: Review[];
}

/** Avis du plus récent au plus ancien. Les agrégats sont lus sur la recette. */
export async function listReviews(recipe: Recipe): Promise<ReviewList> {
  const items = await Review.findAll({
    where: { recipeId: recipe.id },
    include: AUTHOR_INCLUDE,
    order: [['createdAt', 'DESC']],
  });

  return {
    avgRating: recipe.avgRating === null ? null : Number(recipe.avgRating),
    reviewCount: recipe.reviewCount,
    items,
  };
}

/**
 * Dépose l'avis, ou remplace le sien : l'unicité par couple (recette,
 * utilisateur) est une règle du modèle, pas une erreur à signaler.
 */
export async function upsertReview(
  recipe: Recipe,
  userId: string,
  input: ReviewInput,
): Promise<Review> {
  // Sa voix pèserait sur une moyenne qui sert à départager les recettes.
  if (recipe.ownerId === userId) {
    throw new AppError(403, 'FORBIDDEN', 'On ne note pas sa propre recette');
  }

  const values = { rating: input.rating, body: input.body ?? null };

  const review = await sequelize.transaction(async (transaction) => {
    // findOrCreate encaisse la violation d'unicité de deux envois simultanés
    // en relisant la ligne gagnante, mais ne met rien à jour : la réécriture
    // reste à notre charge.
    const [saved, created] = await Review.findOrCreate({
      where: { recipeId: recipe.id, userId },
      defaults: { recipeId: recipe.id, userId, ...values },
      transaction,
    });
    if (!created) {
      await saved.update(values, { transaction });
    }

    await refreshRating(recipe.id, transaction);
    return saved;
  });

  return (await Review.findByPk(review.id, { include: AUTHOR_INCLUDE }))!;
}

/** Suppression : chacun ne dispose que de son propre avis. */
export async function deleteReview(recipeId: string, userId: string): Promise<void> {
  await sequelize.transaction(async (transaction) => {
    const removed = await Review.destroy({ where: { recipeId, userId }, transaction });
    if (removed === 0) {
      throw new AppError(404, 'REVIEW_NOT_FOUND', 'Vous n avez pas d avis sur cette recette');
    }
    await refreshRating(recipeId, transaction);
  });
}

/**
 * Recalcule les agrégats portés par la recette (cf. migration 0004). Le SQL
 * brut laisse `updated_at` intact : noter une recette ne la modifie pas.
 */
async function refreshRating(recipeId: string, transaction: Transaction): Promise<void> {
  await sequelize.query(
    `UPDATE recipes SET
       avg_rating   = agg.avg_rating,
       review_count = agg.review_count
     FROM (
       SELECT round(avg(rating), 2) AS avg_rating, count(*) AS review_count
       FROM reviews WHERE recipe_id = :recipeId
     ) AS agg
     WHERE recipes.id = :recipeId`,
    { replacements: { recipeId }, transaction },
  );
}
