import { PNG_1x1, call, check, checkEqual, main, register, section, sendFile } from './lib.mjs';

/**
 * Recettes : cycle de vie complet, image, favoris, et les règles d'accès qui
 * séparent le créateur des autres utilisateurs.
 *
 * Usage : node scripts/demo/recipes.mjs
 */

const TARTE = {
  title: 'Tarte aux pommes',
  description: 'La recette de mamie',
  prepTimeMin: 20,
  cookTimeMin: 40,
  servings: 6,
  source: 'https://exemple.fr/tarte',
  tags: ['Dessert', 'Facile'],
  ingredients: [
    { name: 'farine', quantity: 200, unit: 'g', note: 'tamisée' },
    { name: 'pommes', quantity: 4 },
    { name: 'sel' },
  ],
  steps: ['Préparer la pâte', 'Éplucher les pommes', 'Enfourner 40 min'],
};

async function run() {
  const chef = await register('chef');
  const autre = await register('curieux');

  section('Création');
  const recipe = await call('POST', '/recipes', { token: chef.token, body: TARTE });
  checkEqual(recipe.title, TARTE.title, 'création : le titre est repris');
  checkEqual(recipe.ownerId, chef.id, 'création : le créateur est le porteur du token');
  checkEqual(recipe.visibility, 'private', 'création : une recette est privée par défaut');
  checkEqual(recipe.ingredients.length, 3, 'création : les trois lignes d ingrédients sont là');
  checkEqual(recipe.steps.length, 3, 'création : les trois étapes sont là');

  const farine = recipe.ingredients[0];
  checkEqual(farine.quantity, 200, 'ingrédient : la quantité revient bien en nombre');
  checkEqual(farine.unit, 'g', 'ingrédient : unité conservée');
  checkEqual(farine.note, 'tamisée', 'ingrédient : note conservée');
  check(
    recipe.ingredients[2].quantity === null,
    'ingrédient : un ingrédient sans quantité reste permis (le sel)',
  );

  section('Consultation');
  const detail = await call('GET', '/recipes/' + recipe.id, { token: chef.token });
  checkEqual(detail.id, recipe.id, 'consultation par le créateur');
  checkEqual(detail.isFavorite, false, 'consultation : pas encore en favori');

  await call('GET', '/recipes/' + recipe.id, { token: autre.token, expect: 403 });
  check(true, "une recette privée d'autrui est inaccessible (403)");

  const list = await call('GET', '/recipes', { token: autre.token });
  checkEqual(list.items.length, 0, "la recette d'autrui n'apparaît pas non plus dans la liste");

  section('Modification');
  const updated = await call('PATCH', '/recipes/' + recipe.id, {
    token: chef.token,
    body: { servings: 8, steps: ['Tout mélanger', 'Cuire'] },
  });
  checkEqual(updated.servings, 8, 'modification : le champ visé change');
  checkEqual(updated.title, TARTE.title, 'modification : les champs absents sont conservés');
  checkEqual(
    updated.steps.map((step) => step.instruction),
    ['Tout mélanger', 'Cuire'],
    'modification : une collection fournie remplace intégralement l ancienne',
  );
  checkEqual(updated.ingredients.length, 3, 'modification : la collection absente est conservée');

  await call('PATCH', '/recipes/' + recipe.id, {
    token: autre.token,
    body: { title: 'Détournée' },
    expect: 403,
  });
  check(true, "un tiers ne peut pas modifier la recette (403)");

  section('Image');
  const withImage = await sendFile('/recipes/' + recipe.id + '/image', {
    token: chef.token,
    filename: 'tarte.png',
    contentType: 'image/png',
    content: PNG_1x1,
  });
  check(
    typeof withImage.imageUrl === 'string' && withImage.imageUrl.startsWith('http'),
    'image : rendue en URL absolue',
  );

  await sendFile('/recipes/' + recipe.id + '/image', {
    token: chef.token,
    filename: 'virus.txt',
    contentType: 'text/plain',
    content: 'ceci nest pas une image',
    expect: 400,
  });
  check(true, 'image : un type non supporté est refusé en 400');

  await sendFile('/recipes/' + recipe.id + '/image', {
    token: autre.token,
    filename: 'tarte.png',
    contentType: 'image/png',
    content: PNG_1x1,
    expect: 403,
  });
  check(true, "image : seul le créateur peut la remplacer (403)");

  section('Favoris');
  await call('POST', '/recipes/' + recipe.id + '/favorite', { token: chef.token });
  const favori = await call('GET', '/recipes/' + recipe.id, { token: chef.token });
  checkEqual(favori.isFavorite, true, 'favori : ajouté');

  await call('POST', '/recipes/' + recipe.id + '/favorite', { token: chef.token });
  check(true, 'favori : ajouter deux fois reste sans effet (idempotent)');

  const favoris = await call('GET', '/recipes', { token: chef.token, query: { favorite: 'true' } });
  checkEqual(favoris.total, 1, 'favori : la recette ressort du filtre favoris');

  await call('DELETE', '/recipes/' + recipe.id + '/favorite', { token: chef.token });
  const sansFavori = await call('GET', '/recipes/' + recipe.id, { token: chef.token });
  checkEqual(sansFavori.isFavorite, false, 'favori : retiré');

  section('Suppression');
  const jetable = await call('POST', '/recipes', {
    token: chef.token,
    body: { title: 'Recette à jeter' },
  });
  await call('DELETE', '/recipes/' + jetable.id, { token: autre.token, expect: 403 });
  check(true, "suppression : refusée à un tiers (403)");

  await call('DELETE', '/recipes/' + jetable.id, { token: chef.token });
  await call('GET', '/recipes/' + jetable.id, { token: chef.token, expect: 404 });
  check(true, 'suppression : la recette a bien disparu (404)');
}

main('Recettes', run);
