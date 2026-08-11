import { PASSWORD, call, check, checkEqual, main, register, section } from './lib.mjs';

/**
 * Authentification locale : inscription, connexion, rotation du refresh token,
 * déconnexion, et les refus qui font la sécurité du module.
 *
 * Usage : node scripts/demo/auth.mjs
 */

async function run() {
  section('Inscription');
  const alice = await register('alice');
  check(typeof alice.token === 'string', 'inscription : un access token est délivré');
  check(typeof alice.refreshToken === 'string', 'inscription : un refresh token est délivré');

  const duplicate = await call('POST', '/auth/register', {
    body: { email: alice.email, password: PASSWORD, displayName: 'alice bis' },
    expect: 409,
  });
  checkEqual(duplicate.error.code, 'EMAIL_TAKEN', 'inscription en doublon refusée en 409');

  section('Connexion');
  const session = await call('POST', '/auth/login', {
    body: { email: alice.email, password: PASSWORD },
  });
  check(typeof session.accessToken === 'string', 'connexion avec le bon mot de passe');

  await call('POST', '/auth/login', {
    body: { email: alice.email, password: 'mauvais-mot-de-passe' },
    expect: 401,
  });
  check(true, 'connexion avec un mauvais mot de passe refusée en 401');

  await call('POST', '/auth/login', {
    body: { email: 'inconnu-' + Date.now() + '@demo.fr', password: PASSWORD },
    expect: 401,
  });
  check(true, 'compte inexistant : même 401, aucune énumération possible');

  section('Profil courant');
  const profile = await call('GET', '/auth/me', { token: session.accessToken });
  checkEqual(profile.email, alice.email, '/auth/me rend le porteur du token');
  check(profile.passwordHash === undefined, "/auth/me n'expose jamais le hash du mot de passe");

  await call('GET', '/auth/me', { expect: 401 });
  check(true, '/auth/me sans token refusé en 401');

  await call('GET', '/auth/me', { token: 'jeton.bidon.invalide', expect: 401 });
  check(true, '/auth/me avec un token forgé refusé en 401');

  section('Rotation du refresh token');
  const renewed = await call('POST', '/auth/refresh', {
    body: { refreshToken: session.refreshToken },
  });
  check(typeof renewed.accessToken === 'string', 'refresh : un nouvel access token est délivré');
  check(
    renewed.refreshToken !== session.refreshToken,
    'refresh : le refresh token est bien renouvelé',
  );

  await call('POST', '/auth/refresh', { body: { refreshToken: session.refreshToken }, expect: 401 });
  check(true, "refresh : l'ancien token est révoqué, le rejouer est refusé");

  const stillValid = await call('GET', '/auth/me', { token: renewed.accessToken });
  checkEqual(stillValid.email, alice.email, 'le token renouvelé donne bien accès au profil');

  section('Déconnexion');
  await call('POST', '/auth/logout', {
    token: renewed.accessToken,
    body: { refreshToken: renewed.refreshToken },
  });
  check(true, 'déconnexion acceptée');

  await call('POST', '/auth/refresh', { body: { refreshToken: renewed.refreshToken }, expect: 401 });
  check(true, 'après déconnexion, le refresh token ne vaut plus rien');
}

main('Authentification', run);
