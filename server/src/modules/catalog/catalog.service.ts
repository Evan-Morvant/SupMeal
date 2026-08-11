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

/** Tags du catalogue, groupés par type puis par ordre alphabétique. */
export function listTags(query: ListTagsQuery): Promise<Tag[]> {
  return Tag.findAll({
    where: query.type === undefined ? undefined : { type: query.type },
    order: [
      ['type', 'ASC'],
      ['name', 'ASC'],
    ],
  });
}
