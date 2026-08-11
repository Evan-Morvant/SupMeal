import type { Migration } from '../db/migrator';

/**
 * Index de recherche pour l'autocomplétion des ingrédients.
 *
 * L'unicité de `name` s'appuie sur un btree, inutilisable pour un
 * `LIKE '%tomate%'` : PostgreSQL retomberait sur un parcours séquentiel de la
 * table à chaque frappe. L'index trigramme répond, lui, à une recherche par
 * fragment quelle que soit sa position dans le nom — ce qu'exige un ingrédient
 * composé comme « huile d'olive », qu'on cherche aussi bien par « huile » que
 * par « olive ».
 */
export const up: Migration = async ({ context: sequelize }) => {
  await sequelize.query(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE INDEX ingredients_name_trgm_idx ON ingredients USING GIN (name gin_trgm_ops);
  `);
};

export const down: Migration = async ({ context: sequelize }) => {
  // L'extension survit à l'annulation : d'autres objets pourraient en dépendre,
  // et la supprimer emporterait leurs index sans avertissement.
  await sequelize.query(`DROP INDEX IF EXISTS ingredients_name_trgm_idx;`);
};
