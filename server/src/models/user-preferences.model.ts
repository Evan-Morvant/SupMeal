import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../config/database';

/** Préférences culinaires d'un utilisateur (régimes, allergies, cuisines). */
export class UserPreferences extends Model<
  InferAttributes<UserPreferences>,
  InferCreationAttributes<UserPreferences>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare diets: string[];
  declare allergies: string[];
  declare preferredCuisines: string[];
  declare defaultServings: number;
}

UserPreferences.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, unique: true },
    diets: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
    allergies: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
    preferredCuisines: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      allowNull: false,
      defaultValue: [],
    },
    defaultServings: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2 },
  },
  { sequelize, tableName: 'user_preferences', underscored: true, timestamps: false },
);
