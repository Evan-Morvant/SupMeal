/**
 * Types partagés par l'export et l'import.
 *
 * Les deux sens transitent par une même représentation neutre, `RecipeView` :
 * l'export part du modèle Sequelize et s'y ramène, l'import part du fichier et
 * y aboutit. Chaque format n'a donc qu'une seule forme à connaître, et une
 * recette exportée puis réimportée retrouve exactement son contenu.
 *
 * Cette forme est volontairement distincte de celle rendue par l'API : un
 * fichier d'export est un contrat durable, il ne doit pas changer parce que la
 * réponse HTTP a gagné un champ.
 */

import type { PreferencesInput } from '../users/users.schemas';

/** Ligne d'ingrédient, telle qu'attendue par le schéma de création de recette. */
export interface IngredientView {
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
}

/** Recette indépendante de tout format de fichier et de toute base. */
export interface RecipeView {
  title: string;
  description: string | null;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  servings: number | null;
  source: string | null;
  tags: string[];
  ingredients: IngredientView[];
  steps: string[];
}

/** Cookbook accompagnant l'export : sa composition, à titre documentaire. */
export interface CookbookView {
  name: string;
  description: string | null;
  recipeTitles: string[];
}

/**
 * Ensemble des données à exporter, avant mise en forme par un format.
 *
 * Les préférences culinaires ne figurent que dans l'export complet du compte :
 * un cookbook ou une recette isolée relèvent du contenu, pas du profil, et y
 * joindre le régime ou les allergies de l'exportateur reviendrait à les
 * divulguer à qui reçoit le fichier.
 */
export interface ExportPayload {
  exportedAt: string;
  owner: { email: string; displayName: string };
  preferences: PreferencesInput | null;
  recipes: RecipeView[];
  cookbooks: CookbookView[];
}

/**
 * Contenu exploitable d'un fichier importé. Les préférences n'existent que
 * dans le format natif ; les autres les rapportent à `null`.
 */
export interface ParsedFile {
  recipes: RecipeView[];
  preferences: PreferencesInput | null;
}

export const FORMAT_IDS = ['json', 'csv', 'mealie'] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

/**
 * Un format de fichier sait se produire et se relire. En ajouter un revient à
 * écrire un seul module et à l'inscrire au registre.
 */
export interface RecipeFormat {
  readonly id: FormatId;
  /** Extension du fichier proposé au téléchargement. */
  readonly extension: string;
  readonly contentType: string;
  serialize(payload: ExportPayload): string;
  /** Contenu lu dans le fichier ; lève une `AppError` 422 s'il est illisible. */
  parse(text: string): ParsedFile;
}

/**
 * Avertissement exigé au cahier des charges : l'export contient les données
 * personnelles en clair.
 */
export const EXPORT_WARNING =
  'Ce fichier contient vos données personnelles en clair. Conservez-le en lieu sûr et ' +
  'ne le partagez pas.';
