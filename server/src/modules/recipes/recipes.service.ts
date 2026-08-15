import fs from 'fs/promises';
import { Op, Transaction, WhereOptions, col, fn, where as sqlWhere } from 'sequelize';
import {
  CookbookRecipe,
  Favorite,
  Ingredient,
  Recipe,
  RecipeIngredient,
  RecipeStep,
  RecipeTag,
  Tag,
  sequelize,
} from '../../models';
import { AppError } from '../../common/app-error';
import { recipeImageDiskPath, recipeImagePath } from '../../common/uploads';
import {
  accessibleRecipesCondition,
  buildPublicRecipeWhere,
  buildRecipeOrder,
  buildRecipeWhere,
  editableRecipesCondition,
  inCookbookCondition,
} from './recipes.filters';
import type {
  CreateRecipeInput,
  DiscoverRecipesQuery,
  IngredientLineInput,
  ListRecipesQuery,
  RecipeFilters,
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

export async function isRecipeAccessible(
  recipeId: string,
  userId?: string,
): Promise<boolean> {
  // Un visiteur anonyme n'a ni propriété ni adhésion : seule la visibilité
  // publique, vérifiée par l'appelant, peut le servir.
  if (!userId) {
    return false;
  }
  const visible = await Recipe.count({
    where: { id: recipeId, [Op.and]: [accessibleRecipesCondition(userId)] },
  });
  return visible > 0;
}

/**
 * Droit de modification hérité d'un cookbook (le cas du créateur se traite à
 * part, il n'a besoin d'aucune liaison).
 */
export async function isRecipeEditable(recipeId: string, userId: string): Promise<boolean> {
  const editable = await Recipe.count({
    where: { id: recipeId, [Op.and]: [editableRecipesCondition(userId)] },
  });
  return editable > 0;
}

/**
 * Recette lisible par l'utilisateur, ou 404/403. Règle unique de consultation,
 * partagée par la garde de route et par la liaison à un cookbook : une recette
 * qu'on n'a pas le droit de lire ne doit pas non plus pouvoir être exposée à
 * tout un cookbook.
 */
export async function findAccessibleRecipeOrFail(
  recipeId: string,
  userId?: string,
): Promise<Recipe> {
  const recipe = await findRecipeOrFail(recipeId);
  const allowed =
    recipe.visibility === 'public' || (await isRecipeAccessible(recipe.id, userId));

  if (!allowed) {
    throw new AppError(403, 'FORBIDDEN', 'Accès refusé à cette recette');
  }
  return recipe;
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
 * Recettes accessibles, chargées avec leur contenu complet et sans pagination,
 * éventuellement restreintes à un cookbook. Réservé à l'export, seul cas où
 * l'absence de limite se justifie : une sauvegarde amputée de sa fin n'aurait
 * aucune valeur.
 *
 * Le périmètre d'accès s'applique même quand un cookbook est visé : rien ne
 * doit sortir par l'export qui ne sorte pas par la liste.
 */
export async function listAccessibleRecipesInFull(
  userId: string,
  cookbookId?: string,
): Promise<Recipe[]> {
  const conditions = [accessibleRecipesCondition(userId)];
  if (cookbookId !== undefined) {
    conditions.push(inCookbookCondition(cookbookId));
  }

  return Recipe.findAll({
    where: { [Op.and]: conditions },
    include: FULL_INCLUDES,
    order: [
      ['createdAt', 'ASC'],
      [{ model: RecipeIngredient, as: 'ingredients' }, 'position', 'ASC'],
      [{ model: RecipeStep, as: 'steps' }, 'position', 'ASC'],
    ],
  });
}

/** Titres des recettes dont l'utilisateur est créateur, en minuscules. */
export async function findOwnedTitles(userId: string): Promise<Set<string>> {
  const recipes = await Recipe.findAll({ attributes: ['title'], where: { ownerId: userId } });
  return new Set(recipes.map((recipe) => recipe.title.trim().toLowerCase()));
}

/**
 * Création. Recette, ingrédients, étapes et tags sont écrits dans une seule
 * transaction : une recette n'existe jamais amputée de son contenu.
 *
 * `cookbookId` couvre la création directe dans un cookbook : la liaison entre
 * dans la même transaction, faute de quoi un échec laisserait une recette
 * personnelle orpheline là où l'utilisateur en attendait une partagée.
 */
export async function createRecipe(
  ownerId: string,
  input: CreateRecipeInput,
  cookbookId?: string,
): Promise<Recipe> {
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

    if (cookbookId) {
      await CookbookRecipe.create(
        { cookbookId, recipeId: recipe.id, addedBy: ownerId },
        { transaction },
      );
    }
    return recipe;
  });

  return findRecipeOrFail(created.id);
}

/**
 * Modification. Les champs simples absents sont conservés ; une collection
 * présente dans le corps remplace intégralement l'ancienne.
 *
 * La visibilité fait exception : un éditeur du cookbook corrige le contenu,
 * mais seul le créateur décide d'exposer sa recette au monde.
 */
export async function updateRecipe(
  recipe: Recipe,
  input: UpdateRecipeInput,
  actorId: string,
): Promise<Recipe> {
  if (
    input.visibility !== undefined &&
    input.visibility !== recipe.visibility &&
    recipe.ownerId !== actorId
  ) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Seul le créateur peut changer la visibilité de la recette',
    );
  }

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

/**
 * Associe une image à la recette et supprime la précédente du disque : sans
 * ça, chaque remplacement laisserait un fichier orphelin.
 */
export async function setRecipeImage(recipe: Recipe, filename: string): Promise<Recipe> {
  const previous = recipe.imageUrl;
  recipe.imageUrl = recipeImagePath(filename);
  await recipe.save();

  if (previous) {
    await fs.rm(recipeImageDiskPath(previous), { force: true });
  }
  return findRecipeOrFail(recipe.id);
}

/** Ajout aux favoris, idempotent : re-cliquer ne doit pas être une erreur. */
export async function addFavorite(userId: string, recipeId: string): Promise<void> {
  await Favorite.findOrCreate({ where: { userId, recipeId }, defaults: { userId, recipeId } });
}

/**
 * Retrait des favoris, idempotent lui aussi. Volontairement sans contrôle
 * d'accès à la recette : perdre l'accès à une recette ne doit pas empêcher de
 * la retirer de ses propres favoris.
 */
export async function removeFavorite(userId: string, recipeId: string): Promise<void> {
  await Favorite.destroy({ where: { userId, recipeId } });
}

export async function isRecipeFavorite(userId: string, recipeId: string): Promise<boolean> {
  const count = await Favorite.count({ where: { userId, recipeId } });
  return count > 0;
}

/** Favoris d'une page de résultats, en une requête plutôt qu'une par recette. */
export async function findFavoriteRecipeIds(
  userId: string,
  recipeIds: string[],
): Promise<Set<string>> {
  if (recipeIds.length === 0) {
    return new Set();
  }
  const favorites = await Favorite.findAll({
    attributes: ['recipeId'],
    where: { userId, recipeId: { [Op.in]: recipeIds } },
  });
  return new Set(favorites.map((favorite) => favorite.recipeId));
}

export interface RecipePage {
  items: Recipe[];
  total: number;
  page: number;
  pageSize: number;
}

/** Page de résultats accompagnée des favoris qu'elle contient. */
export interface RecipePageWithFavorites extends RecipePage {
  favoriteIds: Set<string>;
}

/**
 * Recherche paginée sur un périmètre donné. Le `where` est fourni par
 * l'appelant : c'est la seule chose qui distingue la liste personnelle de la
 * découverte publique.
 */
async function searchIn(where: WhereOptions, query: RecipeFilters): Promise<RecipePage> {
  const { page, pageSize } = query;
  const { rows, count } = await Recipe.findAndCountAll({
    where,
    order: buildRecipeOrder(query),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  if (rows.length === 0) {
    return { items: [], total: count, page, pageSize };
  }

  const ids = rows.map((recipe) => recipe.id);
  const withTags = await Recipe.findAll({
    where: { id: { [Op.in]: ids } },
    include: [{ model: Tag, as: 'tags', through: { attributes: [] } }],
  });

  // La seconde requête perd l'ordre du tri : on le réapplique depuis les ids.
  const byId = new Map(withTags.map((recipe) => [recipe.id, recipe]));
  const items = ids
    .map((id) => byId.get(id))
    .filter((recipe): recipe is Recipe => recipe !== undefined);

  return { items, total: count, page, pageSize };
}

export function searchRecipes(userId: string, query: ListRecipesQuery): Promise<RecipePage> {
  return searchIn(buildRecipeWhere(userId, query), query);
}

/** Recherche dans les recettes publiques, ouverte aux visiteurs. */
export function searchPublicRecipes(query: DiscoverRecipesQuery): Promise<RecipePage> {
  return searchIn(buildPublicRecipeWhere(query), query);
}

/**
 * Page accompagnée de l'état « favori » de ses entrées. `userId` est facultatif :
 * un visiteur anonyme n'a pas de favoris, la page lui revient telle quelle.
 */
export async function withFavorites(
  page: RecipePage,
  userId?: string,
): Promise<RecipePageWithFavorites> {
  if (userId === undefined) {
    return { ...page, favoriteIds: new Set<string>() };
  }
  const favoriteIds = await findFavoriteRecipeIds(
    userId,
    page.items.map((recipe) => recipe.id),
  );
  return { ...page, favoriteIds };
}

/**
 * Recherche destinée à l'affichage. Sert aussi bien la liste générale que la
 * recherche interne d'un cookbook, qui n'en diffère que par le filtre imposé.
 */
export async function searchRecipesForUser(
  userId: string,
  query: ListRecipesQuery,
): Promise<RecipePageWithFavorites> {
  return withFavorites(await searchRecipes(userId, query), userId);
}
