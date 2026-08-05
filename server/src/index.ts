import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { createApp } from './app';
import { env } from './config/env';
import { sequelize } from './config/database';
import './models';

async function bootstrap(): Promise<void> {
  const app = createApp();
  const server = http.createServer(app);

  // Messagerie temps réel (cf. conception §WebSocket) — handshake & rooms à implémenter.
  const io = new SocketServer(server, { cors: { origin: env.CLIENT_ORIGIN } });
  io.on('connection', (socket) => {
    // TODO (Phase 2) : authentification du handshake + salons par cookbook.
    socket.on('disconnect', () => undefined);
  });

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
