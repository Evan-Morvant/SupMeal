import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from '../config/database';

/**
 * Runner de migrations basé sur Umzug (moteur natif TypeScript).
 * Les migrations sont des fichiers `src/migrations/*.ts` exportant `up`/`down`,
 * suivies dans la table `sequelize_meta`. Le contexte fourni à chaque migration
 * est l'instance Sequelize (accès à `query` pour du SQL brut PostgreSQL).
 */
const migrationExt = __filename.endsWith('.ts') ? 'ts' : 'js';

export const migrator = new Umzug({
  migrations: { glob: ['../migrations/*.' + migrationExt, { cwd: __dirname }] },
  context: sequelize,
  storage: new SequelizeStorage({ sequelize, tableName: 'sequelize_meta' }),
  logger: console,
});

export type Migration = typeof migrator._types.migration;
