import 'dotenv/config';
import { z } from 'zod';

/**
 * Validation et typage des variables d'environnement au démarrage.
 * Si une variable obligatoire manque, le serveur s'arrête avec un message clair.
 */

/**
 * Secret jetons : obligatoire.
 */
const jwtSecret = z
  .string({ required_error: 'variable absente' })
  .min(32, 'au moins 32 caractères attendus');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z
    .string()
    .default('postgres://supmeal:change_me@localhost:5432/supmeal'),
  JWT_ACCESS_SECRET: jwtSecret,
  JWT_REFRESH_SECRET: jwtSecret,
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  // Plafond du limiteur sur les routes d'authentification, par fenêtre et par IP.
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(20),
  // URL publique de l'API, utilisée pour les callbacks OAuth et les images.
  API_PUBLIC_URL: z.string().default('http://localhost:4000'),
  // Stockage des fichiers envoyés (images) : monté en volume Docker.
  UPLOAD_DIR: z.string().default('./uploads'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  // Identifiants OAuth2 (vides si le provider n'est pas configuré).
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map(
    (issue) => '  - ' + issue.path.join('.') + ' : ' + issue.message,
  );
  console.error(
    [
      'Configuration invalide, le serveur ne peut pas démarrer :',
      ...details,
      '',
      'Générer un secret : openssl rand -hex 32',
      'puis renseigner la valeur dans le fichier .env (cf. README, section Prérequis).',
    ].join('\n'),
  );
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
