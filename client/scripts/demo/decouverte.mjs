import { PASSWORD, account, check, checkEqual, main, section } from './lib.mjs';

/**
 * Découverte publique, accueil et avis : publier une recette, la retrouver en
 * visiteur, la noter avec un autre compte, et le refus opposé à son créateur.
 *
 * Usage : node scripts/demo/decouverte.mjs
 */

/** Titre propre à cette exécution : la base de démonstration est partagée. */
const TITRE = 'Risotto de la demo ' + Date.now().toString(36);

async function signUp(page, nom) {
  await page.goto('/register');
  await page.waitFor('form');
  await page.fillByLabel('Nom affiché', nom);
  const email = account('decouverte');
  await page.fillByLabel('Adresse e-mail', email);
  await page.fillByLabel('Mot de passe', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitFor('nav[aria-label="Navigation principale"]');
  return email;
}

async function signIn(page, email) {
  await page.goto('/login');
  await page.waitFor('input[type="email"]');
  await page.fillByLabel('Adresse e-mail', email);
  await page.fillByLabel('Mot de passe', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitFor('nav[aria-label="Navigation principale"]');
}

async function signOut(page) {
  await page.click('button[aria-label="Se déconnecter"]');
  await page.wait(900);
}

main(async (page) => {
  section('Publication d’une recette');
  const chef = await signUp(page, 'Chef Camille');
  await page.goto('/recipes/new');
  await page.waitFor('form');
  await page.fillByLabel('Titre', TITRE);
  await page.fillByLabel('Description', 'Crémeux, au parmesan et au poivre noir.');
  await page.fillByLabel('Préparation (min)', '15');
  await page.fillByLabel('Cuisson (min)', '25');
  await page.fill('[aria-label^="Nom de l"][aria-label$="1"]', 'riz arborio');
  await page.fill('[aria-label="Étape 1"]', 'Faire nacrer le riz, puis mouiller au bouillon.');
  await page.fillByLabel('Visibilité', 'public');
  await page.wait(300);
  check(
    (await page.text('form')).includes('rend ses tags visibles de tous'),
    'passer une recette en publique avertit sur la visibilité des tags',
  );
  await page.clickText('button[type="submit"]', 'Enregistrer la recette');
  await page.waitFor('h1');
  await page.wait(600);
  check((await page.text('main')).includes('Publique'), 'la recette est bien publiée');

  section('Ce que voit un visiteur');
  await signOut(page);
  await page.goto('/');
  await page.waitForText('main', 'rassemblées');
  check(
    !(await page.exists('nav[aria-label="Navigation principale"]')),
    'le visiteur reste hors de l’espace connecté',
  );
  await page.shot('01-accueil-visiteur');

  await page.goto('/discover?q=' + encodeURIComponent(TITRE));
  await page.waitFor('article');
  checkEqual(await page.count('article'), 1, 'la recherche publique retrouve la recette publiée');
  await page.shot('02-decouverte');

  await page.clickText('h3 a', TITRE);
  await page.waitFor('h1');
  await page.wait(700);
  checkEqual(await page.text('h1'), TITRE, 'le détail public s’ouvre sans compte');
  check(
    (await page.text('main')).includes('Connectez-vous'),
    'un visiteur est invité à se connecter pour donner son avis',
  );
  check(
    (await page.text('main')).includes("Personne n'a encore donné son avis"),
    'une recette sans avis le dit, plutôt que d’afficher une note de zéro',
  );
  const cheminPublic = await page.path();
  await page.shot('03-detail-public');

  section('Avis d’un autre compte');
  await signUp(page, 'Alex Martin');
  await page.goto(cheminPublic);
  await page.waitFor('fieldset');
  await page.click('input[type="radio"][value="4"]');
  await page.fill('[aria-label="Votre commentaire"]', 'Très bon, j’ai ajouté un peu de safran.');
  await page.clickText('button', 'Publier mon avis');
  await page.wait(1400);
  check((await page.text('main')).includes('4.0'), 'la moyenne apparaît après le premier avis');
  check(
    (await page.text('main')).includes('Mettre à jour'),
    'l’avis déjà déposé se modifie au lieu de se dupliquer',
  );
  await page.shot('04-avis');

  section('Le créateur ne note pas sa recette');
  await signOut(page);
  await signIn(page, chef);
  await page.goto(cheminPublic);
  await page.wait(900);
  check(
    (await page.text('main')).includes('Vous ne pouvez pas noter votre propre recette'),
    'le créateur ne peut pas peser sur la moyenne de sa recette',
  );
  check(
    (await page.text('main')).includes('Alex Martin'),
    'il lit en revanche l’avis des autres',
  );

  section('Accueil d’un compte');
  await page.goto('/');
  await page.wait(1500);
  const accueil = await page.text('main');
  check(accueil.includes('Bonjour Chef Camille'), 'l’accueil connecté salue par le nom du compte');
  check(
    accueil.includes('À cuisiner cette semaine') || accueil.includes('Pour commencer'),
    'l’accueil propose des suggestions, ou la vitrine si le compte est trop neuf',
  );
  await page.shot('05-accueil-connecte');

  checkEqual(await page.pageErrors(), '[]', 'aucune erreur de page sur tout le parcours');
});
