import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../config/database';

export type OAuthProvider = 'google' | 'microsoft' | 'github';

/** Liaison entre un compte local et un fournisseur OAuth2. */
export class OAuthAccount extends Model<
  InferAttributes<OAuthAccount>,
  InferCreationAttributes<OAuthAccount>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare provider: OAuthProvider;
  declare providerUserId: string;
  declare createdAt: CreationOptional<Date>;
}

OAuthAccount.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    provider: {
      type: DataTypes.ENUM('google', 'github'),
      allowNull: false,
    },
    providerUserId: { type: DataTypes.STRING, allowNull: false },
    createdAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'oauth_accounts',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  },
);
