import { Op, literal } from 'sequelize';
import { Ingredient, Tag, sequelize } from '../../models';
import type { ListIngredientsQuery, ListTagsQuery } from './catalog.schemas';

/**
 * Catalogue : le vocabulaire partagé dans lequel puisent les formulaires de
 * recette et les filtres de recherche.
 *
 * Ingrédients et tags sont volontairement globaux, non cloisonnés par
 * utilisateur : ils n'ont pas de propriétaire, et les restreindre à ce que
 * l'utilisateur a déjà écrit viderait l'autocomplétion pour un compte neuf,
 * précisément quand elle sert le plus. Ce sont des noms communs — « farine »,
 * « tomate » — pas des données personnelles.
 */

/**
 * Neutralise les jokers d'une saisie utilisateur. Sans quoi un simple `%`
 * tapé dans le champ ferait remonter le catalogue entier, et un `_` élargirait
 * silencieusement la recherche.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => '\\' + char);
}

/**
 * Autocomplétion par fragment : « olive » doit retrouver « huile d'olive »,
 * un préfixe seul ne suffirait pas sur des noms composés. La recherche
 * s'appuie sur l'index trigramme posé par la migration `0003`.
 *
 * Les noms sont normalisés en minuscules à l'écriture (`normalizeIngredientName`)
 * et la saisie l'est ici : un `LIKE` suffit donc, là où un `ILIKE` écarterait
 * l'index.
 */
export function searchIngredients(query: ListIngredientsQuery): Promise<Ingredient[]> {
  const { q, limit } = query;
  if (q === undefined) {
    return Ingredient.findAll({ order: [['name', 'ASC']], limit });
  }

  const needle = escapeLike(q.trim().toLowerCase());
  return Ingredient.findAll({
    where: { name: { [Op.like]: '%' + needle + '%' } },
    // Ce qui commence par la saisie passe devant : en tapant « tomate », on
    // attend « tomate » avant « concentré de tomate ».
    order: [
      literal('("Ingredient"."name" LIKE ' + sequelize.escape(needle + '%') + ') DESC'),
      ['name', 'ASC'],
    ],
    limit,
  });
}

/**
 * Tags portés par au moins une recette publique.
 *
 * Un tag `custom` naît de la saisie libre d'un utilisateur, y compris sur une
 * recette privée : rendre la table entière à un visiteur publierait ce
 * vocabulaire-là. Ce filtre borne la réponse au vocabulaire du catalogue
 * public, celui que la découverte permet déjà de parcourir.
 */
function onPublicRecipeCondition() {
  return literal(`EXISTS (
    SELECT 1
    FROM recipe_tags rt
    JOIN recipes r ON r.id = rt.recipe_id
    WHERE rt.tag_id = "Tag"."id" AND r.visibility = 'public'
  )`);
}

/**
 * Tags du catalogue, groupés par type puis par ordre alphabétique. Un visiteur
 * anonyme n'en voit que la part publique.
 */
export function listTags(query: ListTagsQuery, isAuthenticated: boolean): Promise<Tag[]> {
  const conditions = [];
  if (query.type !== undefined) {
    conditions.push({ type: query.type });
  }
  if (!isAuthenticated) {
    conditions.push(onPublicRecipeCondition());
  }

  return Tag.findAll({
    where: conditions.length === 0 ? undefined : { [Op.and]: conditions },
    order: [
      ['type', 'ASC'],
      ['name', 'ASC'],
    ],
  });
}
