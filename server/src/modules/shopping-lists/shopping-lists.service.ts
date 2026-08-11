import { Op, literal, type OrderItem } from 'sequelize';
import {
  Ingredient,
  MealPlanEntry,
  Recipe,
  RecipeIngredient,
  ShoppingList,
  ShoppingListItem,
  sequelize,
} from '../../models';
import { AppError } from '../../common/app-error';
import type { Role } from '../../middlewares/require-role';
import { assertCookbookRole } from '../cookbooks/members.service';
import { buildEntryWhere } from '../meal-plan/meal-plan.service';
import { aggregateIngredients, type PlannedRecipe } from './aggregate';
import type {
  GenerateShoppingListInput,
  UpdateShoppingListItemInput,
} from './shopping-lists.schemas';

/**
 * Listes de courses générées depuis le planning.
 *
 * Une liste est un **instantané** : ses lignes sont écrites en base à la
 * génération, et modifier une recette ensuite ne réécrit pas une liste déjà
 * emportée au marché.
 */

/** Consulter une liste de groupe suppose d'en être membre. */
const LIST_READ_ROLE: Role = 'READER';

/**
 * La générer, la modifier ou la supprimer engage le groupe : rôle d'éditeur,
 * conformément à la matrice des permissions (l'éditeur gère recettes, tags,
 * planning et liste de courses).
 */
const LIST_EDIT_ROLE: Role = 'EDITOR';

/** Lignes d'une liste, ordonnées par nom d'ingrédient pour être lisibles. */
const ITEM_INCLUDES = [
  {
    model: ShoppingListItem,
    as: 'items',
    include: [{ model: Ingredient, as: 'ingredient' }],
  },
];

const ITEM_ORDER: OrderItem[] = [
  [
    { model: ShoppingListItem, as: 'items' },
    { model: Ingredient, as: 'ingredient' },
    'name',
    'ASC',
  ],
];

/** Intitulé par défaut, déduit de la période couverte. */
function defaultName(input: GenerateShoppingListInput): string {
  return 'Courses du ' + input.fromDate + ' au ' + input.toDate;
}

/**
 * Entrées du planning à couvrir, avec le contenu des recettes. Le périmètre
 * vient de `buildEntryWhere` : une liste doit porter exactement sur ce que le
 * planning affiche pour la même fenêtre.
 */
function findPlannedRecipes(
  userId: string,
  input: GenerateShoppingListInput,
): Promise<MealPlanEntry[]> {
  return MealPlanEntry.findAll({
    where: buildEntryWhere(userId, {
      from: input.fromDate,
      to: input.toDate,
      cookbookId: input.cookbookId ?? undefined,
    }),
    include: [
      {
        model: Recipe,
        as: 'recipe',
        include: [{ model: RecipeIngredient, as: 'ingredients' }],
      },
    ],
  });
}

/** Passage du modèle à la forme neutre attendue par l'agrégation. */
function toPlannedRecipe(entry: MealPlanEntry): PlannedRecipe {
  return {
    plannedServings: entry.servings,
    recipeServings: entry.recipe?.servings ?? null,
    ingredients: (entry.recipe?.ingredients ?? []).map((line) => ({
      ingredientId: line.ingredientId,
      quantity: line.quantity === null ? null : Number(line.quantity),
      unit: line.unit,
    })),
  };
}

export async function generateShoppingList(
  userId: string,
  input: GenerateShoppingListInput,
): Promise<ShoppingList> {
  const cookbookId = input.cookbookId ?? null;
  if (cookbookId !== null) {
    await assertCookbookRole(userId, cookbookId, LIST_EDIT_ROLE);
  }

  const entries = await findPlannedRecipes(userId, input);
  if (entries.length === 0) {
    throw new AppError(
      422,
      'EMPTY_MEAL_PLAN',
      'Aucun repas planifié sur cette période : rien à mettre sur la liste',
    );
  }

  const items = aggregateIngredients(entries.map(toPlannedRecipe));

  // Liste et lignes dans une seule transaction : une liste de courses vide de
  // ses lignes serait pire qu'absente, on la croirait complète.
  const created = await sequelize.transaction(async (transaction) => {
    const list = await ShoppingList.create(
      {
        userId,
        cookbookId,
        name: input.name ?? defaultName(input),
        fromDate: input.fromDate,
        toDate: input.toDate,
      },
      { transaction },
    );

    await ShoppingListItem.bulkCreate(
      items.map((item) => ({ ...item, shoppingListId: list.id })),
      { transaction },
    );
    return list;
  });

  return findListOrFail(created.id);
}

/** Liste complète avec ses lignes, ou 404. */
export async function findListOrFail(listId: string): Promise<ShoppingList> {
  const list = await ShoppingList.findByPk(listId, {
    include: ITEM_INCLUDES,
    order: ITEM_ORDER,
  });
  if (list === null) {
    throw new AppError(404, 'SHOPPING_LIST_NOT_FOUND', 'Liste de courses introuvable');
  }
  return list;
}

/**
 * Contrôle d'accès à une liste. Une liste personnelle n'appartient qu'à son
 * auteur ; une liste de groupe suit les rôles du cookbook, si bien qu'un membre
 * peut cocher ce qu'un autre a généré.
 */
async function assertListAccess(
  list: ShoppingList,
  userId: string,
  minRole: Role,
): Promise<void> {
  if (list.cookbookId !== null) {
    await assertCookbookRole(userId, list.cookbookId, minRole);
    return;
  }
  if (list.userId !== userId) {
    throw new AppError(404, 'SHOPPING_LIST_NOT_FOUND', 'Liste de courses introuvable');
  }
}

export async function findAccessibleListOrFail(
  listId: string,
  userId: string,
  minRole: Role = LIST_READ_ROLE,
): Promise<ShoppingList> {
  const list = await findListOrFail(listId);
  await assertListAccess(list, userId, minRole);
  return list;
}

/**
 * Listes visibles : les siennes, et celles des cookbooks dont on est membre —
 * une liste de groupe générée par un autre doit apparaître, sans quoi le
 * partage ne servirait à rien.
 */
export function listShoppingLists(userId: string): Promise<ShoppingList[]> {
  return ShoppingList.findAll({
    where: {
      [Op.or]: [
        { userId, cookbookId: { [Op.is]: null } },
        literal(`"ShoppingList"."cookbook_id" IN (
          SELECT cm.cookbook_id FROM cookbook_memberships cm
          WHERE cm.user_id = ${sequelize.escape(userId)}
        )`),
      ],
    },
    include: ITEM_INCLUDES,
    order: [['createdAt', 'DESC'], ...ITEM_ORDER],
  });
}

export async function deleteShoppingList(listId: string, userId: string): Promise<void> {
  const list = await findAccessibleListOrFail(listId, userId, LIST_EDIT_ROLE);
  await list.destroy();
}

/**
 * Modification d'une ligne. Seule la ligne est rendue, non la liste entière :
 * cocher un article n'en change aucun autre, et une liste de courses peut être
 * longue — la renvoyer à chaque case cochée serait du gaspillage.
 */
export async function updateItem(
  listId: string,
  itemId: string,
  userId: string,
  input: UpdateShoppingListItemInput,
): Promise<ShoppingListItem> {
  await findAccessibleListOrFail(listId, userId, LIST_EDIT_ROLE);

  const item = await ShoppingListItem.findOne({
    where: { id: itemId, shoppingListId: listId },
    include: [{ model: Ingredient, as: 'ingredient' }],
  });
  if (item === null) {
    throw new AppError(404, 'SHOPPING_LIST_ITEM_NOT_FOUND', 'Ligne introuvable dans cette liste');
  }

  if (input.checked !== undefined) item.checked = input.checked;
  if (input.quantity !== undefined) item.quantity = input.quantity;
  if (input.unit !== undefined) item.unit = input.unit;
  await item.save();

  return item;
}
