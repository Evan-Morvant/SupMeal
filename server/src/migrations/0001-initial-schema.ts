import type { Migration } from '../db/migrator';

/**
 * Schéma initial complet de SUPMEAL (cf. docs/conception/03-schema-bdd.md).
 * Écrit en SQL brut pour exploiter les spécificités PostgreSQL non couvertes
 * par `sync()` : types ENUM, `tsvector` + index GIN, index partiel sur la
 * visibilité, contraintes CHECK, ON DELETE CASCADE et trigger de recherche
 * plein texte agrégeant titre + description + ingrédients.
 */
export const up: Migration = async ({ context: sequelize }) => {
  // Extension pour gen_random_uuid() (défaut des clés primaires UUID).
  await sequelize.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  // Types énumérés (partagés par plusieurs tables).
  await sequelize.query(`
    CREATE TYPE role_enum AS ENUM ('OWNER', 'EDITOR', 'COMMENTER', 'READER');
    CREATE TYPE invitation_status_enum AS ENUM ('pending', 'accepted', 'declined');
    CREATE TYPE oauth_provider_enum AS ENUM ('google', 'github');
    CREATE TYPE recipe_visibility_enum AS ENUM ('private', 'public');
    CREATE TYPE meal_type_enum AS ENUM ('petit-déjeuner', 'déjeuner', 'dîner', 'collation');
    CREATE TYPE tag_type_enum AS ENUM ('cuisine', 'diet', 'difficulty', 'course', 'custom');
  `);

  // --- Utilisateurs ---
  await sequelize.query(`
    CREATE TABLE users (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email         varchar(255) NOT NULL UNIQUE,
      password_hash varchar(255),
      display_name  varchar(255) NOT NULL,
      avatar_url    varchar(255),
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE user_preferences (
      id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id            uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      diets              text[] NOT NULL DEFAULT '{}',
      allergies          text[] NOT NULL DEFAULT '{}',
      preferred_cuisines text[] NOT NULL DEFAULT '{}',
      default_servings   integer NOT NULL DEFAULT 2
    );

    CREATE TABLE oauth_accounts (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider         oauth_provider_enum NOT NULL,
      provider_user_id varchar(255) NOT NULL,
      created_at       timestamptz NOT NULL DEFAULT now(),
      UNIQUE (provider, provider_user_id)
    );
  `);

  // --- Cookbooks & membres ---
  await sequelize.query(`
    CREATE TABLE cookbooks (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name        varchar(255) NOT NULL,
      description text,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE cookbook_memberships (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      cookbook_id uuid NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
      user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role        role_enum NOT NULL DEFAULT 'READER',
      joined_at   timestamptz NOT NULL DEFAULT now(),
      UNIQUE (cookbook_id, user_id)
    );

    CREATE TABLE cookbook_invitations (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      cookbook_id   uuid NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
      invited_email varchar(255) NOT NULL,
      role          role_enum NOT NULL DEFAULT 'READER',
      token         varchar(255) NOT NULL UNIQUE,
      status        invitation_status_enum NOT NULL DEFAULT 'pending',
      created_at    timestamptz NOT NULL DEFAULT now()
    );
  `);

  // --- Recettes & contenu ---
  await sequelize.query(`
    CREATE TABLE recipes (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title         varchar(255) NOT NULL,
      description   text,
      prep_time_min integer,
      cook_time_min integer,
      servings      integer,
      image_url     varchar(255),
      source        varchar(255),
      visibility    recipe_visibility_enum NOT NULL DEFAULT 'private',
      search_vector tsvector,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX recipes_owner_idx ON recipes (owner_id);
    CREATE INDEX recipes_search_idx ON recipes USING GIN (search_vector);
    CREATE INDEX recipes_public_idx ON recipes (created_at DESC) WHERE visibility = 'public';

    CREATE TABLE cookbook_recipes (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      cookbook_id uuid NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
      recipe_id   uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      added_by    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      added_at    timestamptz NOT NULL DEFAULT now(),
      UNIQUE (cookbook_id, recipe_id)
    );
    CREATE INDEX cookbook_recipes_recipe_idx ON cookbook_recipes (recipe_id);

    CREATE TABLE recipe_steps (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      recipe_id   uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      position    integer NOT NULL,
      instruction text NOT NULL
    );
    CREATE INDEX recipe_steps_recipe_idx ON recipe_steps (recipe_id);

    CREATE TABLE ingredients (
      id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(255) NOT NULL UNIQUE
    );

    CREATE TABLE recipe_ingredients (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      recipe_id     uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
      quantity      numeric(10, 2),
      unit          varchar(255),
      note          varchar(255),
      position      integer NOT NULL DEFAULT 0
    );
    CREATE INDEX recipe_ingredients_recipe_idx ON recipe_ingredients (recipe_id);
    CREATE INDEX recipe_ingredients_ingredient_idx ON recipe_ingredients (ingredient_id);

    CREATE TABLE tags (
      id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(255) NOT NULL,
      type tag_type_enum NOT NULL DEFAULT 'custom',
      UNIQUE (name, type)
    );

    CREATE TABLE recipe_tags (
      recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      tag_id    uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (recipe_id, tag_id)
    );
  `);

  // --- Favoris, planning, interactions ---
  await sequelize.query(`
    CREATE TABLE favorites (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipe_id  uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, recipe_id)
    );

    CREATE TABLE meal_plan_entries (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cookbook_id uuid REFERENCES cookbooks(id) ON DELETE CASCADE,
      recipe_id   uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      date        date NOT NULL,
      meal_type   meal_type_enum NOT NULL,
      servings    integer
    );
    CREATE INDEX meal_plan_user_date_idx ON meal_plan_entries (user_id, date);
    CREATE INDEX meal_plan_cookbook_date_idx ON meal_plan_entries (cookbook_id, date);

    CREATE TABLE comments (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      recipe_id   uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      cookbook_id uuid NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
      user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content     text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX comments_recipe_cookbook_idx ON comments (recipe_id, cookbook_id);

    CREATE TABLE reviews (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      recipe_id  uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating     smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
      body       text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (recipe_id, user_id)
    );

    CREATE TABLE messages (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      cookbook_id uuid NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
      user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content     text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX messages_cookbook_created_idx ON messages (cookbook_id, created_at);
  `);

  // --- Listes de courses (bonus) ---
  await sequelize.query(`
    CREATE TABLE shopping_lists (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      cookbook_id uuid REFERENCES cookbooks(id) ON DELETE CASCADE,
      user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        varchar(255) NOT NULL,
      from_date   date,
      to_date     date,
      created_at  timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE shopping_list_items (
      id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      shopping_list_id uuid NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
      ingredient_id    uuid NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
      quantity         numeric(10, 2),
      unit             varchar(255),
      checked          boolean NOT NULL DEFAULT false
    );
    CREATE INDEX shopping_list_items_list_idx ON shopping_list_items (shopping_list_id);
  `);

  // --- Recherche plein texte : maintien du tsvector par trigger ---
  // Le vecteur agrège titre (poids A), description (B) et noms d'ingrédients (C).
  await sequelize.query(`
    CREATE FUNCTION supmeal_refresh_recipe_search_vector(rid uuid)
    RETURNS void AS $$
    BEGIN
      UPDATE recipes r SET search_vector =
          setweight(to_tsvector('french', coalesce(r.title, '')), 'A')
        || setweight(to_tsvector('french', coalesce(r.description, '')), 'B')
        || setweight(to_tsvector('french', coalesce((
             SELECT string_agg(i.name, ' ')
             FROM recipe_ingredients ri
             JOIN ingredients i ON i.id = ri.ingredient_id
             WHERE ri.recipe_id = r.id
           ), '')), 'C')
      WHERE r.id = rid;
    END;
    $$ LANGUAGE plpgsql;

    CREATE FUNCTION supmeal_recipes_search_trigger()
    RETURNS trigger AS $$
    BEGIN
      PERFORM supmeal_refresh_recipe_search_vector(NEW.id);
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_recipes_search
    AFTER INSERT OR UPDATE OF title, description ON recipes
    FOR EACH ROW EXECUTE FUNCTION supmeal_recipes_search_trigger();

    CREATE FUNCTION supmeal_recipe_ingredients_search_trigger()
    RETURNS trigger AS $$
    BEGIN
      PERFORM supmeal_refresh_recipe_search_vector(COALESCE(NEW.recipe_id, OLD.recipe_id));
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_recipe_ingredients_search
    AFTER INSERT OR UPDATE OR DELETE ON recipe_ingredients
    FOR EACH ROW EXECUTE FUNCTION supmeal_recipe_ingredients_search_trigger();
  `);

  // --- Données de référence ---
  // Catégories de plat modélisées comme des tags de type 'course' (extensibles
  // sans migration). ON CONFLICT rend l'insertion rejouable sans erreur.
  await sequelize.query(`
    INSERT INTO tags (name, type) VALUES
      ('Entrée', 'course'),
      ('Plat principal', 'course'),
      ('Dessert', 'course'),
      ('Accompagnement', 'course'),
      ('Apéritif', 'course'),
      ('Boisson', 'course')
    ON CONFLICT (name, type) DO NOTHING;
  `);
};

export const down: Migration = async ({ context: sequelize }) => {
  await sequelize.query(`
    DROP TRIGGER IF EXISTS trg_recipe_ingredients_search ON recipe_ingredients;
    DROP TRIGGER IF EXISTS trg_recipes_search ON recipes;
    DROP FUNCTION IF EXISTS supmeal_recipe_ingredients_search_trigger();
    DROP FUNCTION IF EXISTS supmeal_recipes_search_trigger();
    DROP FUNCTION IF EXISTS supmeal_refresh_recipe_search_vector(uuid);
  `);

  await sequelize.query(`
    DROP TABLE IF EXISTS shopping_list_items CASCADE;
    DROP TABLE IF EXISTS shopping_lists CASCADE;
    DROP TABLE IF EXISTS messages CASCADE;
    DROP TABLE IF EXISTS reviews CASCADE;
    DROP TABLE IF EXISTS comments CASCADE;
    DROP TABLE IF EXISTS meal_plan_entries CASCADE;
    DROP TABLE IF EXISTS favorites CASCADE;
    DROP TABLE IF EXISTS recipe_tags CASCADE;
    DROP TABLE IF EXISTS tags CASCADE;
    DROP TABLE IF EXISTS recipe_ingredients CASCADE;
    DROP TABLE IF EXISTS ingredients CASCADE;
    DROP TABLE IF EXISTS recipe_steps CASCADE;
    DROP TABLE IF EXISTS cookbook_recipes CASCADE;
    DROP TABLE IF EXISTS recipes CASCADE;
    DROP TABLE IF EXISTS cookbook_invitations CASCADE;
    DROP TABLE IF EXISTS cookbook_memberships CASCADE;
    DROP TABLE IF EXISTS cookbooks CASCADE;
    DROP TABLE IF EXISTS oauth_accounts CASCADE;
    DROP TABLE IF EXISTS user_preferences CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `);

  await sequelize.query(`
    DROP TYPE IF EXISTS tag_type_enum;
    DROP TYPE IF EXISTS meal_type_enum;
    DROP TYPE IF EXISTS recipe_visibility_enum;
    DROP TYPE IF EXISTS oauth_provider_enum;
    DROP TYPE IF EXISTS invitation_status_enum;
    DROP TYPE IF EXISTS role_enum;
  `);
};
