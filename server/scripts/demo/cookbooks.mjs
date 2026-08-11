import { call, check, checkEqual, main, register, section } from './lib.mjs';

/**
 * Cookbooks partagés : création, invitations, hiérarchie des rôles et
 * permissions par action. Chaque rôle est exercé dans ce qu'il peut faire et
 * dans ce qu'il ne peut pas.
 *
 * Usage : node scripts/demo/cookbooks.mjs
 */

/** Invite un utilisateur et fait accepter l'invitation dans la foulée. */
async function invite(ownerToken, cookbookId, guest, role) {
  const invitation = await call('POST', '/cookbooks/' + cookbookId + '/invitations', {
    token: ownerToken,
    body: { email: guest.email, role },
  });
  await call('POST', '/invitations/' + invitation.token + '/accept', { token: guest.token });
  return invitation;
}

async function run() {
  const owner = await register('proprietaire');
  const editor = await register('editeur');
  const commenter = await register('commentateur');
  const reader = await register('lecteur');
  const intrus = await register('intrus');

  section('Création');
  const cookbook = await call('POST', '/cookbooks', {
    token: owner.token,
    body: { name: 'Cuisine de famille', description: 'Les classiques' },
  });
  checkEqual(cookbook.myRole, 'OWNER', 'le créateur est OWNER de son cookbook');
  checkEqual(cookbook.memberCount, 1, 'un cookbook neuf compte son créateur comme seul membre');
  checkEqual(cookbook.recipeCount, 0, 'un cookbook neuf est vide');

  await call('GET', '/cookbooks/' + cookbook.id, { token: intrus.token, expect: 404 });
  check(true, "un non-membre reçoit 404 : l'existence du cookbook ne lui est pas confirmée");

  section('Invitations');
  await invite(owner.token, cookbook.id, editor, 'EDITOR');
  await invite(owner.token, cookbook.id, commenter, 'COMMENTER');
  await invite(owner.token, cookbook.id, reader, 'READER');

  const members = await call('GET', '/cookbooks/' + cookbook.id + '/members', {
    token: owner.token,
  });
  checkEqual(members.length, 4, 'quatre membres après les trois invitations');
  checkEqual(
    members.map((member) => member.role).sort(),
    ['COMMENTER', 'EDITOR', 'OWNER', 'READER'],
    'chaque membre porte le rôle qui lui a été donné',
  );

  const declined = await call('POST', '/cookbooks/' + cookbook.id + '/invitations', {
    token: owner.token,
    body: { email: intrus.email, role: 'READER' },
  });
  await call('POST', '/invitations/' + declined.token + '/decline', { token: intrus.token });
  await call('GET', '/cookbooks/' + cookbook.id, { token: intrus.token, expect: 404 });
  check(true, 'invitation refusée : le cookbook reste inaccessible');

  await call('POST', '/cookbooks/' + cookbook.id + '/invitations', {
    token: reader.token,
    body: { email: 'quelquun@demo.fr', role: 'READER' },
    expect: 403,
  });
  check(true, 'inviter est réservé au créateur (403 pour un lecteur)');

  section('Recettes du cookbook');
  const recette = await call('POST', '/cookbooks/' + cookbook.id + '/recipes', {
    token: editor.token,
    body: { title: 'Blanquette', steps: ['Mijoter'], tags: ['Plat'] },
  });
  check(typeof recette.id === 'string', "l'éditeur crée une recette directement dans le cookbook");

  await call('POST', '/cookbooks/' + cookbook.id + '/recipes', {
    token: commenter.token,
    body: { title: 'Interdite' },
    expect: 403,
  });
  check(true, 'le commentateur ne peut pas ajouter de recette (403)');

  const vueLecteur = await call('GET', '/cookbooks/' + cookbook.id + '/recipes', {
    token: reader.token,
  });
  checkEqual(vueLecteur.total, 1, 'le lecteur voit la recette du cookbook');

  // Une recette personnelle devient partagée par simple liaison.
  const perso = await call('POST', '/recipes', {
    token: owner.token,
    body: { title: 'Gratin dauphinois' },
  });
  await call('PUT', '/cookbooks/' + cookbook.id + '/recipes/' + perso.id, { token: owner.token });
  const deux = await call('GET', '/cookbooks/' + cookbook.id + '/recipes', { token: reader.token });
  checkEqual(deux.total, 2, 'la recette liée apparaît pour tous les membres');

  const chezLeLecteur = await call('GET', '/recipes/' + perso.id, { token: reader.token });
  checkEqual(chezLeLecteur.id, perso.id, "l'appartenance au cookbook ouvre l'accès à la recette");

  // Délier ne supprime pas la recette : elle redevient simplement personnelle.
  await call('DELETE', '/cookbooks/' + cookbook.id + '/recipes/' + perso.id, {
    token: editor.token,
  });
  const apresDeliaison = await call('GET', '/cookbooks/' + cookbook.id + '/recipes', {
    token: reader.token,
  });
  checkEqual(apresDeliaison.total, 1, 'la recette a quitté le cookbook');
  const encoreLa = await call('GET', '/recipes/' + perso.id, { token: owner.token });
  checkEqual(encoreLa.id, perso.id, 'délier ne supprime pas la recette pour son créateur');
  await call('GET', '/recipes/' + perso.id, { token: reader.token, expect: 403 });
  check(true, "le lecteur perd l'accès à la recette déliée");

  section('Recherche interne au cookbook');
  const trouve = await call('GET', '/cookbooks/' + cookbook.id + '/recipes', {
    token: reader.token,
    query: { q: 'blanquette' },
  });
  checkEqual(trouve.total, 1, 'la barre de recherche du cookbook trouve la recette');
  const introuvable = await call('GET', '/cookbooks/' + cookbook.id + '/recipes', {
    token: reader.token,
    query: { q: 'tiramisu' },
  });
  checkEqual(introuvable.total, 0, 'et ne trouve rien sur un terme absent');

  section('Gestion des membres');
  await call('PATCH', '/cookbooks/' + cookbook.id + '/members/' + commenter.id, {
    token: owner.token,
    body: { role: 'EDITOR' },
  });
  const promu = await call('POST', '/cookbooks/' + cookbook.id + '/recipes', {
    token: commenter.token,
    body: { title: 'Enfin autorisée' },
  });
  check(typeof promu.id === 'string', 'promu éditeur, le commentateur peut désormais ajouter');

  await call('PATCH', '/cookbooks/' + cookbook.id + '/members/' + editor.id, {
    token: reader.token,
    body: { role: 'OWNER' },
    expect: 403,
  });
  check(true, 'un lecteur ne peut pas changer les rôles (403)');

  await call('DELETE', '/cookbooks/' + cookbook.id + '/members/' + reader.id, {
    token: owner.token,
  });
  await call('GET', '/cookbooks/' + cookbook.id, { token: reader.token, expect: 404 });
  check(true, 'membre retiré : le cookbook lui redevient invisible');

  section('Modification et suppression');
  const renamed = await call('PATCH', '/cookbooks/' + cookbook.id, {
    token: owner.token,
    body: { name: 'Cuisine de famille 2026' },
  });
  checkEqual(renamed.name, 'Cuisine de famille 2026', 'le créateur renomme son cookbook');

  await call('PATCH', '/cookbooks/' + cookbook.id, {
    token: editor.token,
    body: { name: 'Détourné' },
    expect: 403,
  });
  check(true, "l'éditeur ne peut pas renommer le cookbook (403)");

  await call('DELETE', '/cookbooks/' + cookbook.id, { token: editor.token, expect: 403 });
  check(true, 'la suppression est réservée au créateur (403)');

  await call('DELETE', '/cookbooks/' + cookbook.id, { token: owner.token });
  await call('GET', '/cookbooks/' + cookbook.id, { token: owner.token, expect: 404 });
  check(true, 'cookbook supprimé');

  const survivante = await call('GET', '/recipes/' + recette.id, { token: editor.token });
  checkEqual(
    survivante.id,
    recette.id,
    'supprimer un cookbook ne supprime pas les recettes de ses membres',
  );
}

main('Cookbooks et permissions', run);
