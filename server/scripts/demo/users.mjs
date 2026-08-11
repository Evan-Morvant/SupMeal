import { PASSWORD, call, callFull, check, checkEqual, main, register, section } from './lib.mjs';

/**
 * Paramètres du compte : profil, changement de mot de passe, préférences
 * culinaires et comptes OAuth2 liés.
 *
 * Usage : node scripts/demo/users.mjs
 */

const NOUVEAU_MOT_DE_PASSE = 'nouveaumotdepasse456';

async function run() {
  const user = await register('camille');

  section('Profil');
  const profile = await call('GET', '/users/me', { token: user.token });
  checkEqual(profile.displayName, 'camille', 'profil : nom d affichage initial');

  const renamed = await call('PATCH', '/users/me', {
    token: user.token,
    body: { displayName: 'Camille D.' },
  });
  checkEqual(renamed.displayName, 'Camille D.', 'profil : le nom d affichage se modifie');

  await call('PATCH', '/users/me', { token: user.token, body: {}, expect: 400 });
  check(true, 'profil : une modification vide est refusée en 400');

  section('Préférences culinaires');
  const initial = await call('GET', '/users/me/preferences', { token: user.token });
  checkEqual(initial.defaultServings, 2, 'préférences : créées à la volée avec leurs valeurs par défaut');
  checkEqual(initial.allergies, [], 'préférences : aucune allergie au départ');

  const wanted = {
    diets: ['végétarien'],
    allergies: ['arachides', 'gluten'],
    preferredCuisines: ['italienne', 'japonaise'],
    defaultServings: 4,
  };
  const saved = await call('PUT', '/users/me/preferences', { token: user.token, body: wanted });
  checkEqual(saved, wanted, 'préférences : enregistrées telles quelles');

  // PUT est un remplacement : ce qui n'est pas redit reprend sa valeur par défaut.
  const replaced = await call('PUT', '/users/me/preferences', {
    token: user.token,
    body: { allergies: ['fruits à coque'] },
  });
  checkEqual(replaced.allergies, ['fruits à coque'], 'préférences : PUT remplace les allergies');
  checkEqual(replaced.diets, [], 'préférences : PUT réinitialise les champs omis');
  checkEqual(replaced.defaultServings, 2, 'préférences : PUT réinitialise les portions par défaut');

  await call('PUT', '/users/me/preferences', {
    token: user.token,
    body: { defaultServings: 0 },
    expect: 400,
  });
  check(true, 'préférences : un nombre de portions nul est refusé');

  section('Comptes OAuth2 liés');
  const accounts = await call('GET', '/users/me/oauth', { token: user.token });
  checkEqual(accounts, [], 'aucun compte OAuth2 lié sur un compte local neuf');

  // Le fournisseur peut ne pas être renseigné sur l'instance visée : les deux
  // réponses sont correctes, seule leur cohérence avec la configuration compte.
  const link = await callFull('POST', '/users/me/oauth/github', {
    token: user.token,
    expect: [200, 503],
  });
  if (link.status === 503) {
    checkEqual(
      link.body.error.code,
      'PROVIDER_NOT_CONFIGURED',
      'liaison GitHub : fournisseur non configuré ici (renseignez GITHUB_CLIENT_ID pour l exercer)',
    );
  } else {
    // L'URL vise le point d'entrée OAuth de l'API, non le fournisseur : la
    // requête est authentifiée par en-tête, ce qu'une navigation de navigateur
    // ne porte pas. C'est cette route qui redirigera ensuite vers GitHub, en
    // emportant le state signé qui protège du CSRF.
    const url = link.body.authorizationUrl ?? '';
    check(
      url.includes('/api/v1/auth/oauth/github') && url.includes('state='),
      "liaison GitHub : URL du point d'entrée OAuth rendue, avec son state signé",
    );
  }

  await call('DELETE', '/users/me/oauth/github', { token: user.token, expect: 404 });
  check(true, 'délier un fournisseur non lié répond 404');

  section('Changement de mot de passe');
  await call('PUT', '/users/me/password', {
    token: user.token,
    body: { newPassword: NOUVEAU_MOT_DE_PASSE },
    expect: 400,
  });
  check(true, 'le mot de passe actuel est exigé quand il en existe un');

  await call('PUT', '/users/me/password', {
    token: user.token,
    body: { currentPassword: 'faux', newPassword: NOUVEAU_MOT_DE_PASSE },
    expect: 401,
  });
  check(true, 'un mot de passe actuel erroné est refusé en 401');

  await call('PUT', '/users/me/password', {
    token: user.token,
    body: { currentPassword: PASSWORD, newPassword: NOUVEAU_MOT_DE_PASSE },
  });
  check(true, 'mot de passe remplacé');

  await call('POST', '/auth/login', {
    body: { email: user.email, password: PASSWORD },
    expect: 401,
  });
  check(true, "l'ancien mot de passe ne fonctionne plus");

  const relogin = await call('POST', '/auth/login', {
    body: { email: user.email, password: NOUVEAU_MOT_DE_PASSE },
  });
  check(typeof relogin.accessToken === 'string', 'connexion avec le nouveau mot de passe');

  // Le changement de mot de passe révoque les sessions ouvertes ailleurs.
  await call('POST', '/auth/refresh', { body: { refreshToken: user.refreshToken }, expect: 401 });
  check(true, 'les sessions ouvertes avant le changement sont révoquées');
}

main('Paramètres utilisateur', run);
