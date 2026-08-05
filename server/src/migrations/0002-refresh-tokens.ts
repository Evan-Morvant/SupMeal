import type { Migration } from '../db/migrator';

/**
 * Table des refresh tokens. On ne stocke jamais le token en clair mais son
 * empreinte HMAC-SHA256 (64 caractères hex), ce qui permet la recherche indexée
 * tout en évitant qu'une fuite de la base ne révèle des tokens exploitables.
 * `revoked_at` matérialise la révocation (logout, rotation) sans supprimer la
 * ligne, utile pour l'audit et la détection de réutilisation.
 */
export const up: Migration = async ({ context: sequelize }) => {
  await sequelize.query(`
    CREATE TABLE refresh_tokens (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash varchar(64) NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
  `);
};

export const down: Migration = async ({ context: sequelize }) => {
  await sequelize.query(`DROP TABLE IF EXISTS refresh_tokens CASCADE;`);
};
