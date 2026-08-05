import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/** Hache un mot de passe en clair (jamais stocké tel quel — contrainte du sujet). */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Compare un mot de passe en clair à son empreinte stockée. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
