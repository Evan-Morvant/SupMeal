import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../config/database';

/**
 * Source unique des types de tag : l'énumération PostgreSQL comme les schémas
 * de validation en dérivent, ils ne peuvent donc pas diverger.
 */
export const TAG_TYPES = ['cuisine', 'diet', 'difficulty', 'course', 'custom'] as const;

export type TagType = (typeof TAG_TYPES)[number];

/** Étiquette applicable aux recettes (cuisine, régime, difficulté…). */
export class Tag extends Model<InferAttributes<Tag>, InferCreationAttributes<Tag>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare type: CreationOptional<TagType>;
}

Tag.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    type: {
      type: DataTypes.ENUM(...TAG_TYPES),
      allowNull: false,
      defaultValue: 'custom',
    },
  },
  {
    sequelize,
    tableName: 'tags',
    underscored: true,
    timestamps: false,
    indexes: [{ unique: true, fields: ['name', 'type'] }],
  },
);
