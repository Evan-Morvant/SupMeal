import { Op, Transaction, col, fn, where as sqlWhere } from 'sequelize';
import {
  Ingredient,
  Recipe,
  RecipeIngredient,
  RecipeStep,
  RecipeTag,
  Tag,
  sequelize,
} from '../../models';
import { AppError } from '../../common/app-error';
import type {
  CreateRecipeInput,
  IngredientLineInput,
  ListRecipesQuery,
  UpdateRecipeInput,
} from './recipes.schemas';

/** Chargement complet d'une recette : lignes d'ingrédients, étapes, tags. */
const FULL_INCLUDES = [
  {
    model: RecipeIngredient,
    as: 'ingredients',
    include: [{ model: Ingredient, as: 'ingredient' }],
  },
  { model: RecipeStep, as: 'steps' },
  { model: Tag, as: 'tags', through: { attributes: [] } },
];

/**
 * Nom d'ingrédient normalisé.
 */
export function normalizeIngredientName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Un tag garde sa casse d'origine (les tags de référence sont capitalisés). */
function normalizeTagName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Résout les ingrédients en une passe : une lecture, une insertion des
 * manquants, une relecture. Le coût reste constant quel que soit le nombre de
 * lignes, là où un findOrCreate par ligne ferait N allers-retours.
 */
async function resolveIngredientIds(
  names: string[],
  transaction: Transaction,
): Promise<Map<string, string>> {
  const uniques = [...new Set(names.map(normalizeIngredientName))];
  const byName = new Map<string, string>();
  if (uniques.length === 0) {
    return byName;
  }

  const existing = await Ingredient.findAll({
    where: { name: { [Op.in]: uniques } },
    transaction,
  });
  existing.forEach((ingredient) => byName.set(ingredient.name, ingredient.id));

  const missing = uniques.filter((name) => !byName.has(name));
  if (missing.length > 0) {
    // ON CONFLICT DO NOTHING : deux recettes créées en parallèle peuvent viser
    // le même ingrédient. Les identifiants générés n'étant pas renvoyés de
    // façon fiable dans ce mode, on relit les lignes concernées.
    await Ingredient.bulkCreate(
      missing.map((name) => ({ name })),
      { ignoreDuplicates: true, transaction },
    );
    const created = await Ingredient.findAll({
      where: { name: { [Op.in]: missing } },
      transaction,
    });
    created.forEach((ingredient) => byName.set(ingredient.name, ingredient.id));
  }

  return byName;
}

/**
 * Résout les tags par nom, insenssible à la casse : « dessert » doit
 * retrouver le tag de référence « Dessert » (type `course`) au lieu d'en
 * créer un doublon de type `custom`.
 */
async function resolveTagIds(names: string[], transaction: Transaction): Promise<string[]> {
  const uniques = [...new Set(names.map(normalizeTagName))];
  if (uniques.length === 0) {
    return [];
  }

  const lowered = uniques.map((name) => name.toLowerCase());
  const existing = await Tag.findAll({
    where: sqlWhere(fn('lower', col('name')), { [Op.in]: lowered }),
    transaction,
  });

  const byLoweredName = new Map(existing.map((tag) => [tag.name.toLowerCase(), tag]));
  const missing = uniques.filter((name) => !byLoweredName.has(name.toLowerCase()));
  if (missing.length > 0) {
    const created = await Tag.bulkCreate(
      missing.map((name) => ({ name, type: 'custom' as const })),
      { ignoreDuplicates: true, transaction },
    );
    created.forEach((tag) => byLoweredName.set(tag.name.toLowerCase(), tag));
  }

  return uniques
    .map((name) => byLoweredName.get(name.toLowerCase())?.id)
    .filter((id): id is string => Boolean(id));
}

/**
 * Remplace intégralement les lignes d'ingrédients. Aucune déduplication : un
 * même ingrédient peut légitimement apparaître deux fois (100 g de sucre pour
 * la pâte, 50 g pour le nappage), distingués par leur `note`.
 */
async function replaceIngredients(
  recipeId: string,
  lines: IngredientLineInput[],
  transaction: Transaction,
): Promise<void> {
  await RecipeIngredient.destroy({ where: { recipeId }, transaction });
  if (lines.length === 0) {
    return;
  }

  const ids = await resolveIngredientIds(
    lines.map((line) => line.name),
    transaction,
  );
  await RecipeIngredient.bulkCreate(
    lines.map((line, index) => ({
      recipeId,
      ingredientId: ids.get(normalizeIngredientName(line.name))!,
      quantity: line.quantity ?? null,
      unit: line.unit ?? null,
      note: line.note ?? null,
      position: index,
    })),
    { transaction },
  );
}

/** L'ordre du tableau reçu fait foi : il devient la position des étapes. */
async function replaceSteps(
  recipeId: string,
  steps: string[],
  transaction: Transaction,
): Promise<void> {
  await RecipeStep.destroy({ where: { recipeId }, transaction });
  if (steps.length === 0) {
    return;
  }
  await RecipeStep.bulkCreate(
    steps.map((instruction, index) => ({ recipeId, position: index, instruction })),
    { transaction },
  );
}

async function replaceTags(
  recipeId: string,
  names: string[],
  transaction: Transaction,
): Promise<void> {
  await RecipeTag.destroy({ where: { recipeId }, transaction });
  if (names.length === 0) {
    return;
  }
  const tagIds = await resolveTagIds(names, transaction);
  await RecipeTag.bulkCreate(
    tagIds.map((tagId) => ({ recipeId, tagId })),
    { ignoreDuplicates: true, transaction },
  );
}

/** Recette complète, ou 404. Les collections sont ordonnées côté SQL. */
export async function findRecipeOrFail(recipeId: string): Promise<Recipe> {
  const recipe = await Recipe.findByPk(recipeId, {
    include: FULL_INCLUDES,
    order: [
      [{ model: RecipeIngredient, as: 'ingredients' }, 'position', 'ASC'],
      [{ model: RecipeStep, as: 'steps' }, 'position', 'ASC'],
    ],
  });
  if (!recipe) {
    throw new AppError(404, 'RECIPE_NOT_FOUND', 'Recette introuvable');
  }
  return recipe;
}

/**
 * Création. Recette, ingrédients, étapes et tags sont écrits dans une seule
 * transaction : une recette n'existe jamais amputée de son contenu.
 */
export async function createRecipe(ownerId: string, input: CreateRecipeInput): Promise<Recipe> {
  const created = await sequelize.transaction(async (transaction) => {
    const recipe = await Recipe.create(
      {
        ownerId,
        title: input.title,
        description: input.description ?? null,
        prepTimeMin: input.prepTimeMin ?? null,
        cookTimeMin: input.cookTimeMin ?? null,
        servings: input.servings ?? null,
        imageUrl: null,
        source: input.source ?? null,
        visibility: input.visibility ?? 'private',
      },
      { transaction },
    );

    await replaceIngredients(recipe.id, input.ingredients ?? [], transaction);
    await replaceSteps(recipe.id, input.steps ?? [], transaction);
    await replaceTags(recipe.id, input.tags ?? [], transaction);
    return recipe;
  });

  return findRecipeOrFail(created.id);
}

/**
 * Modification. Les champs simples absents sont conservés ; une collection
 * présente dans le corps remplace intégralement l'ancienne.
 */
export async function updateRecipe(recipe: Recipe, input: UpdateRecipeInput): Promise<Recipe> {
  await sequelize.transaction(async (transaction) => {
    const changes: Partial<Recipe> = {};
    if (input.title !== undefined) changes.title = input.title;
    if (input.description !== undefined) changes.description = input.description;
    if (input.prepTimeMin !== undefined) changes.prepTimeMin = input.prepTimeMin;
    if (input.cookTimeMin !== undefined) changes.cookTimeMin = input.cookTimeMin;
    if (input.servings !== undefined) changes.servings = input.servings;
    if (input.source !== undefined) changes.source = input.source;
    if (input.visibility !== undefined) changes.visibility = input.visibility;

    if (Object.keys(changes).length > 0) {
      await recipe.update(changes, { transaction });
    }
    if (input.ingredients !== undefined) {
      await replaceIngredients(recipe.id, input.ingredients, transaction);
    }
    if (input.steps !== undefined) {
      await replaceSteps(recipe.id, input.steps, transaction);
    }
    if (input.tags !== undefined) {
      await replaceTags(recipe.id, input.tags, transaction);
    }
  });

  return findRecipeOrFail(recipe.id);
}

/** Suppression. Les lignes filles partent par ON DELETE CASCADE. */
export async function deleteRecipe(recipe: Recipe): Promise<void> {
  await recipe.destroy();
}

export interface RecipePage {
  items: Recipe[];
  total: number;
  page: number;
  pageSize: number;
}

/** Recettes dont l'utilisateur est le créateur, les plus récentes d'abord. */
export async function listOwnedRecipes(
  ownerId: string,
  query: ListRecipesQuery,
): Promise<RecipePage> {
  const { page, pageSize } = query;
  const { rows, count } = await Recipe.findAndCountAll({
    where: { ownerId },
    include: [{ model: Tag, as: 'tags', through: { attributes: [] } }],
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    distinct: true,
  });

  return { items: rows, total: count, page, pageSize };
}
