import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../config/database';

export type TagType = 'cuisine' | 'diet' | 'difficulty' | 'course' | 'custom';

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
      type: DataTypes.ENUM('cuisine', 'diet', 'difficulty', 'course', 'custom'),
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
