import type { Server as HttpServer } from 'http';
import { DefaultEventsMap, ExtendedError, Server, Socket } from 'socket.io';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError } from '../common/app-error';
import { serializeMessage } from '../common/serialize';
import { verifyAccessToken } from '../common/tokens';
import type { AuthUser } from '../middlewares/authenticate';
import { assertChatAccess, postMessage } from '../modules/messages/messages.service';
import {
  cookbookEventSchema,
  sendMessageEventSchema,
} from '../modules/messages/messages.schemas';
import { broadcastMessage, cookbookRoom, registerRealtimeServer } from './bus';

/** Ce que le serveur retient d'un client, une fois le handshake passé. */
interface SocketData {
  user: AuthUser;
}

type ChatSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

/**
 * Erreur de handshake. Socket.io la transmet au client dans `connect_error`,
 * `data` portant le code, à l'image du format d'erreur de l'API REST.
 */
function handshakeError(message: string): ExtendedError {
  const error = new Error(message) as ExtendedError;
  error.data = { code: 'UNAUTHORIZED' };
  return error;
}

/**
 * Le jeton voyage dans `auth` du handshake ; l'en-tête `Authorization` est
 * accepté en second lieu pour les clients qui ne peuvent pas renseigner `auth`.
 */
function readToken(socket: ChatSocket): string | null {
  const fromAuth = socket.handshake.auth?.token;
  if (typeof fromAuth === 'string' && fromAuth.length > 0) {
    return fromAuth;
  }
  const header = socket.handshake.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

/**
 * Renvoie l'échec au client sous le même vocabulaire que l'API REST, pour
 * qu'un même code (`FORBIDDEN`, `COOKBOOK_NOT_FOUND`...) se traite d'un seul
 * côté du client, quelle que soit la voie empruntée.
 */
function emitError(socket: ChatSocket, err: unknown): void {
  if (err instanceof AppError) {
    socket.emit('app:error', { code: err.code, message: err.message });
    return;
  }
  if (err instanceof ZodError) {
    socket.emit('app:error', {
      code: 'VALIDATION_ERROR',
      message: 'Données invalides',
      details: err.issues,
    });
    return;
  }
  console.error(err);
  socket.emit('app:error', { code: 'INTERNAL_ERROR', message: 'Erreur interne' });
}

/**
 * Enveloppe commune aux gestionnaires : valide la charge utile, exécute, et
 * convertit tout échec en événement d'erreur. Sans cela une exception dans
 * une promesse non attendue ferait tomber le processus.
 */
function on<T>(
  socket: ChatSocket,
  event: string,
  schema: { parse: (payload: unknown) => T },
  handler: (payload: T) => Promise<void>,
): void {
  socket.on(event, (payload: unknown) => {
    void (async () => {
      try {
        await handler(schema.parse(payload));
      } catch (err) {
        emitError(socket, err);
      }
    })();
  });
}

/**
 * Serveur WebSocket de la messagerie.
 * Authentifié au handshake par le même JWT que l'API, un salon par cookbook.
 */
export function createRealtimeServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
  });

  // Aucune connexion n'est établie sans jeton valide : l'identité est acquise
  // avant le moindre échange, les gestionnaires n'ont plus à s'en soucier.
  io.use((socket: ChatSocket, next: (err?: ExtendedError) => void) => {
    const token = readToken(socket);
    if (!token) {
      next(handshakeError('Token manquant'));
      return;
    }
    try {
      socket.data.user = verifyAccessToken(token);
      next();
    } catch {
      next(handshakeError('Token invalide ou expiré'));
    }
  });

  io.on('connection', (socket: ChatSocket) => {
    on(socket, 'cookbook:join', cookbookEventSchema, async ({ cookbookId }) => {
      await assertChatAccess(socket.data.user.id, cookbookId);
      await socket.join(cookbookRoom(cookbookId));
      socket.emit('cookbook:joined', { cookbookId });
    });

    on(socket, 'cookbook:leave', cookbookEventSchema, async ({ cookbookId }) => {
      await socket.leave(cookbookRoom(cookbookId));
    });

    // L'accès est revérifié à chaque envoi : un membre exclu ou rétrogradé
    // après son entrée dans le salon ne doit plus pouvoir y écrire.
    on(socket, 'message:send', sendMessageEventSchema, async ({ cookbookId, content }) => {
      await assertChatAccess(socket.data.user.id, cookbookId);
      const message = await postMessage(socket.data.user.id, cookbookId, content);
      broadcastMessage(cookbookId, serializeMessage(message));
    });
  });

  registerRealtimeServer(io);
  return io;
}
