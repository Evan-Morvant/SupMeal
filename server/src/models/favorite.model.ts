import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import type { Recipe } from './recipe.model';

/** Mise en favori d'une recette par un utilisateur. */
export class Favorite extends Model<
  InferAttributes<Favorite>,
  InferCreationAttributes<Favorite>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare recipeId: string;
  declare createdAt: CreationOptional<Date>;

  declare recipe?: NonAttribute<Recipe>;
}

Favorite.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    recipeId: { type: DataTypes.UUID, allowNull: false },
    createdAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'favorites',
    underscored: true,
    timestamps: true,
    updatedAt: false,
    indexes: [{ unique: true, fields: ['user_id', 'recipe_id'] }],
  },
);
