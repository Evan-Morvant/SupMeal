import { call, check, checkEqual, main, register, section } from './lib.mjs';

/**
 * Découverte publique : périmètre, recherche, tri par note, et cloisonnement
 * d'avec les recettes privées.
 *
 * Usage : node scripts/demo/discover.mjs
 */

const BASE = '/discover/recipes';

async function creer(token, body, visibility = 'public') {
  const recipe = await call('POST', '/recipes', { token, body: { ...body, visibility } });
  return recipe.id;
}

/** Fait noter une recette par un compte tiers, pour alimenter la moyenne. */
async function noter(recipeId, prefixe, rating) {
  const juge = await register(prefixe);
  await call('PUT', '/recipes/' + recipeId + '/reviews', { token: juge.token, body: { rating } });
}

const titres = (page) => page.items.map((item) => item.title);

async function run() {
  const auteur = await register('auteur-public');
  const marqueur = 'Marqueur ' + Date.now();

  section('Ouverte aux visiteurs');
  await creer(auteur.token, { title: marqueur + ' publique' });
  await creer(auteur.token, { title: marqueur + ' privee' }, 'private');

  const anonyme = await call('GET', BASE, { query: { q: marqueur } });
  checkEqual(titres(anonyme), [marqueur + ' publique'], 'un visiteur obtient les recettes publiques');
  check(
    !titres(anonyme).includes(marqueur + ' privee'),
    'et jamais les privées, sans être connecté',
  );
  checkEqual(anonyme.page, 1, 'la réponse est paginée');
  check(typeof anonyme.total === 'number', 'avec son total, de quoi construire une pagination');

  section('Le fonds public, même pour un compte connecté');
  const sienne = await call('GET', BASE, { token: auteur.token, query: { q: marqueur } });
  check(
    !titres(sienne).includes(marqueur + ' privee'),
    'le créateur ne voit pas sa propre privée dans la découverte',
  );
  const parRecipes = await call('GET', '/recipes', {
    token: auteur.token,
    query: { q: marqueur },
  });
  check(
    titres(parRecipes).includes(marqueur + ' privee'),
    "mais il la retrouve bien par /recipes, qui est son périmètre",
  );

  section('Recherche et filtres');
  const cuisine = 'Cuisine ' + Date.now();
  await creer(auteur.token, { title: cuisine + ' vegetarienne', tags: ['Végétarien'] });
  await creer(auteur.token, { title: cuisine + ' carnee', tags: ['Viande'] });

  const parTag = await call('GET', BASE, { query: { q: cuisine, tags: 'Végétarien' } });
  checkEqual(titres(parTag), [cuisine + ' vegetarienne'], 'le filtre par tag opère');

  section('Tri par note');
  const notes = 'Notes ' + Date.now();
  const bonne = await creer(auteur.token, { title: notes + ' excellente' });
  const passable = await creer(auteur.token, { title: notes + ' passable' });
  await creer(auteur.token, { title: notes + ' jamais notee' });

  await noter(bonne, 'juge-genereux', 5);
  await noter(passable, 'juge-severe', 2);

  const classement = titres(await call('GET', BASE, { query: { q: notes, sort: 'rating' } }));
  checkEqual(
    classement,
    [notes + ' excellente', notes + ' passable', notes + ' jamais notee'],
    'les mieux notées remontent, les non notées ferment la marche',
  );

  section('Détail public');
  const recetteId = await creer(auteur.token, {
    title: 'Soupe a l oignon ' + Date.now(),
    steps: ['Emincer les oignons'],
    ingredients: [{ name: 'oignon', quantity: 4 }],
  });
  const detail = await call('GET', BASE + '/' + recetteId);
  checkEqual(detail.steps.length, 1, 'la recette publique se lit en entier, sans compte');
  checkEqual(detail.ingredients[0].name, 'oignon', 'ingrédients compris');

  const priveeId = await creer(auteur.token, { title: 'Cachee ' + Date.now() }, 'private');
  await call('GET', BASE + '/' + priveeId, { expect: 404 });
  check(true, 'une recette privée répond 404, non 403 : son existence reste tue');
  await call('GET', BASE + '/00000000-0000-4000-8000-000000000000', { expect: 404 });
  check(true, 'exactement comme une recette inexistante');

  await call('GET', BASE + '/' + priveeId, { token: auteur.token, expect: 404 });
  check(true, 'y compris pour son créateur, qui la consulte par /recipes');

  section('Favoris de qui est connecté');
  const lecteur = await register('lecteur-curieux');
  await call('POST', '/recipes/' + recetteId + '/favorite', { token: lecteur.token });

  const vuConnecte = await call('GET', BASE + '/' + recetteId, { token: lecteur.token });
  const vuAnonyme = await call('GET', BASE + '/' + recetteId);
  checkEqual(vuConnecte.isFavorite, true, 'un utilisateur connecté retrouve ses favoris');
  checkEqual(vuAnonyme.isFavorite, false, 'un visiteur anonyme n en a pas');

  section('Critères refusés');
  await call('GET', BASE, { query: { sort: 'prepTime' }, expect: 400 });
  check(true, 'un tri hors de la liste est refusé (400)');
}

main('Découverte publique', run);
