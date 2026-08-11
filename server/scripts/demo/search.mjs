import { call, check, checkEqual, main, register, section } from './lib.mjs';

/**
 * Recherche et filtrage : plein texte français, tags, ingrédients, temps,
 * favoris, tri et pagination — y compris leur combinaison, qui doit rester un
 * ET et non pas élargir les résultats.
 *
 * Usage : node scripts/demo/search.mjs
 */

const CATALOGUE = [
  {
    title: 'Tarte aux pommes caramélisées',
    description: 'Un dessert de saison',
    prepTimeMin: 20,
    cookTimeMin: 40,
    tags: ['Dessert'],
    ingredients: [{ name: 'pommes', quantity: 4 }, { name: 'farine', quantity: 200, unit: 'g' }],
    steps: ['Éplucher', 'Cuire'],
  },
  {
    title: 'Compote de pommes express',
    description: 'Prête en un quart d heure',
    prepTimeMin: 5,
    cookTimeMin: 10,
    tags: ['Dessert'],
    ingredients: [{ name: 'pommes', quantity: 6 }, { name: 'sucre', quantity: 50, unit: 'g' }],
    steps: ['Éplucher', 'Mijoter'],
  },
  {
    title: 'Gratin de courgettes',
    description: 'Le plat du soir',
    prepTimeMin: 15,
    cookTimeMin: 35,
    tags: ['Plat'],
    ingredients: [{ name: 'courgettes', quantity: 3 }, { name: 'farine', quantity: 30, unit: 'g' }],
    steps: ['Trancher', 'Enfourner'],
  },
];

/** Titres d'une page de résultats, triés pour comparer sans dépendre de l'ordre. */
function titles(page) {
  return page.items.map((recipe) => recipe.title).sort();
}

async function run() {
  const cuisinier = await register('cuisinier');
  const created = [];
  for (const recipe of CATALOGUE) {
    created.push(await call('POST', '/recipes', { token: cuisinier.token, body: recipe }));
  }

  section('Recherche plein texte');
  const pommes = await call('GET', '/recipes', { token: cuisinier.token, query: { q: 'pommes' } });
  checkEqual(
    titles(pommes),
    ['Compote de pommes express', 'Tarte aux pommes caramélisées'],
    'plein texte « pommes » : les deux recettes concernées',
  );

  // Le dictionnaire français rapproche la forme fléchie de son radical.
  const caramel = await call('GET', '/recipes', {
    token: cuisinier.token,
    query: { q: 'caraméliser' },
  });
  checkEqual(
    titles(caramel),
    ['Tarte aux pommes caramélisées'],
    'plein texte : « caraméliser » retrouve « caramélisées »',
  );

  const description = await call('GET', '/recipes', {
    token: cuisinier.token,
    query: { q: 'plat du soir' },
  });
  checkEqual(
    titles(description),
    ['Gratin de courgettes'],
    'plein texte : la description est indexée, pas seulement le titre',
  );

  const vide = await call('GET', '/recipes', { token: cuisinier.token, query: { q: 'brouette' } });
  checkEqual(vide.total, 0, 'plein texte : un terme absent ne rend rien');

  section('Filtres');
  const desserts = await call('GET', '/recipes', {
    token: cuisinier.token,
    query: { tags: 'Dessert' },
  });
  checkEqual(desserts.total, 2, 'filtre par tag');

  const parIngredient = await call('GET', '/recipes', {
    token: cuisinier.token,
    query: { ingredients: 'courgettes' },
  });
  checkEqual(titles(parIngredient), ['Gratin de courgettes'], 'filtre par ingrédient');

  const deuxIngredients = await call('GET', '/recipes', {
    token: cuisinier.token,
    query: { ingredients: 'pommes,farine' },
  });
  checkEqual(
    titles(deuxIngredients),
    ['Tarte aux pommes caramélisées'],
    'deux ingrédients : ET et non OU, seule la recette qui a les deux ressort',
  );

  const rapides = await call('GET', '/recipes', {
    token: cuisinier.token,
    query: { maxPrep: 15 },
  });
  checkEqual(
    titles(rapides),
    ['Compote de pommes express', 'Gratin de courgettes'],
    'filtre sur le temps de préparation',
  );

  const cuissonCourte = await call('GET', '/recipes', {
    token: cuisinier.token,
    query: { maxCook: 10 },
  });
  checkEqual(
    titles(cuissonCourte),
    ['Compote de pommes express'],
    'filtre sur le temps de cuisson',
  );

  section('Combinaisons');
  const dessertRapide = await call('GET', '/recipes', {
    token: cuisinier.token,
    query: { tags: 'Dessert', maxPrep: 10 },
  });
  checkEqual(
    titles(dessertRapide),
    ['Compote de pommes express'],
    'tag + temps : les critères se cumulent',
  );

  const texteEtTag = await call('GET', '/recipes', {
    token: cuisinier.token,
    query: { q: 'pommes', tags: 'Plat' },
  });
  checkEqual(texteEtTag.total, 0, 'plein texte + tag contradictoires : aucun résultat');

  section('Favoris');
  await call('POST', '/recipes/' + created[2].id + '/favorite', { token: cuisinier.token });
  const favoris = await call('GET', '/recipes', {
    token: cuisinier.token,
    query: { favorite: 'true' },
  });
  checkEqual(titles(favoris), ['Gratin de courgettes'], 'filtre favoris');

  const nonFavoris = await call('GET', '/recipes', {
    token: cuisinier.token,
    query: { favorite: 'false' },
  });
  checkEqual(nonFavoris.total, 3, 'favorite=false ne filtre pas (la chaîne est bien lue)');

  section('Tri et pagination');
  const parTemps = await call('GET', '/recipes', {
    token: cuisinier.token,
    query: { sort: 'prepTime' },
  });
  checkEqual(
    parTemps.items.map((recipe) => recipe.prepTimeMin),
    [5, 15, 20],
    'tri par temps de préparation croissant',
  );

  const page1 = await call('GET', '/recipes', {
    token: cuisinier.token,
    query: { page: 1, pageSize: 2 },
  });
  checkEqual(page1.items.length, 2, 'pagination : la première page tient dans la taille demandée');
  checkEqual(page1.total, 3, 'pagination : le total compte toutes les recettes');

  const page2 = await call('GET', '/recipes', {
    token: cuisinier.token,
    query: { page: 2, pageSize: 2 },
  });
  checkEqual(page2.items.length, 1, 'pagination : la seconde page porte le reste');
  check(
    page2.items[0].id !== page1.items[0].id && page2.items[0].id !== page1.items[1].id,
    'pagination : aucune recette ne figure sur les deux pages',
  );

  await call('GET', '/recipes', { token: cuisinier.token, query: { pageSize: 500 }, expect: 400 });
  check(true, 'pagination : une taille de page démesurée est refusée en 400');

  section('Cloisonnement');
  const voisin = await register('voisin');
  const chezLeVoisin = await call('GET', '/recipes', {
    token: voisin.token,
    query: { q: 'pommes' },
  });
  checkEqual(chezLeVoisin.total, 0, "la recherche d'un tiers ne voit rien de ce catalogue");
}

main('Recherche et filtrage', run);
