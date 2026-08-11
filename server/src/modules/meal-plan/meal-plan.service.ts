import { Op, WhereOptions } from 'sequelize';
import { MealPlanEntry, Recipe, Tag, User } from '../../models';
import { AppError } from '../../common/app-error';
import type { Role } from '../../middlewares/require-role';
import { assertCookbookRole } from '../cookbooks/members.service';
import { findAccessibleRecipeOrFail, findFavoriteRecipeIds } from '../recipes/recipes.service';
import type {
  CreateMealPlanEntryInput,
  ListMealPlanQuery,
  UpdateMealPlanEntryInput,
} from './meal-plan.schemas';

/** Consulter le planning d'un groupe suppose d'en être membre. */
const PLAN_READ_ROLE: Role = 'READER';

/** Y inscrire ou en retirer un repas engage le groupe : rôle d'éditeur. */
const PLAN_EDIT_ROLE: Role = 'EDITOR';

/**
 * Une entrée s'affiche par sa recette et par qui l'a inscrite — sur un
 * planning partagé, savoir qui a prévu quoi fait partie de l'information.
 */
const ENTRY_INCLUDES = [
  {
    model: Recipe,
    as: 'recipe',
    include: [{ model: Tag, as: 'tags', through: { attributes: [] } }],
  },
  { model: User, as: 'user' },
];

function findEntryWithRelations(entryId: string): Promise<MealPlanEntry | null> {
  return MealPlanEntry.findByPk(entryId, { include: ENTRY_INCLUDES });
}

/** Bornes facultatives : chacune restreint la fenêtre sans exiger l'autre. */
function buildDateFilter({ from, to }: ListMealPlanQuery): WhereOptions {
  if (from !== undefined && to !== undefined) {
    return { date: { [Op.between]: [from, to] } };
  }
  if (from !== undefined) {
    return { date: { [Op.gte]: from } };
  }
  if (to !== undefined) {
    return { date: { [Op.lte]: to } };
  }
  return {};
}

/**
 * Périmètre d'un planning : le sien, ou celui d'un groupe, restreint à la
 * fenêtre demandée. Partagé avec la génération des listes de courses, qui doit
 * lire exactement les entrées que le planning affiche.
 */
export function buildEntryWhere(userId: string, query: ListMealPlanQuery): WhereOptions {
  const scope: WhereOptions =
    query.cookbookId === undefined
      ? { userId, cookbookId: null }
      : { cookbookId: query.cookbookId };

  return { ...scope, ...buildDateFilter(query) };
}

/** Planning accompagné des favoris qu'il contient, pour l'affichage. */
export interface MealPlanView {
  entries: MealPlanEntry[];
  favoriteIds: Set<string>;
}

/**
 * Sans `cookbookId`, on ne rend que le planning personnel de l'appelant ;
 * avec, celui du groupe — toutes personnes confondues.
 *
 * Le tri par `mealType` s'appuie sur l'énuméré PostgreSQL, déclaré dans
 * l'ordre des repas : le petit-déjeuner précède le dîner sans table de
 * correspondance côté application.
 */
export async function listEntries(
  userId: string,
  query: ListMealPlanQuery,
): Promise<MealPlanView> {
  if (query.cookbookId !== undefined) {
    await assertCookbookRole(userId, query.cookbookId, PLAN_READ_ROLE);
  }

  const entries = await MealPlanEntry.findAll({
    where: buildEntryWhere(userId, query),
    include: ENTRY_INCLUDES,
    order: [
      ['date', 'ASC'],
      ['mealType', 'ASC'],
    ],
  });

  const favoriteIds = await findFavoriteRecipeIds(
    userId,
    entries.map((entry) => entry.recipeId),
  );
  return { entries, favoriteIds };
}

export async function createEntry(
  userId: string,
  input: CreateMealPlanEntryInput,
): Promise<MealPlanEntry> {
  const cookbookId = input.cookbookId ?? null;

  if (cookbookId !== null) {
    await assertCookbookRole(userId, cookbookId, PLAN_EDIT_ROLE);
  }
  // Planifier une recette suppose d'y avoir accès : sans ce contrôle, un
  // identifiant deviné ferait entrer la recette privée d'un tiers dans le
  // planning, et son contenu s'afficherait avec l'entrée.
  await findAccessibleRecipeOrFail(input.recipeId, userId);

  const entry = await MealPlanEntry.create({
    userId,
    cookbookId,
    recipeId: input.recipeId,
    date: input.date,
    mealType: input.mealType,
    servings: input.servings ?? null,
  });

  return (await findEntryWithRelations(entry.id))!;
}

/**
 * Modification et suppression : l'auteur de l'entrée, ou un éditeur du
 * cookbook lorsqu'elle appartient à un planning partagé — le groupe corrige
 * ce qui a été prévu pour lui. Une entrée personnelle n'a pas d'autre gardien
 * que son auteur, et reste donc « introuvable » pour les autres.
 *
 * Sur un planning partagé, l'appartenance est revérifiée même pour l'auteur :
 * qui a quitté le groupe n'a plus à toucher à son planning.
 */
async function findEditableEntryOrFail(
  entryId: string,
  userId: string,
): Promise<MealPlanEntry> {
  const entry = await MealPlanEntry.findByPk(entryId);
  const isAuthor = entry !== null && entry.userId === userId;

  if (!entry || (!isAuthor && entry.cookbookId === null)) {
    throw new AppError(404, 'MEAL_PLAN_ENTRY_NOT_FOUND', 'Entrée de planning introuvable');
  }
  if (entry.cookbookId !== null) {
    await assertCookbookRole(
      userId,
      entry.cookbookId,
      isAuthor ? PLAN_READ_ROLE : PLAN_EDIT_ROLE,
    );
  }
  return entry;
}

export async function updateEntry(
  entryId: string,
  userId: string,
  input: UpdateMealPlanEntryInput,
): Promise<MealPlanEntry> {
  const entry = await findEditableEntryOrFail(entryId, userId);

  // Changer de recette rouvre la question de l'accès : la nouvelle doit être
  // visible par celui qui la substitue, comme à la création.
  if (input.recipeId !== undefined && input.recipeId !== entry.recipeId) {
    await findAccessibleRecipeOrFail(input.recipeId, userId);
  }

  entry.set(input);
  await entry.save();
  return (await findEntryWithRelations(entry.id))!;
}

export async function deleteEntry(entryId: string, userId: string): Promise<void> {
  const entry = await findEditableEntryOrFail(entryId, userId);
  await entry.destroy();
}
