import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../config/database';
import type { Role } from '../middlewares/require-role';

/** Appartenance d'un utilisateur à un cookbook, avec son rôle. */
export class CookbookMembership extends Model<
  InferAttributes<CookbookMembership>,
  InferCreationAttributes<CookbookMembership>
> {
  declare id: CreationOptional<string>;
  declare cookbookId: string;
  declare userId: string;
  declare role: Role;
  declare joinedAt: CreationOptional<Date>;
}

CookbookMembership.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    cookbookId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    role: {
      type: DataTypes.ENUM('OWNER', 'EDITOR', 'COMMENTER', 'READER'),
      allowNull: false,
      defaultValue: 'READER',
    },
    joinedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'cookbook_memberships',
    underscored: true,
    timestamps: false,
    indexes: [{ unique: true, fields: ['cookbook_id', 'user_id'] }],
  },
);
