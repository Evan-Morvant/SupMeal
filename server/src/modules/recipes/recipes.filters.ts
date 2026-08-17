import { Op, Order, WhereOptions, literal } from 'sequelize';
import { sequelize } from '../../models';
import { matchName } from '../../common/normalize';
import { ROLE_LEVEL } from '../../middlewares/require-role';
import type { DiscoverRecipesQuery, ListRecipesQuery, RecipeFilters } from './recipes.schemas';

/**
 * Construction des conditions SQL de recherche.
 *
 * Les filtres s'expriment en sous-requêtes corrélées plutôt qu'en jointures :
 * une jointure par tag et par ingrédient multiplierait les lignes et fausserait
 * le comptage comme la pagination. Chaque sous-requête s'appuie sur un index
 * existant (`recipe_tags` en clé primaire, `recipe_ingredients_recipe_idx`,
 * `recipes_search_idx` en GIN).
 *
 * Toute valeur venue du client passe par `sequelize.escape` : c'est ce qui rend
 * ces littéraux sûrs vis-à-vis de l'injection SQL.
 */

/** Échappe une valeur client pour l'insérer dans un littéral SQL. */
function quote(value: string | number): string {
  return sequelize.escape(value);
}

/** Liste échappée, prête pour un `IN (...)`. */
function quoteList(values: string[]): string {
  return values.map(quote).join(', ');
}

/**
 * Valeurs de filtre ramenées à leur forme de comparaison et dédupliquées :
 * le comptage qui exprime le ET se fait sur des noms distincts, un doublon
 * fixerait un seuil que la recette ne peut pas atteindre.
 */
function matchList(names: string[]): string[] {
  return [...new Set(names.map(matchName))];
}

/**
 * Périmètre de visibilité, en SQL brut : ses propres recettes, ou celles
 * rattachées à un cookbook dont on est membre — les recettes publiques
 * d'autrui relèvent de `/discover`. L'alias est un paramètre parce que le
 * catalogue de tags applique la même règle à une sous-requête sur `recipes`.
 */
export function accessibleRecipesSql(userId: string, recipe = '"Recipe"'): string {
  return `(
    ${recipe}."owner_id" = ${quote(userId)}
    OR EXISTS (
      SELECT 1
      FROM cookbook_recipes cr
      JOIN cookbook_memberships cm ON cm.cookbook_id = cr.cookbook_id
      WHERE cr.recipe_id = ${recipe}."id" AND cm.user_id = ${quote(userId)}
    )
  )`;
}

/** La même règle, prête à entrer dans un `where` Sequelize. */
export function accessibleRecipesCondition(userId: string) {
  return literal(accessibleRecipesSql(userId));
}

/** Rôles autorisés à modifier le contenu d'un cookbook, déduits de la hiérarchie. */
const EDIT_ROLES = Object.entries(ROLE_LEVEL)
  .filter(([, level]) => level >= ROLE_LEVEL.EDITOR)
  .map(([role]) => role);

/**
 * Droit de modification hérité d'un cookbook : être Éditeur ou Créateur d'un
 * cookbook où la recette est rangée. Le partage dans un groupe emporte le
 * droit de corriger.
 */
export function editableRecipesCondition(userId: string) {
  return literal(`EXISTS (
    SELECT 1
    FROM cookbook_recipes cr
    JOIN cookbook_memberships cm ON cm.cookbook_id = cr.cookbook_id
    WHERE cr.recipe_id = "Recipe"."id"
      AND cm.user_id = ${quote(userId)}
      AND cm.role IN (${quoteList(EDIT_ROLES)})
  )`);
}

/**
 * Recettes portant **tous** les tags demandés. Le comptage des
 * correspondances distinctes exprime le ET
 */
function allTagsCondition(names: string[]) {
  const wanted = matchList(names);
  return literal(`(
    SELECT COUNT(DISTINCT t.id)
    FROM recipe_tags rt
    JOIN tags t ON t.id = rt.tag_id
    WHERE rt.recipe_id = "Recipe"."id" AND lower(t.name) IN (${quoteList(wanted)})
  ) = ${wanted.length}`);
}

/**
 * Recettes contenant **tous** les ingrédients demandés
 */
function allIngredientsCondition(names: string[]) {
  const wanted = matchList(names);
  return literal(`(
    SELECT COUNT(DISTINCT i.id)
    FROM recipe_ingredients ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    WHERE ri.recipe_id = "Recipe"."id" AND i.name IN (${quoteList(wanted)})
  ) = ${wanted.length}`);
}

/** Recherche plein texte sur le tsvector maintenu par trigger. */
function fullTextCondition(q: string) {
  return literal(`"Recipe"."search_vector" @@ plainto_tsquery('french', ${quote(q)})`);
}

/**
 * Appartenance à un cookbook donné. Aucun contrôle d'appartenance ici : le
 * périmètre de visibilité s'applique de toute façon, donc filtrer sur un
 * cookbook dont on n'est pas membre rend une liste vide, sans rien divulguer.
 */
export function inCookbookCondition(cookbookId: string) {
  return literal(`EXISTS (
    SELECT 1 FROM cookbook_recipes cr
    WHERE cr.recipe_id = "Recipe"."id" AND cr.cookbook_id = ${quote(cookbookId)}
  )`);
}

function isFavoriteCondition(userId: string) {
  return literal(`EXISTS (
    SELECT 1 FROM favorites f
    WHERE f.recipe_id = "Recipe"."id" AND f.user_id = ${quote(userId)}
  )`);
}

/**
 * Une recette sans temps renseigné ne peut pas satisfaire « moins de 30 min » :
 * `NULL` est exclu.
 */
function maxMinutesCondition(column: 'prep_time_min' | 'cook_time_min', minutes: number) {
  return literal(`"Recipe"."${column}" IS NOT NULL AND "Recipe"."${column}" <= ${quote(minutes)}`);
}

/** Recettes ouvertes à tous, périmètre de `/discover`. */
export function publicRecipesCondition() {
  return literal(`"Recipe"."visibility" = 'public'`);
}

/**
 * Filtres portant sur le contenu de la recette. Ils ne dépendent d'aucun
 * périmètre, et servent donc aussi bien la liste personnelle que la découverte.
 */
function contentConditions(query: RecipeFilters) {
  const conditions = [];

  if (query.q) {
    conditions.push(fullTextCondition(query.q));
  }
  if (query.tags?.length) {
    conditions.push(allTagsCondition(query.tags));
  }
  if (query.ingredients?.length) {
    conditions.push(allIngredientsCondition(query.ingredients));
  }
  if (query.maxPrep !== undefined) {
    conditions.push(maxMinutesCondition('prep_time_min', query.maxPrep));
  }
  if (query.maxCook !== undefined) {
    conditions.push(maxMinutesCondition('cook_time_min', query.maxCook));
  }

  return conditions;
}

/** Assemble le `WHERE` complet à partir du périmètre et des filtres demandés. */
export function buildRecipeWhere(userId: string, query: ListRecipesQuery): WhereOptions {
  const conditions = [accessibleRecipesCondition(userId), ...contentConditions(query)];

  if (query.cookbookId) {
    conditions.push(inCookbookCondition(query.cookbookId));
  }
  if (query.favorite) {
    conditions.push(isFavoriteCondition(userId));
  }

  return { [Op.and]: conditions };
}

/**
 * Même chose pour la découverte. `cookbookId` et `favorite` en sont absents :
 * ils désignent le périmètre d'un compte, qu'un visiteur n'a pas.
 */
export function buildPublicRecipeWhere(query: DiscoverRecipesQuery): WhereOptions {
  return { [Op.and]: [publicRecipesCondition(), ...contentConditions(query)] };
}

/**
 * Tri. La pertinence n'a de sens qu'avec une recherche plein texte : sans `q`,
 * `ts_rank` vaudrait zéro partout, on retombe donc sur les plus récentes.
 * Chaque périmètre restreint les valeurs qu'il accepte dans son schéma.
 */
export function buildRecipeOrder(query: RecipeFilters): Order {
  const sort = query.sort ?? (query.q ? 'relevance' : 'recent');

  if (sort === 'relevance' && query.q) {
    return [
      [
        literal(
          `ts_rank("Recipe"."search_vector", plainto_tsquery('french', ${quote(query.q)})) DESC`,
        ),
      ],
      ['createdAt', 'DESC'],
    ] as Order;
  }
  if (sort === 'prepTime') {
    return [[literal('"Recipe"."prep_time_min" ASC NULLS LAST')], ['createdAt', 'DESC']] as Order;
  }
  if (sort === 'rating') {
    // Sert l'index partiel `recipes_rating_idx`, posé sur les seules publiques.
    return [[literal('"Recipe"."avg_rating" DESC NULLS LAST')], ['createdAt', 'DESC']] as Order;
  }
  return [['createdAt', 'DESC']];
}
