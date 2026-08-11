import { call, check, checkEqual, isoDate, main, register, section } from './lib.mjs';

/**
 * Listes de courses générées depuis le planning : agrégation des ingrédients,
 * mise à l'échelle des portions, instantané figé, et partage avec le groupe.
 *
 * Usage : node scripts/demo/shopping-lists.mjs
 */

const LUNDI = isoDate(1);
const MARDI = isoDate(2);
const DIMANCHE = isoDate(7);

/** Lignes rendues, réduites à ce qui se lit sur une liste de courses. */
function lines(list) {
  return list.items.map((item) => ({
    name: item.ingredient.name,
    quantity: item.quantity,
    unit: item.unit,
  }));
}

async function createRecipe(token, body) {
  const recipe = await call('POST', '/recipes', { token, body });
  return recipe.id;
}

async function planMeal(token, body) {
  await call('POST', '/meal-plan', { token, body });
}

async function invite(ownerToken, cookbookId, guest, role) {
  const invitation = await call('POST', '/cookbooks/' + cookbookId + '/invitations', {
    token: ownerToken,
    body: { email: guest.email, role },
  });
  await call('POST', '/invitations/' + invitation.token + '/accept', { token: guest.token });
}

async function run() {
  const user = await register('cuisinier');

  section('Agrégation');
  const tarte = await createRecipe(user.token, {
    title: 'Tarte aux pommes',
    ingredients: [
      { name: 'farine', quantity: 200, unit: 'g' },
      { name: 'pommes', quantity: 4 },
      { name: 'sel' },
    ],
  });
  const gateau = await createRecipe(user.token, {
    title: 'Gateau au yaourt',
    ingredients: [
      { name: 'farine', quantity: 300, unit: 'g' },
      { name: 'sucre', quantity: 100, unit: 'g' },
    ],
  });
  await planMeal(user.token, { recipeId: tarte, date: LUNDI, mealType: 'dîner' });
  await planMeal(user.token, { recipeId: gateau, date: MARDI, mealType: 'collation' });

  const liste = await call('POST', '/shopping-lists', {
    token: user.token,
    body: { fromDate: LUNDI, toDate: MARDI },
  });
  checkEqual(
    lines(liste),
    [
      { name: 'farine', quantity: 500, unit: 'g' },
      { name: 'pommes', quantity: 4, unit: null },
      { name: 'sel', quantity: null, unit: null },
      { name: 'sucre', quantity: 100, unit: 'g' },
    ],
    'la farine des deux recettes est cumulée, le sel reste sans quantité',
  );
  checkEqual(liste.cookbookId, null, 'liste personnelle : aucun cookbook rattaché');
  check(liste.name.includes(LUNDI), "l'intitulé par défaut rappelle la période couverte");

  section('Mise à l échelle des portions');
  const gratin = await createRecipe(user.token, {
    title: 'Gratin',
    servings: 4,
    ingredients: [{ name: 'pommes de terre', quantity: 800, unit: 'g' }],
  });
  // 8 parts prévues d'une recette qui en donne 4 : les quantités doublent.
  await planMeal(user.token, {
    recipeId: gratin,
    date: DIMANCHE,
    mealType: 'dîner',
    servings: 8,
  });

  const doublee = await call('POST', '/shopping-lists', {
    token: user.token,
    body: { fromDate: DIMANCHE, toDate: DIMANCHE },
  });
  checkEqual(
    lines(doublee),
    [{ name: 'pommes de terre', quantity: 1600, unit: 'g' }],
    '8 parts prévues pour une recette qui en donne 4 : les quantités doublent',
  );

  section('Fenêtre et période vide');
  const fenetre = await call('POST', '/shopping-lists', {
    token: user.token,
    body: { fromDate: LUNDI, toDate: LUNDI },
  });
  checkEqual(
    lines(fenetre).map((line) => line.name),
    ['farine', 'pommes', 'sel'],
    'seuls les repas de la fenêtre demandée entrent dans la liste',
  );

  await call('POST', '/shopping-lists', {
    token: user.token,
    body: { fromDate: isoDate(200), toDate: isoDate(201) },
    expect: 422,
  });
  check(true, 'une période sans aucun repas planifié est refusée en 422');

  await call('POST', '/shopping-lists', {
    token: user.token,
    body: { fromDate: DIMANCHE, toDate: LUNDI },
    expect: 400,
  });
  check(true, 'une fenêtre inversée est refusée en 400');

  section('Instantané');
  await call('PATCH', '/recipes/' + tarte, {
    token: user.token,
    body: { ingredients: [{ name: 'farine', quantity: 9000, unit: 'g' }] },
  });
  const relue = await call('GET', '/shopping-lists/' + fenetre.id, { token: user.token });
  checkEqual(
    lines(relue).find((line) => line.name === 'farine').quantity,
    200,
    'modifier la recette ensuite ne réécrit pas une liste déjà générée',
  );

  section('Cocher les lignes');
  const ligne = relue.items[0];
  const cochee = await call('PATCH', '/shopping-lists/' + relue.id + '/items/' + ligne.id, {
    token: user.token,
    body: { checked: true },
  });
  checkEqual(cochee.id, ligne.id, 'la ligne seule est rendue, pas la liste entière');
  checkEqual(cochee.checked, true, 'la ligne est cochée');

  const corrigee = await call('PATCH', '/shopping-lists/' + relue.id + '/items/' + ligne.id, {
    token: user.token,
    body: { quantity: 250, unit: 'g' },
  });
  checkEqual(corrigee.quantity, 250, 'quantité corrigée à la main');

  await call('PATCH', '/shopping-lists/' + relue.id + '/items/' + ligne.id, {
    token: user.token,
    body: {},
    expect: 400,
  });
  check(true, 'une modification vide est refusée en 400');

  section('Liste de groupe');
  const cookbook = await call('POST', '/cookbooks', {
    token: user.token,
    body: { name: 'Colocation' },
  });
  const lecteur = await register('lecteur');
  const editeur = await register('editeur');
  await invite(user.token, cookbook.id, lecteur, 'READER');
  await invite(user.token, cookbook.id, editeur, 'EDITOR');

  const couscous = await createRecipe(user.token, {
    title: 'Couscous',
    ingredients: [{ name: 'semoule', quantity: 500, unit: 'g' }],
  });
  await call('PUT', '/cookbooks/' + cookbook.id + '/recipes/' + couscous, { token: user.token });
  await planMeal(user.token, {
    recipeId: couscous,
    cookbookId: cookbook.id,
    date: LUNDI,
    mealType: 'déjeuner',
  });

  const groupe = await call('POST', '/shopping-lists', {
    token: editeur.token,
    body: { fromDate: LUNDI, toDate: LUNDI, cookbookId: cookbook.id },
  });
  checkEqual(groupe.cookbookId, cookbook.id, "l'éditeur génère la liste du groupe");
  checkEqual(
    lines(groupe),
    [{ name: 'semoule', quantity: 500, unit: 'g' }],
    'elle ne porte que sur le planning du groupe, pas sur les repas personnels',
  );

  const chezLeLecteur = await call('GET', '/shopping-lists', { token: lecteur.token });
  check(
    chezLeLecteur.some((entry) => entry.id === groupe.id),
    'le lecteur voit la liste du groupe sans l avoir générée',
  );

  await call('POST', '/shopping-lists', {
    token: lecteur.token,
    body: { fromDate: LUNDI, toDate: LUNDI, cookbookId: cookbook.id },
    expect: 403,
  });
  check(true, 'le lecteur ne génère pas de liste pour le groupe (403)');

  await call('PATCH', '/shopping-lists/' + groupe.id + '/items/' + groupe.items[0].id, {
    token: lecteur.token,
    body: { checked: true },
    expect: 403,
  });
  check(true, 'et il ne coche pas les lignes (403) : la liste relève de l éditeur');

  const intrus = await register('intrus');
  const rienAVoir = await call('GET', '/shopping-lists', { token: intrus.token });
  checkEqual(rienAVoir, [], 'un non-membre ne voit aucune de ces listes');
  await call('GET', '/shopping-lists/' + groupe.id, { token: intrus.token, expect: 404 });
  check(true, 'et la liste du groupe lui est introuvable (404)');

  section('Suppression');
  await call('DELETE', '/shopping-lists/' + fenetre.id, { token: user.token });
  await call('GET', '/shopping-lists/' + fenetre.id, { token: user.token, expect: 404 });
  check(true, 'liste supprimée');
}

main('Listes de courses', run);
