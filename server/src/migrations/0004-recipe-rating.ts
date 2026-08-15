import type { Migration } from '../db/migrator';

/**
 * Note moyenne et nombre d'avis, tenus sur la recette plutôt que calculés à la
 * lecture : la découverte trie par note, et un `AVG` sur `reviews` imposerait
 * un regroupement de toute la table avant de pouvoir ordonner. Les colonnes
 * sont donc rafraîchies à l'écriture d'un avis, opération bien plus rare.
 *
 * `avg_rating` reste nul sans avis : non notée n'est pas notée zéro.
 */
export const up: Migration = async ({ context: sequelize }) => {
  await sequelize.query(`
    ALTER TABLE recipes
      ADD COLUMN avg_rating   numeric(3,2),
      ADD COLUMN review_count integer NOT NULL DEFAULT 0;

    CREATE INDEX recipes_rating_idx ON recipes (avg_rating DESC NULLS LAST)
      WHERE visibility = 'public';
  `);
};

export const down: Migration = async ({ context: sequelize }) => {
  await sequelize.query(`
    DROP INDEX IF EXISTS recipes_rating_idx;
    ALTER TABLE recipes
      DROP COLUMN IF EXISTS avg_rating,
      DROP COLUMN IF EXISTS review_count;
  `);
};
