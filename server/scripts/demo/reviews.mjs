import { call, check, checkEqual, main, register, section } from './lib.mjs';

/**
 * Avis publics : dépôt, remplacement, moyenne, lecture anonyme, suppression.
 *
 * Usage : node scripts/demo/reviews.mjs
 */

async function publicRecipe(token, title) {
  const recipe = await call('POST', '/recipes', {
    token,
    body: { title, visibility: 'public' },
  });
  return recipe.id;
}

function reviewsUrl(recipeId) {
  return '/recipes/' + recipeId + '/reviews';
}

function review(token, recipeId, rating, body, expect) {
  return call('PUT', reviewsUrl(recipeId), { token, body: { rating, body }, expect });
}

async function run() {
  section('Dépôt d un avis');
  const auteur = await register('cuisinier');
  const lecteur = await register('lecteur');
  const recetteId = await publicRecipe(auteur.token, 'Tarte aux pommes');

  const avis = await review(lecteur.token, recetteId, 4, 'Bien dosée en sucre');
  checkEqual(avis.rating, 4, 'la note est enregistrée');
  checkEqual(avis.author.email, lecteur.email, "l'avis porte le nom de son auteur");
  check(avis.author.passwordHash === undefined, "le hash du mot de passe ne sort jamais");

  section('Un avis par personne');
  const revu = await review(lecteur.token, recetteId, 5, 'Encore meilleure réchauffée');
  checkEqual(revu.id, avis.id, 'changer d avis remplace le sien, sans en créer un second');

  const apresRevision = await call('GET', reviewsUrl(recetteId));
  checkEqual(apresRevision.reviewCount, 1, 'le compte reste à un');
  checkEqual(apresRevision.avgRating, 5, 'la moyenne suit la révision');

  section('Moyenne sur plusieurs avis');
  const second = await register('gourmand');
  await review(second.token, recetteId, 4);

  const notee = await call('GET', reviewsUrl(recetteId));
  checkEqual(notee.avgRating, 4.5, 'la moyenne des notes 5 et 4 vaut 4.5');
  checkEqual(notee.reviewCount, 2, 'les deux avis sont comptés');
  checkEqual(
    notee.items.map((entry) => entry.author.email),
    [second.email, lecteur.email],
    'le plus récent se lit en premier',
  );

  section('La recette porte sa note');
  const fiche = await call('GET', '/recipes/' + recetteId, { token: auteur.token });
  checkEqual(fiche.avgRating, 4.5, 'la fiche expose la même moyenne que la liste des avis');
  checkEqual(fiche.reviewCount, 2, 'ainsi que le nombre d avis');

  section('Lecture ouverte aux visiteurs');
  const anonyme = await call('GET', reviewsUrl(recetteId));
  checkEqual(anonyme.reviewCount, 2, 'les avis d une recette publique se lisent sans compte');

  const privee = await call('POST', '/recipes', {
    token: auteur.token,
    body: { title: 'Recette de famille' },
  });
  await call('GET', reviewsUrl(privee.id), { expect: 403 });
  check(true, "mais une recette privée reste fermée à l'anonyme (403)");

  await call('GET', reviewsUrl(privee.id), { token: lecteur.token, expect: 403 });
  check(true, "et fermée aussi à un utilisateur connecté sans accès (403)");

  section('Règles d écriture');
  await review(auteur.token, recetteId, 5, undefined, 403);
  check(true, 'le créateur ne note pas sa propre recette (403)');

  await review(lecteur.token, recetteId, 6, undefined, 400);
  check(true, "une note hors de l'échelle 1-5 est refusée (400)");

  await call('PUT', reviewsUrl(recetteId), { body: { rating: 3 }, expect: 401 });
  check(true, "déposer un avis demande d'être connecté (401)");

  section('Suppression');
  await call('DELETE', reviewsUrl(recetteId), { token: second.token, expect: 204 });
  const apresRetrait = await call('GET', reviewsUrl(recetteId));
  checkEqual(apresRetrait.reviewCount, 1, "seul l'avis de son auteur disparaît");
  checkEqual(apresRetrait.avgRating, 5, 'la moyenne est recalculée sur ce qui reste');

  await call('DELETE', reviewsUrl(recetteId), { token: lecteur.token, expect: 204 });
  const sansAvis = await call('GET', reviewsUrl(recetteId));
  checkEqual(sansAvis.avgRating, null, 'sans avis, la recette redevient non notée');
  checkEqual(sansAvis.reviewCount, 0, 'et le compte retombe à zéro');

  await call('DELETE', reviewsUrl(recetteId), { token: lecteur.token, expect: 404 });
  check(true, "supprimer un avis qu'on n'a pas donné -> 404");
}

main('Avis et notation', run);
