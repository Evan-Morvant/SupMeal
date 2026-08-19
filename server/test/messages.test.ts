import { createServer, type Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app';
import { createRealtimeServer } from '../src/realtime';
import { CookbookMembership, Message, User } from '../src/models';
import type { Role } from '../src/middlewares/require-role';

const app = createApp();
const base = '/api/v1/cookbooks';

/**
 * Les tests WebSocket ont besoin d'un serveur qui écoute réellement — Supertest
 * ne fait que simuler des requêtes HTTP. On monte donc l'application et le
 * serveur temps réel sur un port libre, une fois pour tout le fichier.
 */
let httpServer: HttpServer;
let realtimeUrl: string;
const openSockets: ClientSocket[] = [];

beforeAll(async () => {
  httpServer = createServer(app);
  createRealtimeServer(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  realtimeUrl = 'http://localhost:' + (httpServer.address() as AddressInfo).port;
});

afterEach(() => {
  openSockets.splice(0).forEach((socket) => socket.disconnect());
});

afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

async function registerUser(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'Motdepasse123!', displayName: email.split('@')[0] });
  return res.body.accessToken;
}

const bearer = (token: string) => 'Bearer ' + token;

async function addMember(cookbookId: string, email: string, role: Role): Promise<string> {
  const user = await User.findOne({ where: { email } });
  await CookbookMembership.create({ cookbookId, userId: user!.id, role });
  return user!.id;
}

async function createCookbook(token: string, name = 'Cuisine de famille'): Promise<string> {
  const res = await request(app)
    .post(base)
    .set('Authorization', bearer(token))
    .send({ name });
  return res.body.id;
}

const messagesUrl = (cookbookId: string) => base + '/' + cookbookId + '/messages';

function post(token: string, cookbookId: string, content: string) {
  return request(app)
    .post(messagesUrl(cookbookId))
    .set('Authorization', bearer(token))
    .send({ content });
}

/** Client WebSocket suivi, fermé automatiquement à la fin du test. */
function openSocket(token?: string): ClientSocket {
  const socket = connectClient(realtimeUrl, {
    auth: token === undefined ? {} : { token },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  openSockets.push(socket);
  return socket;
}

/** Attend un événement, ou échoue plutôt que de laisser le test s'éterniser. */
function waitFor<T>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Aucun événement '" + event + "' reçu")),
      timeoutMs,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Vérifie qu'un événement n'arrive **pas** : c'est l'absence qui fait la preuve. */
async function expectSilence(socket: ClientSocket, event: string, ms = 400): Promise<void> {
  let received: unknown = null;
  socket.once(event, (payload: unknown) => {
    received = payload;
  });
  await new Promise((resolve) => setTimeout(resolve, ms));
  expect(received).toBeNull();
}

/** Connecte un client et le fait entrer dans le salon du cookbook. */
async function joinRoom(token: string, cookbookId: string): Promise<ClientSocket> {
  const socket = openSocket(token);
  socket.emit('cookbook:join', { cookbookId });
  await waitFor(socket, 'cookbook:joined');
  return socket;
}

describe('Historique REST du salon', () => {
  it('un commentateur envoie un message -> 201 avec son auteur', async () => {
    const owner = await registerUser('msg-owner@test.fr');
    const commenter = await registerUser('msg-commenter@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'msg-commenter@test.fr', 'COMMENTER');

    const res = await post(commenter, cookbookId, 'On mange quoi dimanche ?');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ content: 'On mange quoi dimanche ?', cookbookId });
    expect(res.body.author.email).toBe('msg-commenter@test.fr');
    expect(res.body.author.passwordHash).toBeUndefined();
  });

  it('un lecteur ne peut pas écrire dans le salon -> 403', async () => {
    const owner = await registerUser('msg-owner2@test.fr');
    const reader = await registerUser('msg-reader@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'msg-reader@test.fr', 'READER');

    const res = await post(reader, cookbookId, 'Bonjour');

    expect(res.status).toBe(403);
    expect(await Message.count({ where: { cookbookId } })).toBe(0);
  });

  it('un lecteur ne peut pas non plus suivre la conversation -> 403', async () => {
    const owner = await registerUser('msg-owner3@test.fr');
    const reader = await registerUser('msg-reader2@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'msg-reader2@test.fr', 'READER');

    const res = await request(app)
      .get(messagesUrl(cookbookId))
      .set('Authorization', bearer(reader));

    expect(res.status).toBe(403);
  });

  it("un non-membre reçoit 404, l'existence du cookbook ne lui est pas confirmée", async () => {
    const owner = await registerUser('msg-owner4@test.fr');
    const stranger = await registerUser('msg-stranger@test.fr');
    const cookbookId = await createCookbook(owner);

    const res = await request(app)
      .get(messagesUrl(cookbookId))
      .set('Authorization', bearer(stranger));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COOKBOOK_NOT_FOUND');
  });

  it('sans jeton -> 401', async () => {
    const owner = await registerUser('msg-owner5@test.fr');
    const cookbookId = await createCookbook(owner);

    const res = await request(app).get(messagesUrl(cookbookId));

    expect(res.status).toBe(401);
  });

  it('un message vide est refusé -> 400', async () => {
    const owner = await registerUser('msg-owner6@test.fr');
    const cookbookId = await createCookbook(owner);

    const res = await post(owner, cookbookId, '');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it("l'historique est rendu dans l'ordre de la conversation", async () => {
    const owner = await registerUser('msg-owner7@test.fr');
    const cookbookId = await createCookbook(owner);
    await post(owner, cookbookId, 'Premier');
    await post(owner, cookbookId, 'Deuxième');
    await post(owner, cookbookId, 'Troisième');

    const res = await request(app)
      .get(messagesUrl(cookbookId))
      .set('Authorization', bearer(owner));

    expect(res.status).toBe(200);
    expect(res.body.map((m: { content: string }) => m.content)).toEqual([
      'Premier',
      'Deuxième',
      'Troisième',
    ]);
  });

  it('la page 1 porte les messages les plus récents, la page 2 remonte le fil', async () => {
    const owner = await registerUser('msg-owner8@test.fr');
    const cookbookId = await createCookbook(owner);
    await post(owner, cookbookId, 'Premier');
    await post(owner, cookbookId, 'Deuxième');
    await post(owner, cookbookId, 'Troisième');

    const recent = await request(app)
      .get(messagesUrl(cookbookId) + '?page=1&pageSize=2')
      .set('Authorization', bearer(owner));
    const older = await request(app)
      .get(messagesUrl(cookbookId) + '?page=2&pageSize=2')
      .set('Authorization', bearer(owner));

    expect(recent.body.map((m: { content: string }) => m.content)).toEqual([
      'Deuxième',
      'Troisième',
    ]);
    expect(older.body.map((m: { content: string }) => m.content)).toEqual(['Premier']);
  });

  it('le salon d un cookbook ne laisse pas voir celui d un autre', async () => {
    const owner = await registerUser('msg-owner9@test.fr');
    const familyId = await createCookbook(owner, 'Famille');
    const colleaguesId = await createCookbook(owner, 'Collègues');
    await post(owner, familyId, 'Message de famille');

    const res = await request(app)
      .get(messagesUrl(colleaguesId))
      .set('Authorization', bearer(owner));

    expect(res.body).toEqual([]);
  });
});

describe('Handshake WebSocket', () => {
  it('sans jeton, la connexion est refusée', async () => {
    const socket = openSocket();

    const err = await waitFor<Error & { data?: { code: string } }>(socket, 'connect_error');

    expect(err.data?.code).toBe('UNAUTHORIZED');
    expect(socket.connected).toBe(false);
  });

  it('avec un jeton invalide, la connexion est refusée', async () => {
    const socket = openSocket('pas.un.jwt');

    const err = await waitFor<Error & { data?: { code: string } }>(socket, 'connect_error');

    expect(err.data?.code).toBe('UNAUTHORIZED');
  });

  it('avec un jeton valide, la connexion est établie', async () => {
    const token = await registerUser('ws-ok@test.fr');
    const socket = openSocket(token);

    await waitFor(socket, 'connect');

    expect(socket.connected).toBe(true);
  });
});

describe('Salons WebSocket', () => {
  it('un non-membre ne peut pas entrer dans le salon', async () => {
    const owner = await registerUser('ws-owner@test.fr');
    const stranger = await registerUser('ws-stranger@test.fr');
    const cookbookId = await createCookbook(owner);

    const socket = openSocket(stranger);
    socket.emit('cookbook:join', { cookbookId });
    const err = await waitFor<{ code: string }>(socket, 'app:error');

    expect(err.code).toBe('COOKBOOK_NOT_FOUND');
  });

  it('un lecteur ne peut pas entrer dans le salon', async () => {
    const owner = await registerUser('ws-owner2@test.fr');
    const reader = await registerUser('ws-reader@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'ws-reader@test.fr', 'READER');

    const socket = openSocket(reader);
    socket.emit('cookbook:join', { cookbookId });
    const err = await waitFor<{ code: string }>(socket, 'app:error');

    expect(err.code).toBe('FORBIDDEN');
  });

  it('un identifiant de cookbook mal formé est rejeté sans toucher la base', async () => {
    const token = await registerUser('ws-badid@test.fr');

    const socket = openSocket(token);
    socket.emit('cookbook:join', { cookbookId: 'pas-un-uuid' });
    const err = await waitFor<{ code: string }>(socket, 'app:error');

    expect(err.code).toBe('VALIDATION_ERROR');
  });
});

describe('Diffusion des messages', () => {
  it('un message envoyé en WebSocket est diffusé aux membres du salon et persisté', async () => {
    const owner = await registerUser('ws-chat-owner@test.fr');
    const commenter = await registerUser('ws-chat-commenter@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'ws-chat-commenter@test.fr', 'COMMENTER');

    const listener = await joinRoom(owner, cookbookId);
    const sender = await joinRoom(commenter, cookbookId);

    const received = waitFor<{ content: string; author: { email: string } }>(
      listener,
      'message:new',
    );
    sender.emit('message:send', { cookbookId, content: 'Je ramène le dessert' });
    const message = await received;

    expect(message.content).toBe('Je ramène le dessert');
    expect(message.author.email).toBe('ws-chat-commenter@test.fr');
    expect(await Message.count({ where: { cookbookId } })).toBe(1);
  });

  it('la diffusion reste dans le salon : un autre cookbook ne reçoit rien', async () => {
    const owner = await registerUser('ws-scope-owner@test.fr');
    const familyId = await createCookbook(owner, 'Famille');
    const colleaguesId = await createCookbook(owner, 'Collègues');

    const family = await joinRoom(owner, familyId);
    const colleagues = await joinRoom(owner, colleaguesId);

    const received = waitFor<{ content: string }>(family, 'message:new');
    const silence = expectSilence(colleagues, 'message:new');
    family.emit('message:send', { cookbookId: familyId, content: 'Entre nous' });

    expect((await received).content).toBe('Entre nous');
    await silence;
  });

  it('un message envoyé en repli REST atteint aussi les clients WebSocket', async () => {
    const owner = await registerUser('ws-fallback-owner@test.fr');
    const commenter = await registerUser('ws-fallback-commenter@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'ws-fallback-commenter@test.fr', 'COMMENTER');

    const listener = await joinRoom(owner, cookbookId);
    const received = waitFor<{ content: string }>(listener, 'message:new');
    await post(commenter, cookbookId, 'Envoyé sans WebSocket');

    expect((await received).content).toBe('Envoyé sans WebSocket');
  });

  it('un membre exclu après son entrée ne peut plus écrire dans le salon', async () => {
    const owner = await registerUser('ws-kick-owner@test.fr');
    const commenter = await registerUser('ws-kick-commenter@test.fr');
    const cookbookId = await createCookbook(owner);
    const commenterId = await addMember(cookbookId, 'ws-kick-commenter@test.fr', 'COMMENTER');

    const sender = await joinRoom(commenter, cookbookId);
    await CookbookMembership.destroy({ where: { cookbookId, userId: commenterId } });

    sender.emit('message:send', { cookbookId, content: 'Toujours là ?' });
    const err = await waitFor<{ code: string }>(sender, 'app:error');

    expect(err.code).toBe('COOKBOOK_NOT_FOUND');
    expect(await Message.count({ where: { cookbookId } })).toBe(0);
  });

  it('un membre rétrogradé en lecteur ne peut plus écrire dans le salon', async () => {
    const owner = await registerUser('ws-demote-owner@test.fr');
    const commenter = await registerUser('ws-demote-commenter@test.fr');
    const cookbookId = await createCookbook(owner);
    const commenterId = await addMember(
      cookbookId,
      'ws-demote-commenter@test.fr',
      'COMMENTER',
    );

    const sender = await joinRoom(commenter, cookbookId);
    await CookbookMembership.update(
      { role: 'READER' },
      { where: { cookbookId, userId: commenterId } },
    );

    sender.emit('message:send', { cookbookId, content: 'Encore un mot' });
    const err = await waitFor<{ code: string }>(sender, 'app:error');

    expect(err.code).toBe('FORBIDDEN');
    expect(await Message.count({ where: { cookbookId } })).toBe(0);
  });

  it('un message vide est refusé côté WebSocket comme côté REST', async () => {
    const owner = await registerUser('ws-empty-owner@test.fr');
    const cookbookId = await createCookbook(owner);
    const sender = await joinRoom(owner, cookbookId);

    sender.emit('message:send', { cookbookId, content: '' });
    const err = await waitFor<{ code: string }>(sender, 'app:error');

    expect(err.code).toBe('VALIDATION_ERROR');
    expect(await Message.count({ where: { cookbookId } })).toBe(0);
  });

  it('après avoir quitté le salon, un client ne reçoit plus rien', async () => {
    const owner = await registerUser('ws-leave-owner@test.fr');
    const commenter = await registerUser('ws-leave-commenter@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'ws-leave-commenter@test.fr', 'COMMENTER');

    const listener = await joinRoom(owner, cookbookId);
    const sender = await joinRoom(commenter, cookbookId);

    listener.emit('cookbook:leave', { cookbookId });
    // Un aller-retour serveur garantit que la sortie est traitée avant l'envoi.
    listener.emit('cookbook:join', { cookbookId: 'pas-un-uuid' });
    await waitFor(listener, 'app:error');

    const silence = expectSilence(listener, 'message:new');
    sender.emit('message:send', { cookbookId, content: 'Personne ne m entend' });
    await silence;

    expect(await Message.count({ where: { cookbookId } })).toBe(1);
  });
});
