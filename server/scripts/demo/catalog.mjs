import { call, check, checkEqual, main, register, section } from './lib.mjs';

/**
 * Catalogue : autocomplétion des ingrédients et liste des tags. Ce sont les
 * deux référentiels partagés dans lesquels puisent les formulaires de recette
 * et les filtres de recherche.
 *
 * Usage : node scripts/demo/catalog.mjs
 */

/** Marqueur unique : la base de démonstration est partagée entre exécutions. */
const RUN = Date.now().toString(36);
const LEGUME = 'courgette ' + RUN;
const COMPOSE = 'veloute de courgette ' + RUN;

/** Noms rendus, dans l'ordre. */
function names(entries) {
  return entries.map((entry) => entry.name);
}

async function run() {
  const cuisinier = await register('cuisinier');

  section('Alimentation du catalogue');
  await call('POST', '/recipes', {
    token: cuisinier.token,
    body: {
      title: 'Gratin ' + RUN,
      // La casse est normalisée à l'écriture : le catalogue reste homogène.
      ingredients: [{ name: LEGUME.toUpperCase(), quantity: 3 }, { name: COMPOSE }],
      tags: ['Plat', 'Rapide ' + RUN],
    },
  });
  check(true, 'une recette alimente le catalogue en créant ses ingrédients');

  section('Autocomplétion des ingrédients');
  // Saisie en majuscules d'un nom stocké en minuscules : la casse ne compte pas,
  // et les deux ingrédients contenant le terme remontent.
  const normalise = await call('GET', '/ingredients', {
    token: cuisinier.token,
    query: { q: LEGUME.toUpperCase() },
  });
  checkEqual(
    names(normalise),
    [LEGUME, COMPOSE],
    'casse ignorée, et le nom qui commence par la saisie passe devant',
  );

  // « de courgette » ne figure qu'au milieu du nom composé : un préfixe seul ne
  // le retrouverait pas.
  const milieu = await call('GET', '/ingredients', {
    token: cuisinier.token,
    query: { q: 'de courgette ' + RUN },
  });
  checkEqual(
    names(milieu),
    [COMPOSE],
    'recherche par fragment : un terme au milieu du nom suffit à retrouver l ingrédient',
  );

  const joker = await call('GET', '/ingredients', {
    token: cuisinier.token,
    query: { q: '%' + RUN },
  });
  checkEqual(joker, [], 'les jokers LIKE sont neutralisés : « % » ne fait pas tout remonter');

  section('Plafond des propositions');
  const parDefaut = await call('GET', '/ingredients', { token: cuisinier.token });
  check(parDefaut.length <= 20, 'sans limite demandée, 20 propositions au maximum');

  const limite = await call('GET', '/ingredients', { token: cuisinier.token, query: { limit: 3 } });
  check(limite.length <= 3, 'la limite demandée est respectée');

  await call('GET', '/ingredients', {
    token: cuisinier.token,
    query: { limit: 500 },
    expect: 400,
  });
  check(true, 'une limite démesurée est refusée en 400');

  section('Catalogue partagé');
  const voisin = await register('voisin');
  const chezLeVoisin = await call('GET', '/ingredients', {
    token: voisin.token,
    query: { q: LEGUME },
  });
  check(
    names(chezLeVoisin).includes(LEGUME),
    "le catalogue n'a pas de propriétaire : un compte neuf en bénéficie aussitôt",
  );

  await call('GET', '/ingredients', { expect: 401 });
  check(true, "le catalogue reste fermé à l'anonyme (401)");

  section('Tags');
  const tous = await call('GET', '/tags', { token: cuisinier.token });
  check(tous.length > 0, 'la liste des tags est rendue');
  check(
    tous.every((tag) => typeof tag.id === 'string' && typeof tag.type === 'string'),
    'chaque tag porte son identifiant et son type',
  );

  const course = await call('GET', '/tags', { token: cuisinier.token, query: { type: 'course' } });
  check(
    course.every((tag) => tag.type === 'course'),
    'filtre par type : seuls les tags du type demandé remontent',
  );
  check(
    names(course).includes('Dessert'),
    'les tags de référence posés par la migration sont là (entrée, plat, dessert...)',
  );

  const custom = await call('GET', '/tags', { token: cuisinier.token, query: { type: 'custom' } });
  check(
    names(custom).includes('Rapide ' + RUN),
    'un tag libre créé avec une recette rejoint le type « custom »',
  );
  check(
    !names(custom).includes('Dessert'),
    'et « Dessert » reste un tag de référence, pas un tag libre',
  );

  await call('GET', '/tags', { token: cuisinier.token, query: { type: 'inexistant' }, expect: 400 });
  check(true, 'un type inconnu est refusé en 400');

  section('Ce qu un visiteur voit');
  // Un tag « custom » est de la saisie libre : celui qui ne vit que sur une
  // recette privée ne doit pas se retrouver dans une liste publique.
  const avantPublication = await call('GET', '/tags');
  check(
    !names(avantPublication).includes('Rapide ' + RUN),
    "le tag d'une recette privée n'apparaît pas pour un visiteur anonyme",
  );

  const VITRINE = 'Vitrine ' + RUN;
  await call('POST', '/recipes', {
    token: cuisinier.token,
    body: { title: 'Vitrine ' + RUN, tags: [VITRINE], visibility: 'public' },
  });

  const apresPublication = await call('GET', '/tags');
  check(
    names(apresPublication).includes(VITRINE),
    'publier une recette rend son tag visible de tous',
  );
  check(
    !names(apresPublication).includes('Rapide ' + RUN),
    'tandis que celui de la recette privée reste invisible',
  );
  check(
    names(await call('GET', '/tags', { token: cuisinier.token })).includes('Rapide ' + RUN),
    'un utilisateur authentifié, lui, reçoit le vocabulaire entier',
  );

  section('Vocabulaire filtrable (mine)');
  /*
   * Le vocabulaire entier sert l'autocomplétion d'un formulaire. Un filtre de
   * recherche a besoin de l'inverse : ne proposer que ce qui peut donner un
   * résultat, `/recipes` ne couvrant que ses propres recettes et celles de
   * ses cookbooks.
   */
  const TAG_VOISIN = 'Voisinage ' + RUN;
  await call('POST', '/recipes', {
    token: voisin.token,
    body: { title: 'Chez le voisin ' + RUN, tags: [TAG_VOISIN], visibility: 'public' },
  });

  const entier = names(await call('GET', '/tags', { token: cuisinier.token }));
  check(entier.includes(TAG_VOISIN), 'le tag du voisin entre au vocabulaire commun');

  const filtrable = names(
    await call('GET', '/tags', { token: cuisinier.token, query: { mine: 'true' } }),
  );
  check(filtrable.includes('Rapide ' + RUN), 'mine conserve les tags de ses propres recettes');
  check(
    !filtrable.includes(TAG_VOISIN),
    "mine écarte le tag d'une recette qu'on ne peut pas filtrer",
  );

  const anonyme = await call('GET', '/tags', { query: { mine: 'true' }, expect: 401 });
  checkEqual(
    anonyme.error.code,
    'UNAUTHORIZED',
    'mine exige une authentification : « les miens » suppose un compte',
  );
}

main('Catalogue', run);
