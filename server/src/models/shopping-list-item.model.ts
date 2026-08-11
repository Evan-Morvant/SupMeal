import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import type { Ingredient } from './ingredient.model';

/** Ligne d'une liste de courses : ingrédient agrégé, quantité, coché ou non. */
export class ShoppingListItem extends Model<
  InferAttributes<ShoppingListItem>,
  InferCreationAttributes<ShoppingListItem>
> {
  declare id: CreationOptional<string>;
  declare shoppingListId: string;
  declare ingredientId: string;
  declare quantity: number | null;
  declare unit: string | null;
  declare checked: CreationOptional<boolean>;

  declare ingredient?: NonAttribute<Ingredient>;
}

ShoppingListItem.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    shoppingListId: { type: DataTypes.UUID, allowNull: false },
    ingredientId: { type: DataTypes.UUID, allowNull: false },
    quantity: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    unit: { type: DataTypes.STRING, allowNull: true },
    checked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    tableName: 'shopping_list_items',
    underscored: true,
    timestamps: false,
    indexes: [{ fields: ['shopping_list_id'] }],
  },
);
