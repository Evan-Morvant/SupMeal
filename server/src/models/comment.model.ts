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
import type { Recipe } from './recipe.model';
import type { User } from './user.model';

/** Commentaire sur une recette, **privé au cookbook** (`cookbookId`)*/
export class Comment extends Model<
  InferAttributes<Comment>,
  InferCreationAttributes<Comment>
> {
  declare id: CreationOptional<string>;
  declare recipeId: string;
  declare cookbookId: string;
  declare userId: string;
  declare content: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare author?: NonAttribute<User>;
  declare recipe?: NonAttribute<Recipe>;
  declare cookbook?: NonAttribute<Cookbook>;
}

Comment.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    recipeId: { type: DataTypes.UUID, allowNull: false },
    cookbookId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'comments',
    underscored: true,
    indexes: [{ fields: ['recipe_id', 'cookbook_id'] }],
  },
);
