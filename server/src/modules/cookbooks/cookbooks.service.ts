import { Model, ModelStatic, Op, col, fn } from 'sequelize';
import { Cookbook, CookbookMembership, CookbookRecipe, sequelize } from '../../models';
import { AppError } from '../../common/app-error';
import type { Role } from '../../middlewares/require-role';
import {
  createRecipe,
  findAccessibleRecipeOrFail,
  searchRecipesForUser,
} from '../recipes/recipes.service';
import type { RecipePageWithFavorites } from '../recipes/recipes.service';
import type { CreateRecipeInput } from '../recipes/recipes.schemas';
import type {
  CreateCookbookInput,
  ListCookbookRecipesQuery,
  UpdateCookbookInput,
} from './cookbooks.schemas';

/** Cookbook accompagné du rôle du demandeur et des compteurs d'affichage. */
export interface CookbookView {
  cookbook: Cookbook;
  role: Role;
  memberCount: number;
  recipeCount: number;
}

/**
 * Compte les lignes rattachées à chacun des cookbooks donnés, en une requête
 * agrégée : une liste de dix cookbooks se résout ainsi en deux requêtes au
 * lieu de vingt. La fonction est générique parce que membres et recettes se
 * comptent exactement de la même façon.
 */
async function countByCookbook(
  model: ModelStatic<Model>,
  cookbookIds: string[],
): Promise<Map<string, number>> {
  if (cookbookIds.length === 0) {
    return new Map();
  }

  const rows = (await model.findAll({
    attributes: ['cookbookId', [fn('COUNT', col('id')), 'count']],
    where: { cookbookId: { [Op.in]: cookbookIds } },
    group: ['cookbookId'],
    raw: true,
  })) as unknown as { cookbookId: string; count: string }[];

  return new Map(rows.map((row) => [row.cookbookId, Number(row.count)]));
}

/** Assemble les vues d'une série de cookbooks dont on connaît déjà les rôles. */
async function buildViews(cookbooks: Cookbook[], roles: Map<string, Role>): Promise<CookbookView[]> {
  const ids = cookbooks.map((cookbook) => cookbook.id);
  const [memberCounts, recipeCounts] = await Promise.all([
    countByCookbook(CookbookMembership, ids),
    countByCookbook(CookbookRecipe, ids),
  ]);

  return cookbooks.map((cookbook) => ({
    cookbook,
    role: roles.get(cookbook.id)!,
    memberCount: memberCounts.get(cookbook.id) ?? 0,
    recipeCount: recipeCounts.get(cookbook.id) ?? 0,
  }));
}

/** Cookbooks dont l'utilisateur est membre, quel que soit son rôle. */
export async function listCookbooks(userId: string): Promise<CookbookView[]> {
  const memberships = await CookbookMembership.findAll({
    where: { userId },
    include: [{ model: Cookbook, as: 'cookbook' }],
    order: [[{ model: Cookbook, as: 'cookbook' }, 'name', 'ASC']],
  });

  const cookbooks = memberships
    .map((membership) => membership.cookbook)
    .filter((cookbook): cookbook is Cookbook => cookbook !== undefined);
  const roles = new Map(memberships.map((membership) => [membership.cookbookId, membership.role]));

  return buildViews(cookbooks, roles);
}

export async function findCookbookOrFail(cookbookId: string): Promise<Cookbook> {
  const cookbook = await Cookbook.findByPk(cookbookId);
  if (!cookbook) {
    throw new AppError(404, 'COOKBOOK_NOT_FOUND', 'Cookbook introuvable');
  }
  return cookbook;
}

/** Vue d'un cookbook déjà autorisé par `loadMembership`. */
export async function getCookbookView(cookbookId: string, role: Role): Promise<CookbookView> {
  const cookbook = await findCookbookOrFail(cookbookId);
  const [view] = await buildViews([cookbook], new Map([[cookbook.id, role]]));
  return view;
}

/**
 * Création. Le cookbook et l'appartenance de son créateur partagent une
 * transaction : un cookbook sans membre serait inaccessible à quiconque, y
 * compris à celui qui vient de le créer.
 */
export async function createCookbook(
  userId: string,
  input: CreateCookbookInput,
): Promise<CookbookView> {
  const cookbook = await sequelize.transaction(async (transaction) => {
    const created = await Cookbook.create(
      { name: input.name, description: input.description ?? null },
      { transaction },
    );
    await CookbookMembership.create(
      { cookbookId: created.id, userId, role: 'OWNER' },
      { transaction },
    );
    return created;
  });

  return { cookbook, role: 'OWNER', memberCount: 1, recipeCount: 0 };
}

export async function updateCookbook(
  cookbookId: string,
  role: Role,
  input: UpdateCookbookInput,
): Promise<CookbookView> {
  const cookbook = await findCookbookOrFail(cookbookId);
  if (input.name !== undefined) {
    cookbook.name = input.name;
  }
  if (input.description !== undefined) {
    cookbook.description = input.description;
  }
  await cookbook.save();

  return getCookbookView(cookbook.id, role);
}

/**
 * Suppression. Les appartenances, liaisons, messages et commentaires partent
 * en cascade ; les recettes, elles, survivent : elles appartiennent à leur
 * créateur, pas au cookbook.
 */
export async function deleteCookbook(cookbookId: string): Promise<void> {
  const cookbook = await findCookbookOrFail(cookbookId);
  await cookbook.destroy();
}

/**
 * Recherche interne au cookbook : la recherche générale, restreinte au
 * cookbook courant. L'utilisateur en étant membre, toutes les recettes liées
 * entrent dans son périmètre de visibilité.
 */
export function listCookbookRecipes(
  userId: string,
  cookbookId: string,
  query: ListCookbookRecipesQuery,
): Promise<RecipePageWithFavorites> {
  return searchRecipesForUser(userId, { ...query, cookbookId });
}

/** Création d'une recette directement dans le cookbook (créateur = auteur). */
export function createRecipeInCookbook(
  userId: string,
  cookbookId: string,
  input: CreateRecipeInput,
) {
  return createRecipe(userId, input, cookbookId);
}

/**
 * Liaison d'une recette existante. La recette doit être lisible par le
 * demandeur : sans ce contrôle, un identifiant deviné suffirait à exposer la
 * recette privée d'un tiers à tout un cookbook.
 */
export async function linkRecipe(
  userId: string,
  cookbookId: string,
  recipeId: string,
): Promise<void> {
  await findAccessibleRecipeOrFail(recipeId, userId);

  const [, created] = await CookbookRecipe.findOrCreate({
    where: { cookbookId, recipeId },
    defaults: { cookbookId, recipeId, addedBy: userId },
  });

  // Le conflit est signalé plutôt qu'ignoré : le client saura afficher
  // « déjà dans ce cookbook » au lieu d'une seconde confirmation d'ajout.
  if (!created) {
    throw new AppError(409, 'RECIPE_ALREADY_LINKED', 'Recette déjà présente dans ce cookbook');
  }
}

/**
 * Retrait d'une recette : seule la liaison disparaît, jamais la recette.
 * Volontairement idempotent, l'état visé étant « cette recette n'est plus
 * dans ce cookbook ».
 */
export async function unlinkRecipe(cookbookId: string, recipeId: string): Promise<void> {
  await CookbookRecipe.destroy({ where: { cookbookId, recipeId } });
}
