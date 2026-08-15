import { call, callFull, check, checkEqual, isoDate, main, register, section } from './lib.mjs';

/**
 * Export des données personnelles : contenu du fichier, absence de secrets, et
 * cloisonnement d'avec les données des autres membres.
 *
 * Usage : node scripts/demo/personal-data.mjs
 */

function telecharger(token) {
  return callFull('GET', '/users/me/data', { token });
}

async function recettePublique(token, title) {
  const recipe = await call('POST', '/recipes', {
    token,
    body: { title, visibility: 'public' },
  });
  return recipe.id;
}

/** Fait entrer un compte dans un cookbook avec le rôle demandé. */
async function faireEntrer(hote, invite, cookbookId, role) {
  const invitation = await call('POST', '/cookbooks/' + cookbookId + '/invitations', {
    token: hote.token,
    body: { email: invite.email, role },
  });
  await call('POST', '/invitations/' + invitation.token + '/accept', { token: invite.token });
}

async function run() {
  section('Le fichier');
  const utilisateur = await register('portabilite');
  const vide = await telecharger(utilisateur.token);
  check(
    /attachment; filename="supmeal-donnees-\d{4}-\d{2}-\d{2}\.json"/.test(
      vide.headers.get('content-disposition') ?? '',
    ),
    'fichier daté, proposé en pièce jointe',
  );
  check(vide.body.warning.includes('en clair'), "l'avertissement sur les données en clair est là");
  checkEqual(vide.body.profile.email, utilisateur.email, 'le profil porte son adresse');
  checkEqual(vide.body.recipes.items, [], 'un compte neuf rend des sections vides, pas une erreur');

  section('Aucun secret ne sort');
  const brut = JSON.stringify(vide.body);
  check(!brut.includes('passwordHash'), 'le hash du mot de passe est absent');
  check(!brut.includes('$2a$'), "aucune empreinte bcrypt n'apparaît");
  check(!brut.includes('motdepasse123'), "le mot de passe en clair non plus, évidemment");
  check(!brut.includes('token'), "aucun jeton n'est joint");
  checkEqual(vide.body.profile.hasPassword, true, "seule l'existence d'un mot de passe est dite");

  section('Ce que le compte a produit');
  const auteur = await register('auteur-recettes');
  const recetteId = await recettePublique(auteur.token, 'Ratatouille de saison');

  await call('POST', '/recipes/' + recetteId + '/favorite', { token: utilisateur.token });
  await call('PUT', '/recipes/' + recetteId + '/reviews', {
    token: utilisateur.token,
    body: { rating: 5, body: 'Parfaite en été' },
  });
  await call('POST', '/meal-plan', {
    token: utilisateur.token,
    body: { recipeId: recetteId, date: isoDate(2), mealType: 'dîner' },
  });
  await call('PUT', '/users/me/preferences', {
    token: utilisateur.token,
    body: { diets: ['Végétarien'], allergies: ['arachide'], defaultServings: 2 },
  });

  const rempli = await telecharger(utilisateur.token);
  checkEqual(rempli.body.preferences.allergies, ['arachide'], 'les préférences culinaires y sont');
  checkEqual(rempli.body.favorites[0].recipe, 'Ratatouille de saison', 'les favoris aussi');
  checkEqual(rempli.body.reviews[0].rating, 5, 'les avis déposés également');
  checkEqual(rempli.body.mealPlan[0].recipe, 'Ratatouille de saison', 'et le planning');

  section('Les recettes en référence, pas en entier');
  const cuisinier = await register('cuisinier');
  await call('POST', '/recipes', {
    token: cuisinier.token,
    body: { title: 'Blanquette', steps: ['Faire revenir la viande'] },
  });

  const sesDonnees = await telecharger(cuisinier.token);
  checkEqual(sesDonnees.body.recipes.items[0].title, 'Blanquette', 'la recette est listée');
  check(
    sesDonnees.body.recipes.items[0].steps === undefined,
    'sans ses étapes : le contenu relève de /export',
  );
  check(sesDonnees.body.recipes.note.includes('/api/v1/export'), 'et le fichier le dit');

  const contenu = await call('GET', '/export', { token: cuisinier.token });
  checkEqual(
    contenu.recipes[0].steps,
    ['Faire revenir la viande'],
    "l'export de contenu, lui, porte bien les étapes",
  );
  check(contenu.profile === undefined, "et réciproquement, il ignore la personne");

  section('Rien qui appartienne aux autres');
  const hote = await register('hote');
  const membre = await register('membre');
  const cookbook = await call('POST', '/cookbooks', {
    token: hote.token,
    body: { name: 'Cuisine partagée' },
  });
  await faireEntrer(hote, membre, cookbook.id, 'COMMENTER');

  const plat = await recettePublique(hote.token, 'Chili');
  await call('PUT', '/cookbooks/' + cookbook.id + '/recipes/' + plat, { token: hote.token });

  const fil = '/cookbooks/' + cookbook.id + '/recipes/' + plat + '/comments';
  await call('POST', fil, { token: hote.token, body: { content: 'Propos du createur' } });
  await call('POST', fil, { token: membre.token, body: { content: 'Propos du membre' } });

  const salon = '/cookbooks/' + cookbook.id + '/messages';
  await call('POST', salon, { token: hote.token, body: { content: 'Message du createur' } });
  await call('POST', salon, { token: membre.token, body: { content: 'Message du membre' } });

  const duMembre = await telecharger(membre.token);
  checkEqual(duMembre.body.comments.length, 1, 'un seul commentaire : le sien');
  checkEqual(duMembre.body.comments[0].content, 'Propos du membre', "et c'est bien le sien");
  checkEqual(duMembre.body.messages.length, 1, 'un seul message : le sien');

  const texte = JSON.stringify(duMembre.body);
  check(!texte.includes('Propos du createur'), "les propos des autres membres restent chez eux");
  check(!texte.includes('Message du createur'), 'leurs messages aussi');
  check(!texte.includes(hote.email), "et leur adresse n'apparaît nulle part");

  checkEqual(
    duMembre.body.cookbookMemberships[0],
    {
      cookbook: 'Cuisine partagée',
      role: 'COMMENTER',
      joinedAt: duMembre.body.cookbookMemberships[0].joinedAt,
    },
    'son adhésion est décrite, sans la liste des membres du cookbook',
  );

  section('Fermé à l anonyme');
  await call('GET', '/users/me/data', { expect: 401 });
  check(true, "ses données personnelles ne s'obtiennent pas sans être connecté (401)");
}

main('Données personnelles', run);
