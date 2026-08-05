import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../config/database';
import type { Role } from '../middlewares/require-role';

export type InvitationStatus = 'pending' | 'accepted' | 'declined';

/** Invitation à rejoindre un cookbook, identifiée par un token unique. */
export class CookbookInvitation extends Model<
  InferAttributes<CookbookInvitation>,
  InferCreationAttributes<CookbookInvitation>
> {
  declare id: CreationOptional<string>;
  declare cookbookId: string;
  declare invitedEmail: string;
  declare role: Role;
  declare token: string;
  declare status: CreationOptional<InvitationStatus>;
  declare createdAt: CreationOptional<Date>;
}

CookbookInvitation.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    cookbookId: { type: DataTypes.UUID, allowNull: false },
    invitedEmail: { type: DataTypes.STRING, allowNull: false },
    role: {
      type: DataTypes.ENUM('OWNER', 'EDITOR', 'COMMENTER', 'READER'),
      allowNull: false,
      defaultValue: 'READER',
    },
    token: { type: DataTypes.STRING, allowNull: false, unique: true },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'declined'),
      allowNull: false,
      defaultValue: 'pending',
    },
    createdAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'cookbook_invitations',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  },
);
