import { PASSWORD, account, check, checkEqual, log, main, section } from './lib.mjs';

/**
 * Passe chaque écran principal en largeur de téléphone. Le contrôle porte sur
 * le débordement horizontal : c'est le défaut responsive qui se voit le plus
 * et se corrige le moins par hasard — une page qui glisse latéralement rend la
 * lecture pénible sans jamais rien casser franchement.
 *
 * Produit aussi les captures mobiles du manuel utilisateur.
 *
 * Usage : node scripts/demo/responsive.mjs
 */

const TELEPHONE = { width: 390, height: 844 };

/** Marge de tolérance : un pixel de sous-pixel ne compte pas. */
const TOLERANCE = 2;

async function verifier(page, chemin, nom) {
  await page.goto(chemin);
  await page.wait(1100);
  const debord = await page.evaluate(
    `document.documentElement.scrollWidth - window.innerWidth`,
  );
  if (debord > TOLERANCE) {
    log(nom, 'débordement horizontal de ' + debord + ' px');
  }
  check(debord <= TOLERANCE, nom + ' tient dans la largeur de l’écran');
  await page.shot('mobile-' + nom);
}

main(
  async (page) => {
    await page.resize(TELEPHONE.width, TELEPHONE.height);

    section('Pages ouvertes aux visiteurs');
    await verifier(page, '/', 'accueil');
    await verifier(page, '/discover', 'decouverte');
    await verifier(page, '/login', 'connexion');

    section('Espace connecté');
    await page.goto('/register');
    await page.waitFor('form');
    await page.fillByLabel('Nom affiché', 'Camille Roux');
    await page.fillByLabel('Adresse e-mail', account('responsive'));
    await page.fillByLabel('Mot de passe', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitFor('nav[aria-label="Navigation"]');

    await page.goto('/recipes/new');
    await page.waitFor('form');
    await page.fillByLabel('Titre', 'Tarte fine aux courgettes');
    await page.fillByLabel('Préparation (min)', '20');
    await page.fillByLabel('Cuisson (min)', '25');
    await page.fill('[aria-label^="Quantité de l"][aria-label$="1"]', '2');
    await page.fill('[aria-label^="Nom de l"][aria-label$="1"]', 'courgettes');
    await page.fill('[aria-label="Étape 1"]', 'Émincer finement, puis enfourner.');
    await page.clickText('button[type="submit"]', 'Enregistrer la recette');
    await page.waitFor('h1');
    await page.wait(700);
    const detail = await page.path();

    await verifier(page, '/recipes', 'mes-recettes');
    await verifier(page, detail, 'detail-recette');
    await verifier(page, '/recipes/new', 'formulaire-recette');
    await verifier(page, '/cookbooks', 'cookbooks');
    await verifier(page, '/planning', 'planning');
    await verifier(page, '/shopping-lists', 'courses');
    await verifier(page, '/settings', 'parametres');

    section('Navigation du pouce');
    // Sous 860 px le rail cède la place à la barre d'onglets.
    // Masqué en CSS, non retiré du DOM : c'est la visibilité qui compte.
    check(
      !(await page.visible('nav[aria-label="Navigation principale"]')),
      'le rail latéral cède la place sur téléphone',
    );
    check(
      await page.visible('nav[aria-label="Navigation"]'),
      'la barre d’onglets est là, sous le pouce',
    );

    section('En-tête sur téléphone');
    check(
      await page.visible('header a[aria-label="SUPMEAL, accueil"]'),
      'la marque reste visible quand le rail cède la place',
    );
    check(
      await page.visible('header button[aria-label="Se déconnecter"]'),
      'la déconnexion reste atteignable sans le rail',
    );

    section('En-tête du visiteur');
    await page.click('header button[aria-label="Se déconnecter"]');
    await page.wait(1200);
    // Les deux boutons doivent tenir cote a cote sans etre rognes.
    const rognage = await page.evaluate(`(() => {
      const entete = document.querySelector('header');
      const boutons = [...entete.querySelectorAll('a')].filter((a) => a.getAttribute('aria-label') === null);
      const bord = entete.getBoundingClientRect().right;
      return boutons.filter((b) => b.getBoundingClientRect().right > bord + 1).length;
    })()`);
    checkEqual(rognage, 0, 'aucun bouton de l’en-tête ne dépasse de l’écran');
    await page.shot('mobile-entete-visiteur');

    checkEqual(await page.pageErrors(), '[]', 'aucune erreur de page sur tout le parcours');
  },
  TELEPHONE,
);
