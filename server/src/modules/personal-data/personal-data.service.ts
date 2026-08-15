import {
  Comment,
  Cookbook,
  CookbookMembership,
  Favorite,
  Ingredient,
  MealPlanEntry,
  Message,
  OAuthAccount,
  Recipe,
  Review,
  ShoppingList,
  ShoppingListItem,
  User,
} from '../../models';
import { AppError } from '../../common/app-error';
import { serializeUserPreferences } from '../../common/serialize';
import { getPreferences } from '../users/users.service';

/**
 * Rassemblement des données personnelles d'un utilisateur, pour la
 * portabilité. Distinct de `/export`, qui produit du contenu réimportable :
 * ce fichier-ci décrit une personne, ne se réimporte pas, et n'existe qu'en
 * JSON — le CSV ne saurait porter un ensemble aussi hétérogène.
 *
 * **Deux règles tiennent tout le module.** D'abord, rien de secret : ni hash de
 * mot de passe, ni jeton. Ensuite, rien qui appartienne à autrui : commentaires,
 * messages et avis sont filtrés sur l'auteur, et les cookbooks n'apparaissent
 * que par l'adhésion de l'intéressé, jamais par leur liste de membres. Un
 * export de portabilité qui livrerait les propos des autres membres ferait
 * exactement le contraire de ce qu'on lui demande.
 */

export const PERSONAL_DATA_WARNING =
  'Ce fichier rassemble vos données personnelles en clair, sans chiffrement. ' +
  'Conservez-le en lieu sûr et ne le transmettez à personne.';

/** Renvoi vers l'export de contenu, seul à produire les recettes en entier. */
const RECIPES_NOTE =
  'Vos recettes sont listées ici par leur titre. Leur contenu complet ' +
  "s'obtient par GET /api/v1/export, dans les trois formats proposés.";

const NAMED_COOKBOOK = { model: Cookbook, as: 'cookbook' };
const NAMED_RECIPE = { model: Recipe, as: 'recipe' };

/** Nom du cookbook, ou `null` pour ce qui relève du périmètre personnel. */
function cookbookName(entry: { cookbook?: Cookbook }): string | null {
  return entry.cookbook?.name ?? null;
}

async function findUserOrFail(userId: string): Promise<User> {
  const user = await User.findByPk(userId);
  if (user === null) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable');
  }
  return user;
}

export async function buildPersonalData(userId: string) {
  const user = await findUserOrFail(userId);
  const preferences = await getPreferences(userId);

  const [
    oauthAccounts,
    memberships,
    recipes,
    favorites,
    reviews,
    comments,
    messages,
    mealPlan,
    shoppingLists,
  ] = await Promise.all([
    OAuthAccount.findAll({ where: { userId }, order: [['createdAt', 'ASC']] }),
    CookbookMembership.findAll({
      where: { userId },
      include: [NAMED_COOKBOOK],
      order: [['joinedAt', 'ASC']],
    }),
    Recipe.findAll({
      where: { ownerId: userId },
      attributes: ['id', 'title', 'visibility', 'createdAt'],
      order: [['createdAt', 'ASC']],
    }),
    Favorite.findAll({
      where: { userId },
      include: [NAMED_RECIPE],
      order: [['createdAt', 'ASC']],
    }),
    Review.findAll({
      where: { userId },
      include: [NAMED_RECIPE],
      order: [['createdAt', 'ASC']],
    }),
    Comment.findAll({
      where: { userId },
      include: [NAMED_RECIPE, NAMED_COOKBOOK],
      order: [['createdAt', 'ASC']],
    }),
    Message.findAll({
      where: { userId },
      include: [NAMED_COOKBOOK],
      order: [['createdAt', 'ASC']],
    }),
    MealPlanEntry.findAll({
      where: { userId },
      include: [NAMED_RECIPE, NAMED_COOKBOOK],
      order: [['date', 'ASC']],
    }),
    ShoppingList.findAll({
      where: { userId },
      include: [
        NAMED_COOKBOOK,
        { model: ShoppingListItem, as: 'items', include: [{ model: Ingredient, as: 'ingredient' }] },
      ],
      order: [['createdAt', 'ASC']],
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    warning: PERSONAL_DATA_WARNING,
    profile: {
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      // Le fait qu'un mot de passe existe est une donnée du compte ; sa valeur
      // ne sort jamais, pas même hachée.
      hasPassword: user.passwordHash !== null,
      createdAt: user.createdAt,
    },
    preferences: serializeUserPreferences(preferences),
    oauthAccounts: oauthAccounts.map((account) => ({
      provider: account.provider,
      providerUserId: account.providerUserId,
      linkedAt: account.createdAt,
    })),
    cookbookMemberships: memberships.map((membership) => ({
      cookbook: membership.cookbook?.name ?? null,
      role: membership.role,
      joinedAt: membership.joinedAt,
    })),
    recipes: {
      note: RECIPES_NOTE,
      items: recipes.map((recipe) => ({
        id: recipe.id,
        title: recipe.title,
        visibility: recipe.visibility,
        createdAt: recipe.createdAt,
      })),
    },
    favorites: favorites.map((favorite) => ({
      recipe: favorite.recipe?.title ?? null,
      addedAt: favorite.createdAt,
    })),
    reviews: reviews.map((review) => ({
      recipe: review.recipe?.title ?? null,
      rating: review.rating,
      body: review.body,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    })),
    comments: comments.map((comment) => ({
      cookbook: cookbookName(comment),
      recipe: comment.recipe?.title ?? null,
      content: comment.content,
      createdAt: comment.createdAt,
    })),
    messages: messages.map((message) => ({
      cookbook: cookbookName(message),
      content: message.content,
      createdAt: message.createdAt,
    })),
    mealPlan: mealPlan.map((entry) => ({
      date: entry.date,
      mealType: entry.mealType,
      recipe: entry.recipe?.title ?? null,
      servings: entry.servings,
      cookbook: cookbookName(entry),
    })),
    shoppingLists: shoppingLists.map((list) => ({
      name: list.name,
      cookbook: cookbookName(list),
      fromDate: list.fromDate,
      toDate: list.toDate,
      createdAt: list.createdAt,
      items: (list.items ?? []).map((item) => ({
        ingredient: item.ingredient?.name ?? null,
        quantity: item.quantity === null ? null : Number(item.quantity),
        unit: item.unit,
        checked: item.checked,
      })),
    })),
  };
}
