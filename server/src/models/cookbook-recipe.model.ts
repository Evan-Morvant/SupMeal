import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../config/database';

/** Table d'association N–N entre cookbooks et recettes. */
export class CookbookRecipe extends Model<
  InferAttributes<CookbookRecipe>,
  InferCreationAttributes<CookbookRecipe>
> {
  declare id: CreationOptional<string>;
  declare cookbookId: string;
  declare recipeId: string;
  declare addedBy: string;
  declare addedAt: CreationOptional<Date>;
}

CookbookRecipe.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    cookbookId: { type: DataTypes.UUID, allowNull: false },
    recipeId: { type: DataTypes.UUID, allowNull: false },
    addedBy: { type: DataTypes.UUID, allowNull: false },
    addedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'cookbook_recipes',
    underscored: true,
    timestamps: false,
    indexes: [
      { unique: true, fields: ['cookbook_id', 'recipe_id'] },
      { fields: ['recipe_id'] },
    ],
  },
);
