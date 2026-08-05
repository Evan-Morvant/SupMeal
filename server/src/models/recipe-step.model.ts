import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../config/database';

/** Étape ordonnée d'une recette. */
export class RecipeStep extends Model<
  InferAttributes<RecipeStep>,
  InferCreationAttributes<RecipeStep>
> {
  declare id: CreationOptional<string>;
  declare recipeId: string;
  declare position: number;
  declare instruction: string;
}

RecipeStep.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    recipeId: { type: DataTypes.UUID, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
    instruction: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    sequelize,
    tableName: 'recipe_steps',
    underscored: true,
    timestamps: false,
    indexes: [{ fields: ['recipe_id'] }],
  },
);
