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
});

export const env = schema.parse(process.env);
export type Env = typeof env;
