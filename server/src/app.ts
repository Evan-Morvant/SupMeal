import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import passport from 'passport';
import { env } from './config/env';
import { UPLOADS_ROUTE } from './common/uploads';
import { router } from './routes';
import { configurePassport } from './config/passport';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';

/** Construit l'application Express (séparée du bootstrap pour la testabilité). */
export function createApp(): Application {
  const app = express();

  app.use(helmet());
  /*
   * `Content-Disposition` doit être exposé : il ne fait pas partie des en-têtes
   * qu'un navigateur laisse lire par défaut.
   */
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use(express.json({ limit: '5mb' }));
  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
  }

  configurePassport();
  app.use(passport.initialize());

  app.use(
    UPLOADS_ROUTE,
    helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }),
    express.static(env.UPLOAD_DIR, { index: false }),
  );

  app.use('/api/v1', router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
