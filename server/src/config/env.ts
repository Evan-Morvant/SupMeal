import 'dotenv/config';
import { z } from 'zod';

/**
 * Validation et typage des variables d'environnement au démarrage.
 * Si une variable obligatoire manque, le serveur s'arrête avec un message clair.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z
    .string()
    .default('postgres://supmeal:change_me@localhost:5432/supmeal'),
  JWT_ACCESS_SECRET: z.string().min(1).default('dev_access_secret'),
  JWT_REFRESH_SECRET: z.string().min(1).default('dev_refresh_secret'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  // Plafond du limiteur sur les routes d'authentification, par fenêtre et par IP.
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(20),
  // URL publique de l'API, utilisée pour construire les callbacks OAuth.
  API_PUBLIC_URL: z.string().default('http://localhost:4000'),
  // Identifiants OAuth2 (vides si le provider n'est pas configuré).
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
});

export const env = schema.parse(process.env);
export type Env = typeof env;
