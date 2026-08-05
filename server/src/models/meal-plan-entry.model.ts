import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../config/database';

export type MealType = 'petit-déjeuner' | 'déjeuner' | 'dîner' | 'collation';

/**
 * Entrée de planning de repas. `cookbookId` null = planning personnel ;
 * renseigné = planning partagé du cookbook.
 */
export class MealPlanEntry extends Model<
  InferAttributes<MealPlanEntry>,
  InferCreationAttributes<MealPlanEntry>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare cookbookId: string | null;
  declare recipeId: string;
  declare date: string;
  declare mealType: MealType;
  declare servings: number | null;
}

MealPlanEntry.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    cookbookId: { type: DataTypes.UUID, allowNull: true },
    recipeId: { type: DataTypes.UUID, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    mealType: {
      type: DataTypes.ENUM('petit-déjeuner', 'déjeuner', 'dîner', 'collation'),
      allowNull: false,
    },
    servings: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    tableName: 'meal_plan_entries',
    underscored: true,
    timestamps: false,
    indexes: [{ fields: ['user_id', 'date'] }, { fields: ['cookbook_id', 'date'] }],
  },
);
