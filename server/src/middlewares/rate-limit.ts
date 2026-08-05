import rateLimit from 'express-rate-limit';

/**
 * Limiteur pour les routes sensibles (inscription, connexion) afin de freiner
 * le bruteforce : 20 requêtes par fenêtre de 15 minutes et par IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
