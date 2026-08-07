import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import type { Ingredient } from './ingredient.model';

/** Ligne d'ingrédient d'une recette : quantité, unité, note libre. */
export class RecipeIngredient extends Model<
  InferAttributes<RecipeIngredient>,
  InferCreationAttributes<RecipeIngredient>
> {
  declare id: CreationOptional<string>;
  declare recipeId: string;
  declare ingredientId: string;
  declare quantity: number | null;
  declare unit: string | null;
  declare note: string | null;
  declare position: number;

  // Renseigné seulement quand la requête le charge via `include`.
  declare ingredient?: NonAttribute<Ingredient>;
}

RecipeIngredient.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    recipeId: { type: DataTypes.UUID, allowNull: false },
    ingredientId: { type: DataTypes.UUID, allowNull: false },
    quantity: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    unit: { type: DataTypes.STRING, allowNull: true },
    note: { type: DataTypes.STRING, allowNull: true },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    tableName: 'recipe_ingredients',
    underscored: true,
    timestamps: false,
    indexes: [{ fields: ['recipe_id'] }, { fields: ['ingredient_id'] }],
  },
);
