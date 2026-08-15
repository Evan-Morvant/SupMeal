import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

/**
 * Swagger UI sur `/api/v1/swagger`, à partir de `openapi.yaml`. La
 * spécification est écrite à la main (conception design-first) et non générée
 * depuis les routes.
 */

const SPEC_PATH = path.join(__dirname, '..', '..', '..', 'openapi.yaml');

const spec = parse(fs.readFileSync(SPEC_PATH, 'utf8')) as swaggerUi.JsonObject;

export const docsRouter = Router();

// Swagger UI s'amorce par un script en ligne, qu'Helmet interdit par défaut.
// L'assouplissement reste limité à cette route.
docsRouter.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
    },
  }),
);

// La spécification brute.
docsRouter.get('/openapi.json', (_req, res) => {
  res.json(spec);
});

docsRouter.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(spec, {
    customSiteTitle: 'SUPMEAL — API REST',
    swaggerOptions: { docExpansion: 'none', persistAuthorization: true },
  }),
);
