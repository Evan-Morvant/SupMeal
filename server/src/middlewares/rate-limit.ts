import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * Limiteur pour les routes sensibles (inscription, connexion) afin de freiner
 * le bruteforce : 20 requêtes par fenêtre de 15 minutes et par IP. Le plafond
 * est relevé par la suite de tests, qui frappe ces routes depuis une seule IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
});
