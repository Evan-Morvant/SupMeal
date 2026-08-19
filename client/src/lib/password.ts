import { z } from 'zod';

/*
 * Miroir de la politique du serveur (`server/src/common/password.ts`) : le
 * formulaire répond tout de suite, l'API reste l'autorité. Les deux énoncés
 * doivent bouger ensemble.
 */

/** Énoncé de la règle, affiché en aide sous les champs concernés. */
export const PASSWORD_RULE =
  'Douze caractères au minimum, dont une minuscule, une majuscule, un chiffre et un caractère spécial.';

export const passwordSchema = z
  .string()
  .min(12, 'Le mot de passe doit contenir au moins 12 caractères')
  .regex(/[a-z]/, 'Le mot de passe doit contenir une minuscule')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir une majuscule')
  .regex(/[0-9]/, 'Le mot de passe doit contenir un chiffre')
  .regex(/[^A-Za-z0-9]/, 'Le mot de passe doit contenir un caractère spécial');

/** Première règle enfreinte, ou `null` si le mot de passe convient. */
export function passwordIssue(value: string): string | null {
  const result = passwordSchema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? PASSWORD_RULE);
}
