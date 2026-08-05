import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../config/database';

/** Association N–N entre recettes et tags (clé primaire composite). */
export class RecipeTag extends Model<
  InferAttributes<RecipeTag>,
  InferCreationAttributes<RecipeTag>
> {
  declare recipeId: string;
  declare tagId: string;
}

RecipeTag.init(
  {
    recipeId: { type: DataTypes.UUID, primaryKey: true },
    tagId: { type: DataTypes.UUID, primaryKey: true },
  },
  { sequelize, tableName: 'recipe_tags', underscored: true, timestamps: false },
);
