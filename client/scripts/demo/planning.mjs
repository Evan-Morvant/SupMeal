import { PASSWORD, account, check, checkEqual, main, section } from './lib.mjs';

/**
 * Planning de la semaine et liste de courses : planifier depuis une fiche,
 * déplacer un repas, générer la liste, cocher au marché.
 *
 * Usage : node scripts/demo/planning.mjs
 */

const RECETTE = 'Chili de la demo ' + Date.now().toString(36);

/** Lundi de la semaine en cours, au format que l'API attend. */
function lundi() {
  const jour = new Date();
  const decalage = (jour.getDay() + 6) % 7;
  jour.setDate(jour.getDate() - decalage);
  return jour.toISOString().slice(0, 10);
}

/** Jour de la semaine affichée, décalé de `n` jours après le lundi. */
function jour(n) {
  const date = new Date(lundi() + 'T12:00:00');
  date.setDate(date.getDate() + n);
  return date.toISOString().slice(0, 10);
}

main(async (page) => {
  section('Compte et recette');
  await page.goto('/register');
  await page.waitFor('form');
  await page.fillByLabel('Nom affiché', 'Camille Roux');
  await page.fillByLabel('Adresse e-mail', account('planning'));
  await page.fillByLabel('Mot de passe', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitFor('nav[aria-label="Navigation principale"]');

  await page.goto('/recipes/new');
  await page.waitFor('form');
  await page.fillByLabel('Titre', RECETTE);
  await page.fillByLabel('Portions', '4');
  await page.fill('[aria-label^="Quantité de l"][aria-label$="1"]', '400');
  await page.fill('[aria-label^="Unité de l"][aria-label$="1"]', 'g');
  await page.fill('[aria-label^="Nom de l"][aria-label$="1"]', 'haricots rouges');
  await page.clickText('button', 'Ajouter un ingrédient');
  await page.fill('[aria-label^="Nom de l"][aria-label$="2"]', 'cumin');
  await page.fill('[aria-label="Étape 1"]', 'Laisser mijoter une heure.');
  await page.clickText('button[type="submit"]', 'Enregistrer la recette');
  await page.waitFor('h1');
  await page.wait(700);

  section('Planifier depuis la fiche');
  await page.clickText('button', 'Planifier');
  await page.waitFor('dialog[open]');
  await page.fillByLabel('Jour', jour(2));
  await page.fillByLabel('Repas', 'dîner');
  await page.fillByLabel('Portions', '6');
  await page.clickText('dialog[open] button', 'Planifier');
  await page.wait(1200);

  await page.goto('/planning');
  await page.waitForText('main', RECETTE);
  check(
    (await page.text('main')).includes('6 pers.'),
    'le repas planifié porte les portions demandées, non celles de la recette',
  );
  await page.shot('01-planning');

  section('Déplacer un repas');
  await page.clickText('button', RECETTE);
  await page.waitFor('dialog[open]');
  check(
    (await page.text('dialog[open]')).includes("d'un planning à l'autre"),
    'la boîte explique qu’un repas ne change pas de planning',
  );
  await page.fillByLabel('Jour', jour(4));
  await page.clickText('dialog[open] button', 'Enregistrer');
  await page.wait(1200);
  checkEqual(
    await page.count('button[class*="entry"]'),
    1,
    'le repas déplacé reste unique dans la semaine',
  );

  section('Semaine suivante');
  await page.clickText('button[aria-label="Semaine suivante"]', '');
  await page.wait(900);
  check(
    !(await page.text('main')).includes(RECETTE),
    'la semaine suivante ne montre pas les repas de celle-ci',
  );
  await page.clickText('button', 'Cette semaine');
  await page.waitForText('main', RECETTE);

  section('Liste de courses');
  await page.clickText('button', 'Liste de courses');
  await page.waitFor('dialog[open]');
  await page.clickText('dialog[open] button', 'Générer');
  await page.wait(1600);
  const liste = await page.text('main');
  check(liste.includes('haricots rouges'), 'la liste reprend les ingrédients du planning');
  check(
    liste.includes('600'),
    'les quantités sont mises à l’échelle des portions prévues (400 g pour 4, 600 pour 6)',
  );
  check(liste.includes('cumin'), 'un ingrédient sans quantité figure quand même');
  await page.shot('02-liste');

  section('Cocher au marché');
  await page.click('input[type="checkbox"]');
  await page.wait(900);
  check(
    (await page.text('main')).includes('1 sur 2 coché'),
    'cocher une ligne met à jour le compte',
  );

  section('Fenêtre sans repas');
  await page.goto('/shopping-lists');
  await page.waitForText('main', 'Listes de courses');
  await page.clickText('button', 'Générer une liste');
  await page.waitFor('dialog[open]');
  // Une semaine vide : le refus doit s'expliquer, pas s'afficher en erreur brute.
  await page.fillByLabel('Du', jour(21));
  await page.fillByLabel('Au', jour(27));
  await page.clickText('dialog[open] button', 'Générer');
  await page.wait(1400);
  check(
    (await page.text('dialog[open]')).includes("rien à acheter"),
    'une période sans repas est expliquée plutôt que rendue en erreur',
  );
  await page.shot('03-fenetre-vide');

  checkEqual(await page.pageErrors(), '[]', 'aucune erreur de page sur tout le parcours');
});
