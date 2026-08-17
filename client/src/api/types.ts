/*
 * Miroir du contrat de l'API (server/src/common/serialize.ts et openapi.yaml).
 * Le client ne redéfinit aucune règle métier : il ne fait que nommer ce qu'il
 * reçoit. Toute divergence ici est un bug, pas une adaptation.
 */

/** Hiérarchie des rôles d'un membre de cookbook, du plus faible au plus fort. */
export const ROLES = ['READER', 'COMMENTER', 'EDITOR', 'OWNER'] as const;
export type Role = (typeof ROLES)[number];

export const TAG_TYPES = ['cuisine', 'diet', 'difficulty', 'course', 'custom'] as const;
export type TagType = (typeof TAG_TYPES)[number];

/** Créneaux de la journée, dans l'ordre où l'API les trie. */
export const MEAL_TYPES = ['petit-déjeuner', 'déjeuner', 'dîner', 'collation'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export type Visibility = 'private' | 'public';
export type InvitationStatus = 'pending' | 'accepted' | 'declined';
export type ExportFormat = 'json' | 'csv' | 'mealie';
export type OAuthProvider = 'google' | 'github';

/** Enveloppe paginée, identique pour /recipes et /discover/recipes. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  diets: string[];
  allergies: string[];
  preferredCuisines: string[];
  defaultServings: number | null;
}

export interface OAuthAccount {
  id: string;
  provider: OAuthProvider;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  type: TagType;
}

export interface Ingredient {
  id: string;
  name: string;
}

/** Résumé de recette : ce que rendent les listes, sans ingrédients ni étapes. */
export interface RecipeSummary {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  servings: number | null;
  imageUrl: string | null;
  source: string | null;
  visibility: Visibility;
  avgRating: number | null;
  reviewCount: number;
  isFavorite: boolean;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

/** Ligne d'ingrédient : la quantité reste facultative (sel, poivre). */
export interface IngredientLine {
  name: string | null;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  position: number;
}

export interface RecipeStep {
  position: number;
  instruction: string;
}

export interface Recipe extends RecipeSummary {
  ingredients: IngredientLine[];
  steps: RecipeStep[];
}

/** Suggestion : la recette, son score et surtout ses motifs en clair. */
export interface Suggestion {
  recipe: RecipeSummary;
  score: number;
  reasons: string[];
}

export interface Cookbook {
  id: string;
  name: string;
  description: string | null;
  myRole: Role;
  memberCount: number;
  recipeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  user: User | null;
  role: Role;
  joinedAt: string;
}

export interface Invitation {
  id: string;
  invitedEmail: string;
  role: Role;
  status: InvitationStatus;
  createdAt: string;
}

/** Le token en clair n'apparaît qu'à la création : il n'est jamais relu. */
export interface CreatedInvitation extends Invitation {
  token: string;
  acceptUrl: string;
}

export interface Comment {
  id: string;
  recipeId: string;
  cookbookId: string;
  author: User | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  recipeId: string;
  author: User | null;
  rating: number;
  body: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Les avis d'une recette sont rendus en bloc, avec la moyenne : pas de pagination. */
export interface ReviewList {
  avgRating: number | null;
  reviewCount: number;
  items: Review[];
}

export interface Message {
  id: string;
  cookbookId: string;
  author: User | null;
  content: string;
  createdAt: string;
}

export interface MealPlanEntry {
  id: string;
  cookbookId: string | null;
  date: string;
  mealType: MealType;
  servings: number | null;
  author: User | null;
  recipe: RecipeSummary | null;
}

export interface ShoppingListItem {
  id: string;
  ingredient: Ingredient | null;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
}

export interface ShoppingList {
  id: string;
  name: string;
  cookbookId: string | null;
  fromDate: string;
  toDate: string;
  items: ShoppingListItem[];
  createdAt: string;
}

/** Compte rendu d'import : une recette invalide n'interrompt pas le reste. */
export interface ImportResult {
  format: ExportFormat;
  created: number;
  skipped: number;
  errors: string[];
}

/* --- Corps de requête --- */

export interface IngredientLineInput {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  note?: string | null;
}

export interface RecipeInput {
  title: string;
  description?: string | null;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  servings?: number | null;
  source?: string | null;
  visibility?: Visibility;
  ingredients?: IngredientLineInput[];
  steps?: string[];
  tags?: string[];
}

/** Filtres de la liste personnelle. La découverte en expose un sous-ensemble. */
export interface RecipeFilters {
  q?: string;
  cookbookId?: string;
  tags?: string[];
  ingredients?: string[];
  maxPrep?: number;
  maxCook?: number;
  favorite?: boolean;
  sort?: 'relevance' | 'recent' | 'prepTime';
  page?: number;
  pageSize?: number;
}

/** Ni cookbookId, ni favorite, ni ingredients : un visiteur n'a pas de compte. */
export interface DiscoverFilters {
  q?: string;
  tags?: string[];
  maxPrep?: number;
  maxCook?: number;
  sort?: 'relevance' | 'rating' | 'recent';
  page?: number;
  pageSize?: number;
}
