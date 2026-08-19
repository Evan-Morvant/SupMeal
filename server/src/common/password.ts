import bcrypt from 'bcryptjs';
import { z } from 'zod';
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

/**
 * Politique de robustesse, définie une seule fois : l'inscription et le
 * changement de mot de passe l'importent toutes deux.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Le mot de passe doit contenir au moins 12 caractères')
  .regex(/[a-z]/, 'Le mot de passe doit contenir une minuscule')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir une majuscule')
  .regex(/[0-9]/, 'Le mot de passe doit contenir un chiffre')
  .regex(/[^A-Za-z0-9]/, 'Le mot de passe doit contenir un caractère spécial');

/** Hache un mot de passe en clair (jamais stocké tel quel — contrainte du sujet). */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Compare un mot de passe en clair à son empreinte stockée. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
