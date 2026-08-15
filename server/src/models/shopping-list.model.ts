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
import type { ShoppingListItem } from './shopping-list-item.model';

/**
 * Liste de courses générée depuis un planning. `cookbookId` null = perso.
 */
export class ShoppingList extends Model<
  InferAttributes<ShoppingList>,
  InferCreationAttributes<ShoppingList>
> {
  declare id: CreationOptional<string>;
  declare cookbookId: string | null;
  declare userId: string;
  declare name: string;
  declare fromDate: string | null;
  declare toDate: string | null;
  declare createdAt: CreationOptional<Date>;

  declare items?: NonAttribute<ShoppingListItem[]>;
  declare cookbook?: NonAttribute<Cookbook>;
}

ShoppingList.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    cookbookId: { type: DataTypes.UUID, allowNull: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    fromDate: { type: DataTypes.DATEONLY, allowNull: true },
    toDate: { type: DataTypes.DATEONLY, allowNull: true },
    createdAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'shopping_lists',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  },
);
