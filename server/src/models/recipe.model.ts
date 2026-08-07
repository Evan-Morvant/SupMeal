import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import type { RecipeIngredient } from './recipe-ingredient.model';
import type { RecipeStep } from './recipe-step.model';
import type { Tag } from './tag.model';

export type RecipeVisibility = 'private' | 'public';

/**
 * Recette. `ownerId` = créateur unique ; la recette existe indépendamment
 * des cookbooks (liaison N–N via CookbookRecipe).
 * `search_vector` (tsvector) est maintenu côté BDD par trigger et n'est donc
 * pas mappé ici : la recherche plein texte passe par une requête SQL dédiée.
 */
export class Recipe extends Model<
  InferAttributes<Recipe>,
  InferCreationAttributes<Recipe>
> {
  declare id: CreationOptional<string>;
  declare ownerId: string;
  declare title: string;
  declare description: string | null;
  declare prepTimeMin: number | null;
  declare cookTimeMin: number | null;
  declare servings: number | null;
  declare imageUrl: string | null;
  declare source: string | null;
  declare visibility: CreationOptional<RecipeVisibility>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Renseignées seulement quand la requête les charge via `include`.
  declare ingredients?: NonAttribute<RecipeIngredient[]>;
  declare steps?: NonAttribute<RecipeStep[]>;
  declare tags?: NonAttribute<Tag[]>;
}

Recipe.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    ownerId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    prepTimeMin: { type: DataTypes.INTEGER, allowNull: true },
    cookTimeMin: { type: DataTypes.INTEGER, allowNull: true },
    servings: { type: DataTypes.INTEGER, allowNull: true },
    imageUrl: { type: DataTypes.STRING, allowNull: true },
    source: { type: DataTypes.STRING, allowNull: true },
    visibility: {
      type: DataTypes.ENUM('private', 'public'),
      allowNull: false,
      defaultValue: 'private',
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'recipes', underscored: true },
);
