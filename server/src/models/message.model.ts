import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import type { Cookbook } from './cookbook.model';
import type { User } from './user.model';

/** Message de la messagerie temps réel d'un cookbook. */
export class Message extends Model<
  InferAttributes<Message>,
  InferCreationAttributes<Message>
> {
  declare id: CreationOptional<string>;
  declare cookbookId: string;
  declare userId: string;
  declare content: string;
  declare createdAt: CreationOptional<Date>;

  declare author?: NonAttribute<User>;
  declare cookbook?: NonAttribute<Cookbook>;
}

Message.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    cookbookId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    createdAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'messages',
    underscored: true,
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ['cookbook_id', 'created_at'] }],
  },
);
