import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import type { User } from './user.model';

/**
 * Avis public sur une recette (note 1–5 + texte optionnel).
 * Un seul avis par couple (recette, utilisateur). Distinct du commentaire privé.
 */
export class Review extends Model<
  InferAttributes<Review>,
  InferCreationAttributes<Review>
> {
  declare id: CreationOptional<string>;
  declare recipeId: string;
  declare userId: string;
  declare rating: number;
  declare body: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Renseigné seulement quand la requête le charge via `include`.
  declare author?: NonAttribute<User>;
}

Review.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    recipeId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    rating: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      validate: { min: 1, max: 5 },
    },
    body: { type: DataTypes.TEXT, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'reviews',
    underscored: true,
    indexes: [{ unique: true, fields: ['recipe_id', 'user_id'] }],
  },
);
