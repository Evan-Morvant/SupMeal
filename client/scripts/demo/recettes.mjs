import { PASSWORD, account, check, checkEqual, main, section } from './lib.mjs';

/**
 * Parcours des recettes : création complète, consultation, favori, recherche,
 * filtres, modification, suppression.
 *
 * Usage : node scripts/demo/recettes.mjs
 */

/** Ouvre une session neuve, pour un carnet vide et prévisible. */
async function signUp(page) {
  await page.goto('/register');
  await page.waitFor('form');
  await page.fillByLabel('Nom affiché', 'Marie Dupont');
  await page.fillByLabel('Adresse e-mail', account('recettes'));
  await page.fillByLabel('Mot de passe', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitFor('nav[aria-label="Navigation principale"]');
}

main(async (page) => {
  section('Compte neuf');
  await signUp(page);
  await page.waitForText('main', 'Votre carnet est vide');
  check(
    (await page.text('main')).includes('Ajouter ma première recette'),
    "un carnet vide propose le geste suivant au lieu d'annoncer zéro résultat",
  );
  await page.shot('01-carnet-vide');

  section('Création');
  await page.goto('/recipes/new');
  await page.waitFor('form');
  await page.fillByLabel('Titre', 'Tarte aux pommes');
  await page.fillByLabel(
    'Description',
    'La tarte de ma grand-mère, pâte brisée et pommes fondantes.',
  );
  await page.fillByLabel('Préparation (min)', '25');
  await page.fillByLabel('Cuisson (min)', '40');
  await page.fillByLabel('Portions', '6');

  // Trois ingrédients : le troisième sans quantité, comme le sel ou le poivre.
  await page.fill('[aria-label^="Quantité de l"][aria-label$="1"]', '250');
  await page.fill('[aria-label^="Unité de l"][aria-label$="1"]', 'g');
  await page.fill('[aria-label^="Nom de l"][aria-label$="1"]', 'farine');
  await page.clickText('button', "Ajouter un ingrédient");
  await page.fill('[aria-label^="Quantité de l"][aria-label$="2"]', '4');
  await page.fill('[aria-label^="Nom de l"][aria-label$="2"]', 'pommes');
  await page.clickText('button', "Ajouter un ingrédient");
  await page.fill('[aria-label^="Nom de l"][aria-label$="3"]', 'sucre vanillé');

  await page.fill('[aria-label="Étape 1"]', 'Préchauffer le four à 180 °C.');
  await page.clickText('button', 'Ajouter une étape');
  await page.fill('[aria-label="Étape 2"]', 'Étaler la pâte et disposer les pommes en rosace.');
  await page.clickText('button', 'Ajouter une étape');
  await page.fill('[aria-label="Étape 3"]', 'Enfourner 40 minutes, puis laisser tiédir.');

  // Le tag se valide par Entrée, qu'il existe déjà au catalogue ou non.
  await page.fill('input[role="combobox"]', 'dessert');
  await page.wait(300);
  await page.press('input[role="combobox"]', 'Enter');
  await page.wait(200);
  check(
    (await page.text('form')).includes('Retirer dessert') ||
      (await page.count('button[aria-label="Retirer dessert"]')) === 1,
    'un tag saisi devient un jeton retirable',
  );
  await page.shot('02-formulaire', { full: true });
  await page.clickText('button[type="submit"]', 'Enregistrer la recette');

  section('Détail');
  await page.waitFor('h1');
  await page.wait(600);
  const detailPath = await page.path();
  check(/^\/recipes\/[0-9a-f-]{36}$/.test(detailPath), 'la création mène au détail de la recette');
  checkEqual(await page.text('h1'), 'Tarte aux pommes', 'le titre enregistré est celui saisi');
  checkEqual(await page.count('ol li'), 3, 'les trois étapes sont rendues dans l’ordre');
  check(
    (await page.text('main')).includes('250 g'),
    'la quantité et son unité apparaissent ensemble',
  );
  check(
    (await page.text('main')).includes('sucre vanillé'),
    'un ingrédient sans quantité est conservé tel quel',
  );
  check(
    (await page.text('main')).includes("Pas encore d'avis"),
    'une recette non notée n’affiche pas une note de zéro',
  );
  await page.shot('03-detail', { full: true });

  section('Favori');
  await page.clickText('button', 'Ajouter aux favoris');
  await page.wait(500);
  check(
    (await page.text('main')).includes('En favori'),
    'le favori bascule sans recharger la page',
  );

  section('Recherche et filtres');
  await page.goto('/recipes?q=pommes');
  await page.waitFor('article');
  checkEqual(await page.count('article'), 1, 'la recherche plein texte retrouve la recette');

  await page.goto('/recipes?q=couscous');
  await page.wait(900);
  check(
    (await page.text('main')).includes('Aucune recette ne correspond'),
    'une recherche sans résultat explique quoi faire',
  );
  await page.shot('04-recherche-vide');

  await page.goto('/recipes?favorite=true');
  await page.waitFor('article');
  checkEqual(await page.count('article'), 1, 'le filtre des favoris retient la recette marquée');

  await page.goto('/recipes?maxPrep=15');
  await page.wait(900);
  check(
    (await page.text('main')).includes('Aucune recette ne correspond'),
    'un filtre de durée trop serré écarte la recette de 25 minutes',
  );

  await page.goto('/recipes');
  await page.waitFor('article');
  await page.shot('05-liste');

  section('Modification');
  await page.goto(detailPath + '/edit');
  await page.waitFor('form');
  await page.fillByLabel('Titre', 'Tarte aux pommes et cannelle');
  await page.clickText('button[type="submit"]', 'Enregistrer les modifications');
  await page.wait(1200);
  checkEqual(
    await page.text('h1'),
    'Tarte aux pommes et cannelle',
    'la modification du titre est enregistrée',
  );

  section('Suppression');
  await page.click('button[aria-label="Supprimer la recette"]');
  await page.waitFor('dialog[open]');
  check(
    (await page.text('dialog[open]')).includes('Tarte aux pommes et cannelle'),
    'la confirmation nomme la recette visée avant d’agir',
  );
  await page.shot('06-confirmation-suppression');
  await page.clickText('dialog[open] button', 'Supprimer');
  await page.wait(1200);
  checkEqual(await page.path(), '/recipes', 'la suppression ramène à la liste');
  check(
    (await page.text('main')).includes('Votre carnet est vide'),
    'la recette supprimée disparaît de la liste',
  );

  checkEqual(await page.pageErrors(), '[]', 'aucune erreur de page sur tout le parcours');
});
