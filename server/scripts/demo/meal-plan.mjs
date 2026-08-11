import { call, check, checkEqual, isoDate, main, register, section } from './lib.mjs';

/**
 * Planning de repas, personnel et partagé : la même entrée sert les deux
 * usages selon que `cookbookId` est renseigné, et les droits changent avec.
 *
 * Usage : node scripts/demo/meal-plan.mjs
 */

async function invite(ownerToken, cookbookId, guest, role) {
  const invitation = await call('POST', '/cookbooks/' + cookbookId + '/invitations', {
    token: ownerToken,
    body: { email: guest.email, role },
  });
  await call('POST', '/invitations/' + invitation.token + '/accept', { token: guest.token });
}

async function run() {
  const owner = await register('planificateur');
  const editor = await register('coequipier');
  const reader = await register('lecteur');
  const intrus = await register('intrus');

  const recipe = await call('POST', '/recipes', {
    token: owner.token,
    body: { title: 'Lasagnes', servings: 4 },
  });
  const autreRecette = await call('POST', '/recipes', {
    token: owner.token,
    body: { title: 'Salade César' },
  });

  const lundi = isoDate(1);
  const mardi = isoDate(2);
  const dimanche = isoDate(7);

  section('Planning personnel');
  const entry = await call('POST', '/meal-plan', {
    token: owner.token,
    body: { recipeId: recipe.id, date: lundi, mealType: 'dîner', servings: 4 },
  });
  checkEqual(entry.date, lundi, 'entrée personnelle : la date est reprise');
  checkEqual(entry.mealType, 'dîner', 'entrée personnelle : le créneau est repris');
  checkEqual(entry.cookbookId, null, 'entrée personnelle : aucun cookbook rattaché');
  checkEqual(entry.recipe.title, 'Lasagnes', 'entrée personnelle : la recette est jointe');

  await call('POST', '/meal-plan', {
    token: owner.token,
    body: { recipeId: recipe.id, date: lundi, mealType: 'goûter' },
    expect: 400,
  });
  check(true, 'un créneau hors de la liste est refusé en 400');

  await call('POST', '/meal-plan', {
    token: owner.token,
    body: { recipeId: recipe.id, date: '01/09/2026', mealType: 'dîner' },
    expect: 400,
  });
  check(true, 'une date mal formée est refusée en 400');

  await call('POST', '/meal-plan', {
    token: intrus.token,
    body: { recipeId: recipe.id, date: lundi, mealType: 'dîner' },
    expect: 403,
  });
  check(true, "on ne planifie pas une recette qu'on n'a pas le droit de lire (403)");

  section('Consultation par fenêtre');
  await call('POST', '/meal-plan', {
    token: owner.token,
    body: { recipeId: autreRecette.id, date: dimanche, mealType: 'déjeuner' },
  });

  const semaine = await call('GET', '/meal-plan', {
    token: owner.token,
    query: { from: lundi, to: mardi },
  });
  checkEqual(semaine.length, 1, 'la fenêtre ne rend que les entrées qu elle couvre');

  const complet = await call('GET', '/meal-plan', { token: owner.token });
  checkEqual(complet.length, 2, 'sans fenêtre, le planning entier est rendu');

  await call('GET', '/meal-plan', {
    token: owner.token,
    query: { from: dimanche, to: lundi },
    expect: 400,
  });
  check(true, 'une fenêtre inversée est refusée plutôt que rendue vide');

  const chezLIntrus = await call('GET', '/meal-plan', { token: intrus.token });
  checkEqual(chezLIntrus.length, 0, "le planning personnel d'autrui reste invisible");

  section('Modification');
  const deplacee = await call('PATCH', '/meal-plan/' + entry.id, {
    token: owner.token,
    body: { date: mardi, servings: 6 },
  });
  checkEqual(deplacee.date, mardi, 'entrée déplacée');
  checkEqual(deplacee.servings, 6, 'portions ajustées');

  await call('PATCH', '/meal-plan/' + entry.id, {
    token: owner.token,
    body: { cookbookId: null },
    expect: 400,
  });
  check(
    true,
    "une entrée ne déménage pas d'un planning à l'autre : le champ est refusé, pas ignoré",
  );

  section('Planning partagé');
  const cookbook = await call('POST', '/cookbooks', {
    token: owner.token,
    body: { name: 'Semaine en famille' },
  });
  await invite(owner.token, cookbook.id, editor, 'EDITOR');
  await invite(owner.token, cookbook.id, reader, 'READER');
  await call('PUT', '/cookbooks/' + cookbook.id + '/recipes/' + recipe.id, { token: owner.token });

  const partagee = await call('POST', '/meal-plan', {
    token: editor.token,
    body: { recipeId: recipe.id, cookbookId: cookbook.id, date: lundi, mealType: 'déjeuner' },
  });
  checkEqual(partagee.cookbookId, cookbook.id, "l'éditeur inscrit un repas au planning du groupe");
  checkEqual(partagee.author.email, editor.email, "l'auteur de l'inscription est tracé");

  const vuParLeLecteur = await call('GET', '/meal-plan', {
    token: reader.token,
    query: { cookbookId: cookbook.id },
  });
  checkEqual(vuParLeLecteur.length, 1, 'le lecteur consulte le planning du groupe');

  await call('POST', '/meal-plan', {
    token: reader.token,
    body: { recipeId: recipe.id, cookbookId: cookbook.id, date: mardi, mealType: 'dîner' },
    expect: 403,
  });
  check(true, "le lecteur ne planifie pas pour le groupe (403)");

  await call('GET', '/meal-plan', {
    token: intrus.token,
    query: { cookbookId: cookbook.id },
    expect: 404,
  });
  check(true, 'un non-membre ne consulte pas le planning du groupe (404)');

  const personnelSeul = await call('GET', '/meal-plan', { token: owner.token });
  checkEqual(
    personnelSeul.length,
    2,
    'sans cookbookId, seul le planning personnel remonte : les deux ne se mélangent pas',
  );

  section('Suppression');
  await call('DELETE', '/meal-plan/' + partagee.id, { token: reader.token, expect: 403 });
  check(true, "le lecteur ne retire pas une entrée du planning partagé (403)");

  await call('DELETE', '/meal-plan/' + partagee.id, { token: owner.token });
  const apres = await call('GET', '/meal-plan', {
    token: owner.token,
    query: { cookbookId: cookbook.id },
  });
  checkEqual(apres.length, 0, 'le créateur du cookbook retire une entrée du planning partagé');

  await call('DELETE', '/meal-plan/' + entry.id, { token: intrus.token, expect: 404 });
  check(true, "l'entrée personnelle d'autrui est introuvable pour un tiers (404)");

  await call('DELETE', '/meal-plan/' + entry.id, { token: owner.token });
  check(true, 'entrée personnelle supprimée');
}

main('Planning de repas', run);
