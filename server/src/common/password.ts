import bcrypt from 'bcryptjs';
import { env } from '../config/env';

/**
 * Coût du hachage. Abaissé pour la seule suite de tests, qui crée près de 500
 * comptes jetables : au facteur 12 elle passe un quart de son temps à hacher
 * des mots de passe qui ne protègent rien.
 *
 * Le déclencheur est `NODE_ENV`, dont les valeurs sont closes par le schéma
 * d'environnement, et non une variable dédiée : aucune configuration ne peut
 * ainsi affaiblir le hachage en production par mégarde.
 */
const SALT_ROUNDS = env.NODE_ENV === 'test' ? 4 : 12;

/** Hache un mot de passe en clair (jamais stocké tel quel — contrainte du sujet). */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Compare un mot de passe en clair à son empreinte stockée. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
