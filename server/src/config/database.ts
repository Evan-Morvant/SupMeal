import { Sequelize } from 'sequelize';
import { env } from './env';

/**
 * Instance Sequelize partagée. Les modèles (User, Recipe, Cookbook, …)
 * seront enregistrés ici au fur et à mesure de l'implémentation.
 */
export const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: 'postgres',
  logging: env.NODE_ENV === 'development' ? console.log : false,
});
