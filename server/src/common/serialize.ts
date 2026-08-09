import { env } from '../config/env';
import { Cookbook, OAuthAccount, Recipe, User, UserPreferences } from '../models';
import type { Role } from '../middlewares/require-role';

/** Représentation publique d'un utilisateur. */
export function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Représentation des préférences culinaires. */
export function serializeUserPreferences(preferences: UserPreferences) {
  return {
    diets: preferences.diets,
    allergies: preferences.allergies,
    preferredCuisines: preferences.preferredCuisines,
    defaultServings: preferences.defaultServings,
  };
}

/** Compte OAuth2 lié : jamais l'identifiant côté fournisseur. */
export function serializeOAuthAccount(account: OAuthAccount) {
  return {
    id: account.id,
    provider: account.provider,
    createdAt: account.createdAt,
  };
}

/**
 * L'image est stockée en chemin relatif et rendue absolue à la sortie : si
 * l'URL publique de l'API change, les lignes en base restent valides.
 */
function absoluteImageUrl(imageUrl: string | null): string | null {
  return imageUrl === null ? null : env.API_PUBLIC_URL + imageUrl;
}

/** Champs propres à la recette, communs au résumé et au détail. */
function recipeBase(recipe: Recipe, isFavorite: boolean) {
  return {
    id: recipe.id,
    ownerId: recipe.ownerId,
    title: recipe.title,
    description: recipe.description,
    prepTimeMin: recipe.prepTimeMin,
    cookTimeMin: recipe.cookTimeMin,
    servings: recipe.servings,
    imageUrl: absoluteImageUrl(recipe.imageUrl),
    source: recipe.source,
    visibility: recipe.visibility,
    isFavorite,
    tags: (recipe.tags ?? []).map((tag) => ({ id: tag.id, name: tag.name, type: tag.type })),
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
  };
}

/**
 * Recette complète. La quantité est un `numeric` PostgreSQL, que le driver
 * renvoie en chaîne pour préserver la précision : on la reconvertit ici pour
 * que le client reçoive bien un nombre JSON.
 */
export function serializeRecipe(recipe: Recipe, isFavorite = false) {
  return {
    ...recipeBase(recipe, isFavorite),
    ingredients: (recipe.ingredients ?? []).map((line) => ({
      name: line.ingredient?.name ?? null,
      quantity: line.quantity === null ? null : Number(line.quantity),
      unit: line.unit,
      note: line.note,
      position: line.position,
    })),
    steps: (recipe.steps ?? []).map((step) => ({
      position: step.position,
      instruction: step.instruction,
    })),
  };
}

/** Entrée de liste : sans ingrédients ni étapes, inutiles à ce niveau. */
export function serializeRecipeSummary(recipe: Recipe, isFavorite = false) {
  return recipeBase(recipe, isFavorite);
}

/** Page de résultats de recherche, quel qu'en soit le périmètre. */
export function serializeRecipePage(page: {
  items: Recipe[];
  total: number;
  page: number;
  pageSize: number;
  favoriteIds: Set<string>;
}) {
  return {
    items: page.items.map((recipe) =>
      serializeRecipeSummary(recipe, page.favoriteIds.has(recipe.id)),
    ),
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
  };
}

/**
 * Cookbook vu par l'un de ses membres : `myRole` conditionne les actions que
 * le client peut proposer, les compteurs évitent de charger les collections
 * complètes pour afficher une liste.
 */
export function serializeCookbook(view: {
  cookbook: Cookbook;
  role: Role;
  memberCount: number;
  recipeCount: number;
}) {
  const { cookbook } = view;
  return {
    id: cookbook.id,
    name: cookbook.name,
    description: cookbook.description,
    myRole: view.role,
    memberCount: view.memberCount,
    recipeCount: view.recipeCount,
    createdAt: cookbook.createdAt,
    updatedAt: cookbook.updatedAt,
  };
}
