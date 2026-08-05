import { beforeEach } from 'vitest';
import { sequelize } from '../src/config/database';

/**
 * Isolation entre tests : on vide les utilisateurs (et, en cascade, toutes les
 * tables qui les référencent : refresh_tokens, oauth_accounts, recettes...).
 * Les tags de référence (type 'course') ne référencent pas users et sont donc
 * préservés.
 */
beforeEach(async () => {
  await sequelize.query('TRUNCATE users RESTART IDENTITY CASCADE');
});
