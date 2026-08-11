import { call, check, checkEqual, main, register, section } from './lib.mjs';

/**
 * Commentaires de recette, privés au cookbook : le lecteur suit la
 * conversation, le commentateur y participe, l'auteur seul se corrige, et le
 * créateur du cookbook modère.
 *
 * Usage : node scripts/demo/comments.mjs
 */

async function invite(ownerToken, cookbookId, guest, role) {
  const invitation = await call('POST', '/cookbooks/' + cookbookId + '/invitations', {
    token: ownerToken,
    body: { email: guest.email, role },
  });
  await call('POST', '/invitations/' + invitation.token + '/accept', { token: guest.token });
}

async function run() {
  const owner = await register('hote');
  const commenter = await register('commentateur');
  const reader = await register('lecteur');
  const intrus = await register('intrus');

  const cookbook = await call('POST', '/cookbooks', {
    token: owner.token,
    body: { name: 'Essais du dimanche' },
  });
  await invite(owner.token, cookbook.id, commenter, 'COMMENTER');
  await invite(owner.token, cookbook.id, reader, 'READER');

  const recipe = await call('POST', '/cookbooks/' + cookbook.id + '/recipes', {
    token: owner.token,
    body: { title: 'Pain au levain', steps: ['Pétrir', 'Cuire'] },
  });
  const fil = '/cookbooks/' + cookbook.id + '/recipes/' + recipe.id + '/comments';

  section('Écriture');
  const comment = await call('POST', fil, {
    token: commenter.token,
    body: { content: 'Trop de sel à mon goût' },
  });
  checkEqual(comment.content, 'Trop de sel à mon goût', 'le commentateur écrit');
  checkEqual(comment.author.email, commenter.email, "l'auteur est renseigné");
  checkEqual(comment.recipeId, recipe.id, 'le commentaire porte sa recette');
  checkEqual(comment.cookbookId, cookbook.id, 'et son cookbook');

  await call('POST', fil, {
    token: owner.token,
    body: { content: 'Noté, je réduirai' },
  });
  check(true, 'le créateur du cookbook commente aussi');

  await call('POST', fil, {
    token: reader.token,
    body: { content: 'Je voudrais commenter' },
    expect: 403,
  });
  check(true, 'le lecteur ne commente pas (403) : sinon son rôle se confondrait avec COMMENTER');

  await call('POST', fil, { token: intrus.token, body: { content: 'Bonjour' }, expect: 404 });
  check(true, 'un non-membre ne voit même pas le fil (404)');

  await call('POST', fil, { token: commenter.token, body: { content: '' }, expect: 400 });
  check(true, 'un commentaire vide est refusé en 400');

  section('Lecture');
  const fils = await call('GET', fil, { token: reader.token });
  checkEqual(fils.length, 2, 'le lecteur suit la conversation (deux commentaires)');
  checkEqual(
    fils.map((entry) => entry.content),
    ['Trop de sel à mon goût', 'Noté, je réduirai'],
    'les commentaires sont rendus dans leur ordre de rédaction',
  );

  await call('GET', fil, { token: intrus.token, expect: 404 });
  check(true, 'un non-membre ne lit pas le fil (404)');

  section('Cloisonnement entre cookbooks');
  // La même recette rangée dans un second cookbook : les fils restent séparés.
  const autreCookbook = await call('POST', '/cookbooks', {
    token: owner.token,
    body: { name: 'Autre groupe' },
  });
  await call('PUT', '/cookbooks/' + autreCookbook.id + '/recipes/' + recipe.id, {
    token: owner.token,
  });
  const autreFil = await call(
    'GET',
    '/cookbooks/' + autreCookbook.id + '/recipes/' + recipe.id + '/comments',
    { token: owner.token },
  );
  checkEqual(
    autreFil.length,
    0,
    'même recette, autre cookbook : le fil est vide, aucune fuite entre groupes',
  );

  section('Modification');
  const corrige = await call('PATCH', '/comments/' + comment.id, {
    token: commenter.token,
    body: { content: 'Un peu trop de sel, en fait' },
  });
  checkEqual(corrige.content, 'Un peu trop de sel, en fait', "l'auteur corrige son commentaire");

  await call('PATCH', '/comments/' + comment.id, {
    token: owner.token,
    body: { content: 'Réécrit par le patron' },
    expect: 403,
  });
  check(true, 'même le créateur du cookbook ne réécrit pas les mots des autres (403)');

  section('Suppression et modération');
  const aSupprimer = await call('POST', fil, {
    token: commenter.token,
    body: { content: 'Message à retirer' },
  });
  await call('DELETE', '/comments/' + aSupprimer.id, { token: reader.token, expect: 403 });
  check(true, 'un tiers ne supprime pas un commentaire (403)');

  await call('DELETE', '/comments/' + aSupprimer.id, { token: commenter.token });
  check(true, "l'auteur supprime son commentaire");

  const aModerer = await call('POST', fil, {
    token: commenter.token,
    body: { content: 'Commentaire déplacé' },
  });
  await call('DELETE', '/comments/' + aModerer.id, { token: owner.token });
  check(true, 'le créateur du cookbook modère : il peut supprimer le commentaire d un autre');

  const final = await call('GET', fil, { token: reader.token });
  checkEqual(final.length, 2, 'le fil est revenu à ses deux commentaires');
}

main('Commentaires', run);
