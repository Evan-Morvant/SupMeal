import { io } from 'socket.io-client';
import { API, call, check, checkEqual, main, register, section } from './lib.mjs';

/**
 * Messagerie de cookbook, de bout en bout : entrée dans le salon, diffusion
 * WebSocket, repli REST, historique, et perte du droit d'écrire après
 * rétrogradation — salon déjà ouvert compris.
 *
 * Usage : node scripts/demo/chat.mjs
 */

/** Attend un événement, ou abandonne plutôt que de rester suspendu. */
function waitFor(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Aucun événement '" + event + "' reçu en " + timeoutMs + ' ms')),
      timeoutMs,
    );
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/**
 * Attend un message précis. L'expéditeur reçoit lui aussi la diffusion de son
 * propre envoi : attendre « le prochain message » lirait celui d'avant.
 */
function waitForMessage(socket, content, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Message '" + content + "' non reçu en " + timeoutMs + ' ms')),
      timeoutMs,
    );
    const onMessage = (message) => {
      if (message.content !== content) {
        return;
      }
      clearTimeout(timer);
      socket.off('message:new', onMessage);
      resolve(message);
    };
    socket.on('message:new', onMessage);
  });
}

function connect(token) {
  return io(API, { auth: { token }, transports: ['websocket'] });
}

async function join(socket, cookbookId) {
  socket.emit('cookbook:join', { cookbookId });
  await waitFor(socket, 'cookbook:joined');
}

async function run() {
  const alice = await register('alice');
  const bob = await register('bob');
  const intrus = await register('intrus');

  const cookbook = await call('POST', '/cookbooks', {
    token: alice.token,
    body: { name: 'Cuisine de famille' },
  });
  const invitation = await call('POST', '/cookbooks/' + cookbook.id + '/invitations', {
    token: alice.token,
    body: { email: bob.email, role: 'COMMENTER' },
  });
  await call('POST', '/invitations/' + invitation.token + '/accept', { token: bob.token });

  section('Handshake');
  const refuse = connect('jeton.bidon.invalide');
  const erreurHandshake = await new Promise((resolve) => refuse.once('connect_error', resolve));
  check(typeof erreurHandshake.message === 'string', 'handshake avec un token invalide refusé');
  refuse.disconnect();

  const aliceSocket = connect(alice.token);
  const bobSocket = connect(bob.token);
  const intrusSocket = connect(intrus.token);
  await join(aliceSocket, cookbook.id);
  await join(bobSocket, cookbook.id);
  check(true, 'alice et bob sont entrés dans le salon cookbook:' + cookbook.id);

  intrusSocket.emit('cookbook:join', { cookbookId: cookbook.id });
  const refusEntree = await waitFor(intrusSocket, 'app:error');
  check(typeof refusEntree.code === 'string', "un non-membre n'entre pas dans le salon : " + refusEntree.code);

  section('Diffusion');
  const recuParAlice = waitForMessage(aliceSocket, 'Je ramène le dessert');
  bobSocket.emit('message:send', { cookbookId: cookbook.id, content: 'Je ramène le dessert' });
  const messageWs = await recuParAlice;
  checkEqual(messageWs.author.email, bob.email, 'alice reçoit en direct le message de bob');

  // Un client sans WebSocket poste en REST ; la diffusion a lieu quand même.
  const recuParBob = waitForMessage(bobSocket, 'Parfait, moi le plat');
  await call('POST', '/cookbooks/' + cookbook.id + '/messages', {
    token: alice.token,
    body: { content: 'Parfait, moi le plat' },
  });
  const messageRest = await recuParBob;
  checkEqual(messageRest.author.email, alice.email, 'un envoi REST est diffusé aux sockets ouverts');

  section('Historique');
  const historique = await call('GET', '/cookbooks/' + cookbook.id + '/messages', {
    token: bob.token,
  });
  checkEqual(
    historique.map((message) => message.content),
    ['Je ramène le dessert', 'Parfait, moi le plat'],
    "l'historique rend la conversation dans l'ordre",
  );

  await call('GET', '/cookbooks/' + cookbook.id + '/messages', {
    token: intrus.token,
    expect: 404,
  });
  check(true, "un non-membre ne lit pas l'historique (404)");

  section('Rétrogradation');
  await call('PATCH', '/cookbooks/' + cookbook.id + '/members/' + bob.id, {
    token: alice.token,
    body: { role: 'READER' },
  });

  const refusEcriture = waitFor(bobSocket, 'app:error');
  bobSocket.emit('message:send', { cookbookId: cookbook.id, content: 'Encore un mot' });
  const erreur = await refusEcriture;
  check(
    typeof erreur.code === 'string',
    'passé READER, bob ne peut plus écrire malgré son salon ouvert : ' + erreur.code,
  );

  await call('POST', '/cookbooks/' + cookbook.id + '/messages', {
    token: bob.token,
    body: { content: 'Par la porte de derrière' },
    expect: 403,
  });
  check(true, 'et le repli REST est refusé de la même façon (403)');

  // La messagerie s'ouvre à partir de COMMENTER : contrairement aux
  // commentaires, le lecteur n'y a pas même accès en lecture.
  await call('GET', '/cookbooks/' + cookbook.id + '/messages', { token: bob.token, expect: 403 });
  check(true, "le salon se referme entièrement : le lecteur n'en lit même plus l'historique");

  aliceSocket.disconnect();
  bobSocket.disconnect();
  intrusSocket.disconnect();
}

main('Messagerie temps réel', run);
