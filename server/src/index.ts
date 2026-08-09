import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { sequelize } from './config/database';
import { createRealtimeServer } from './realtime';
import './models';

async function bootstrap(): Promise<void> {
  const app = createApp();
  const server = http.createServer(app);

  // Messagerie temps réel : partage le serveur HTTP de l'API (cf. conception §WebSocket).
  createRealtimeServer(server);

  try {
    await sequelize.authenticate();
    console.log('Base de données connectée');
  } catch (err) {
    console.error(
      'Connexion BDD échouée (le serveur démarre quand même) :',
      (err as Error).message,
    );
  }

  server.listen(env.API_PORT, () => {
    console.log('SUPMEAL API : http://localhost:' + env.API_PORT + '/api/v1');
  });
}

void bootstrap();
