import { OAuthAccount, Recipe, User, UserPreferences } from '../models';

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

/** Champs propres à la recette, communs au résumé et au détail. */
function recipeBase(recipe: Recipe) {
  return {
    id: recipe.id,
    ownerId: recipe.ownerId,
    title: recipe.title,
    description: recipe.description,
    prepTimeMin: recipe.prepTimeMin,
    cookTimeMin: recipe.cookTimeMin,
    servings: recipe.servings,
    imageUrl: recipe.imageUrl,
    source: recipe.source,
    visibility: recipe.visibility,
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
export function serializeRecipe(recipe: Recipe) {
  return {
    ...recipeBase(recipe),
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
export function serializeRecipeSummary(recipe: Recipe) {
  return recipeBase(recipe);
}
