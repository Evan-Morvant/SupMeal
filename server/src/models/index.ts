/**
 * Point d'entrée des modèles : importe chaque entité puis déclare les
 * associations en un seul endroit (source de vérité des relations).
 * Le schéma physique (contraintes, index PG, tsvector) est créé par les
 * migrations ; ici on décrit le mapping objet-relationnel côté application.
 */
import { sequelize } from '../config/database';
import { User } from './user.model';
import { UserPreferences } from './user-preferences.model';
import { OAuthAccount } from './oauth-account.model';
import { RefreshToken } from './refresh-token.model';
import { Cookbook } from './cookbook.model';
import { CookbookMembership } from './cookbook-membership.model';
import { CookbookInvitation } from './cookbook-invitation.model';
import { Recipe } from './recipe.model';
import { CookbookRecipe } from './cookbook-recipe.model';
import { RecipeStep } from './recipe-step.model';
import { Ingredient } from './ingredient.model';
import { RecipeIngredient } from './recipe-ingredient.model';
import { Tag } from './tag.model';
import { RecipeTag } from './recipe-tag.model';
import { Favorite } from './favorite.model';
import { MealPlanEntry } from './meal-plan-entry.model';
import { Comment } from './comment.model';
import { Review } from './review.model';
import { Message } from './message.model';
import { ShoppingList } from './shopping-list.model';
import { ShoppingListItem } from './shopping-list-item.model';

const CASCADE = { onDelete: 'CASCADE' as const };

/* --- Utilisateur --- */
User.hasOne(UserPreferences, { foreignKey: 'userId', as: 'preferences', ...CASCADE });
UserPreferences.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(OAuthAccount, { foreignKey: 'userId', as: 'oauthAccounts', ...CASCADE });
OAuthAccount.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens', ...CASCADE });
RefreshToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });

/* --- Cookbook & membres --- */
Cookbook.hasMany(CookbookMembership, { foreignKey: 'cookbookId', as: 'memberships', ...CASCADE });
CookbookMembership.belongsTo(Cookbook, { foreignKey: 'cookbookId', as: 'cookbook' });
User.hasMany(CookbookMembership, { foreignKey: 'userId', as: 'memberships', ...CASCADE });
CookbookMembership.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Cookbook.hasMany(CookbookInvitation, { foreignKey: 'cookbookId', as: 'invitations', ...CASCADE });
CookbookInvitation.belongsTo(Cookbook, { foreignKey: 'cookbookId', as: 'cookbook' });

/* --- Recette : propriétaire, contenu --- */
User.hasMany(Recipe, { foreignKey: 'ownerId', as: 'ownedRecipes' });
Recipe.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

Recipe.hasMany(RecipeStep, { foreignKey: 'recipeId', as: 'steps', ...CASCADE });
RecipeStep.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });

Recipe.hasMany(RecipeIngredient, { foreignKey: 'recipeId', as: 'ingredients', ...CASCADE });
RecipeIngredient.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });
Ingredient.hasMany(RecipeIngredient, { foreignKey: 'ingredientId', as: 'usages' });
RecipeIngredient.belongsTo(Ingredient, { foreignKey: 'ingredientId', as: 'ingredient' });

/* --- Recette ↔ Cookbook (N–N) --- */
Recipe.belongsToMany(Cookbook, {
  through: CookbookRecipe,
  foreignKey: 'recipeId',
  otherKey: 'cookbookId',
  as: 'cookbooks',
});
Cookbook.belongsToMany(Recipe, {
  through: CookbookRecipe,
  foreignKey: 'cookbookId',
  otherKey: 'recipeId',
  as: 'recipes',
});
CookbookRecipe.belongsTo(User, { foreignKey: 'addedBy', as: 'addedByUser' });

/* --- Recette ↔ Tag (N–N) --- */
Recipe.belongsToMany(Tag, {
  through: RecipeTag,
  foreignKey: 'recipeId',
  otherKey: 'tagId',
  as: 'tags',
});
Tag.belongsToMany(Recipe, {
  through: RecipeTag,
  foreignKey: 'tagId',
  otherKey: 'recipeId',
  as: 'recipes',
});

/* --- Favoris --- */
User.hasMany(Favorite, { foreignKey: 'userId', as: 'favorites', ...CASCADE });
Favorite.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Recipe.hasMany(Favorite, { foreignKey: 'recipeId', as: 'favoritedBy', ...CASCADE });
Favorite.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });

/* --- Planning --- */
User.hasMany(MealPlanEntry, { foreignKey: 'userId', as: 'mealPlan', ...CASCADE });
MealPlanEntry.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Cookbook.hasMany(MealPlanEntry, { foreignKey: 'cookbookId', as: 'mealPlan', ...CASCADE });
MealPlanEntry.belongsTo(Cookbook, { foreignKey: 'cookbookId', as: 'cookbook' });
Recipe.hasMany(MealPlanEntry, { foreignKey: 'recipeId', as: 'plannedIn', ...CASCADE });
MealPlanEntry.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });

/* --- Commentaires (privés au cookbook) & avis (publics) --- */
Recipe.hasMany(Comment, { foreignKey: 'recipeId', as: 'comments', ...CASCADE });
Comment.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });
Cookbook.hasMany(Comment, { foreignKey: 'cookbookId', as: 'comments', ...CASCADE });
Comment.belongsTo(Cookbook, { foreignKey: 'cookbookId', as: 'cookbook' });
User.hasMany(Comment, { foreignKey: 'userId', as: 'comments', ...CASCADE });
Comment.belongsTo(User, { foreignKey: 'userId', as: 'author' });

Recipe.hasMany(Review, { foreignKey: 'recipeId', as: 'reviews', ...CASCADE });
Review.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });
User.hasMany(Review, { foreignKey: 'userId', as: 'reviews', ...CASCADE });
Review.belongsTo(User, { foreignKey: 'userId', as: 'author' });

/* --- Messagerie --- */
Cookbook.hasMany(Message, { foreignKey: 'cookbookId', as: 'messages', ...CASCADE });
Message.belongsTo(Cookbook, { foreignKey: 'cookbookId', as: 'cookbook' });
User.hasMany(Message, { foreignKey: 'userId', as: 'messages', ...CASCADE });
Message.belongsTo(User, { foreignKey: 'userId', as: 'author' });

/* --- Liste de courses --- */
Cookbook.hasMany(ShoppingList, { foreignKey: 'cookbookId', as: 'shoppingLists', ...CASCADE });
ShoppingList.belongsTo(Cookbook, { foreignKey: 'cookbookId', as: 'cookbook' });
User.hasMany(ShoppingList, { foreignKey: 'userId', as: 'shoppingLists', ...CASCADE });
ShoppingList.belongsTo(User, { foreignKey: 'userId', as: 'user' });
ShoppingList.hasMany(ShoppingListItem, { foreignKey: 'shoppingListId', as: 'items', ...CASCADE });
ShoppingListItem.belongsTo(ShoppingList, { foreignKey: 'shoppingListId', as: 'list' });
Ingredient.hasMany(ShoppingListItem, { foreignKey: 'ingredientId', as: 'shoppingUsages' });
ShoppingListItem.belongsTo(Ingredient, { foreignKey: 'ingredientId', as: 'ingredient' });

export {
  sequelize,
  User,
  UserPreferences,
  OAuthAccount,
  RefreshToken,
  Cookbook,
  CookbookMembership,
  CookbookInvitation,
  Recipe,
  CookbookRecipe,
  RecipeStep,
  Ingredient,
  RecipeIngredient,
  Tag,
  RecipeTag,
  Favorite,
  MealPlanEntry,
  Comment,
  Review,
  Message,
  ShoppingList,
  ShoppingListItem,
};
