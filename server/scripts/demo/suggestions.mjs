import { call, check, checkEqual, isoDate, main, register, section } from './lib.mjs';

/**
 * Suggestions de recettes : exclusions de sécurité, classement par profil, et
 * motifs accompagnant chaque proposition.
 *
 * Usage : node scripts/demo/suggestions.mjs
 */

/** Titres suggérés, dans l'ordre du classement. */
function titles(suggestions) {
  return suggestions.map((entry) => entry.recipe.title);
}

async function createRecipe(token, body) {
  const recipe = await call('POST', '/recipes', { token, body });
  return recipe.id;
}

function suggest(token, query = {}) {
  return call('GET', '/recipes/suggestions', { token, query });
}

async function run() {
  section('Route distincte de /recipes/:id');
  const neuf = await register('nouveau');
  const vide = await suggest(neuf.token);
  checkEqual(vide, [], 'un compte neuf reçoit une liste vide, sans confusion avec un identifiant');

  section('Classement par profil');
  const gourmet = await register('gourmet');
  await call('PUT', '/users/me/preferences', {
    token: gourmet.token,
    body: {
      diets: ['Végétarien'],
      preferredCuisines: ['Italienne'],
      allergies: [],
      defaultServings: 2,
    },
  });

  await createRecipe(gourmet.token, { title: 'Steak frites' });
  await createRecipe(gourmet.token, { title: 'Pizza margherita', tags: ['Italienne'] });
  await createRecipe(gourmet.token, {
    title: 'Risotto aux legumes',
    tags: ['Végétarien', 'Italienne'],
  });

  const classees = await suggest(gourmet.token);
  checkEqual(
    titles(classees),
    ['Risotto aux legumes', 'Pizza margherita', 'Steak frites'],
    'le régime pèse plus que la cuisine préférée, qui pèse plus que rien',
  );
  check(classees[0].score > classees[1].score, 'les scores sont strictement décroissants');
  checkEqual(classees[2].score, 0, 'une recette sans signal reste proposée, en dernier');

  section('Motifs');
  checkEqual(
    classees[0].reasons.sort(),
    ['correspond à votre régime : Végétarien', 'cuisine que vous appréciez : Italienne'],
    'chaque suggestion dit pourquoi elle remonte',
  );

  section('Allergies');
  const allergique = await register('allergique');
  await call('PUT', '/users/me/preferences', {
    token: allergique.token,
    body: { allergies: ['arachide'] },
  });
  await createRecipe(allergique.token, {
    title: 'Sauce satay',
    ingredients: [{ name: 'beurre d arachide', quantity: 100, unit: 'g' }],
  });
  await createRecipe(allergique.token, {
    title: 'Salade verte',
    ingredients: [{ name: 'laitue', quantity: 1 }],
  });

  const sansAllergene = await suggest(allergique.token);
  checkEqual(
    titles(sansAllergene),
    ['Salade verte'],
    'la correspondance est large : « arachide » écarte « beurre d arachide »',
  );

  const joker = await register('joker');
  await call('PUT', '/users/me/preferences', { token: joker.token, body: { allergies: ['%'] } });
  await createRecipe(joker.token, {
    title: 'Toujours proposable',
    ingredients: [{ name: 'farine', quantity: 100, unit: 'g' }],
  });
  const avecJoker = await suggest(joker.token);
  checkEqual(
    titles(avecJoker),
    ['Toujours proposable'],
    'les jokers LIKE d une allergie sont neutralisés',
  );

  section('Ce qui est déjà connu est écarté');
  const habitue = await register('habitue');
  const favori = await createRecipe(habitue.token, { title: 'Deja en favori' });
  const prevue = await createRecipe(habitue.token, { title: 'Prevue demain' });
  const passee = await createRecipe(habitue.token, { title: 'Cuisinee le mois dernier' });
  await createRecipe(habitue.token, { title: 'Jamais vue' });

  await call('POST', '/recipes/' + favori + '/favorite', { token: habitue.token });
  await call('POST', '/meal-plan', {
    token: habitue.token,
    body: { recipeId: prevue, date: isoDate(3), mealType: 'dîner' },
  });
  await call('POST', '/meal-plan', {
    token: habitue.token,
    body: { recipeId: passee, date: isoDate(-30), mealType: 'dîner' },
  });

  const decouverte = await suggest(habitue.token);
  const proposees = titles(decouverte);
  check(!proposees.includes('Deja en favori'), 'un favori ne se suggère pas : il est déjà distingué');
  check(!proposees.includes('Prevue demain'), 'ce qui est déjà au menu ne se suggère pas');
  check(
    proposees.includes('Cuisinee le mois dernier'),
    'mais le passé reste éligible : une recette peut revenir',
  );

  section('Affinité avec ce qu on cuisine');
  const habitude = await register('habitude');
  const tiramisu = await createRecipe(habitude.token, { title: 'Tiramisu', tags: ['Dessert'] });
  await call('POST', '/recipes/' + tiramisu + '/favorite', { token: habitude.token });
  await createRecipe(habitude.token, { title: 'Poulet roti', tags: ['Plat'] });
  await createRecipe(habitude.token, { title: 'Panna cotta', tags: ['Dessert'] });

  const affines = await suggest(habitude.token);
  checkEqual(
    titles(affines)[0],
    'Panna cotta',
    'les tags des favoris rapprochent les recettes voisines',
  );
  checkEqual(
    affines[0].reasons,
    ['proche de ce que vous cuisinez : Dessert'],
    'et le motif le dit explicitement',
  );

  section('Périmètre et limite');
  const etranger = await register('etranger');
  const rien = await suggest(etranger.token);
  checkEqual(rien, [], "on ne suggère jamais une recette qu'on n'a pas le droit de lire");

  const limitees = await suggest(gourmet.token, { limit: 2 });
  checkEqual(limitees.length, 2, 'la limite demandée est respectée');

  await call('GET', '/recipes/suggestions', {
    token: gourmet.token,
    query: { limit: 100 },
    expect: 400,
  });
  check(true, 'une limite démesurée est refusée en 400');

  await call('GET', '/recipes/suggestions', { expect: 401 });
  check(true, "les suggestions sont fermées à l'anonyme (401)");
}

main('Suggestions de recettes', run);
