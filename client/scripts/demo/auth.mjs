import { PASSWORD, account, check, checkEqual, main, section } from './lib.mjs';

/**
 * Parcours d'entrée : accueil du visiteur, création de compte, arrivée dans
 * l'espace personnel, garde des routes privées, déconnexion.
 *
 * Usage : node scripts/demo/auth.mjs
 */

main(async (page) => {
  section("Accueil d'un visiteur");
  await page.goto('/');
  check(await page.exists('header a[href="/register"]'), "l'en-tête propose de créer un compte");
  check(
    !(await page.exists('nav[aria-label="Navigation principale"]')),
    'un visiteur ne voit pas le rail de navigation',
  );
  await page.shot('01-accueil-visiteur');

  section('Garde des routes privées');
  await page.goto('/planning');
  await page.waitFor('input[type="password"]');
  checkEqual(await page.path(), '/login', 'une route privée renvoie vers la connexion');

  section('Création de compte');
  await page.goto('/register');
  await page.waitFor('form');
  check(
    (await page.text('form')).includes('vous acceptez les'),
    'le formulaire d’inscription renvoie aux conditions d’utilisation',
  );
  await page.shot('02-inscription');

  // Le lien doit mener quelque part : une mention sans page ne vaut rien.
  await page.clickText('form a', 'conditions');
  await page.waitForText('main', 'Conditions générales');
  check(
    (await page.text('main')).includes('privée par défaut'),
    'les conditions décrivent la visibilité réelle des recettes',
  );
  await page.shot('03-conditions', { full: true });
  await page.goto('/register');
  await page.waitFor('form');

  const email = account('demo');
  await page.fill('input[autocomplete="name"]', 'Marie Dupont');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');

  section('Espace personnel');
  await page.waitFor('nav[aria-label="Navigation principale"]');
  checkEqual(await page.path(), '/recipes', "l'inscription mène à ses recettes");
  check(
    (await page.text('header')).includes('Marie Dupont'),
    'l’en-tête affiche le nom du compte',
  );
  await page.shot('04-espace-connecte');

  section('Rail replié');
  await page.click('button[aria-label$="la navigation"]');
  await page.wait(500);
  checkEqual(
    await page.evaluate(
      `document.querySelector('nav[aria-label="Navigation principale"]').dataset.collapsed`,
    ),
    'true',
    'le rail se replie sur les icônes seules',
  );
  await page.shot('05-rail-replie');

  /*
   * Le bouton de repli avait perdu ses dimensions : un fragment de selecteur
   * orphelin le stylait uniquement rail replie. Un controle de geometrie
   * attrape ce qu'un controle de presence laisse passer.
   */
  const taille = await page.evaluate(`(() => {
    const b = document.querySelector('button[aria-label$="la navigation"]');
    const r = b.getBoundingClientRect();
    return Math.round(r.width) + 'x' + Math.round(r.height);
  })()`);
  checkEqual(taille, '34x34', 'le bouton de repli garde sa taille, replie comme deplie');
  await page.click('button[aria-label$="la navigation"]');
  await page.wait(400);

  section('Écran étroit');
  await page.resize(430, 900);
  check(
    await page.evaluate(
      `getComputedStyle(document.querySelector('nav[aria-label="Navigation"]')).display !== 'none'`,
    ),
    "la barre d'onglets remplace le rail sous 860 px",
  );
  await page.shot('06-mobile-onglets');
  await page.resize(1280, 900);

  section('Session reprise après rechargement');
  /*
   * L'access token vit en mémoire : un rechargement le perd. La session doit
   * être réémise depuis le refresh token sans repasser par le formulaire —
   * c'est le seul endroit où ce mécanisme se voit.
   */
  await page.goto('/recipes');
  await page.wait(1200);
  checkEqual(await page.path(), '/recipes', 'un rechargement ne renvoie pas vers la connexion');
  check(
    await page.exists('nav[aria-label="Navigation principale"]'),
    "l'access token est réémis depuis le refresh token",
  );

  section('Déconnexion');
  await page.click('button[aria-label="Se déconnecter"]');
  await page.wait(900);
  check(
    !(await page.exists('nav[aria-label="Navigation principale"]')),
    'la déconnexion ramène le visiteur hors de son espace',
  );

  checkEqual(await page.pageErrors(), '[]', 'aucune erreur de page sur tout le parcours');
});
