import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PASSWORD, account, check, checkEqual, main, section } from './lib.mjs';

/**
 * Paramètres du compte : profil, mot de passe, comptes liés, préférences
 * culinaires, export et import.
 *
 * Usage : node scripts/demo/parametres.mjs
 */

const RECETTE = 'Soupe de la demo ' + Date.now().toString(36);

main(async (page) => {
  section('Compte et recette');
  const email = account('parametres');
  await page.goto('/register');
  await page.waitFor('form');
  await page.fillByLabel('Nom affiché', 'Camille Roux');
  await page.fillByLabel('Adresse e-mail', email);
  await page.fillByLabel('Mot de passe', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitFor('nav[aria-label="Navigation principale"]');

  await page.goto('/recipes/new');
  await page.waitFor('form');
  await page.fillByLabel('Titre', RECETTE);
  await page.fill('[aria-label^="Nom de l"][aria-label$="1"]', 'potiron');
  await page.fill('[aria-label="Étape 1"]', 'Mixer.');
  await page.clickText('button[type="submit"]', 'Enregistrer la recette');
  await page.waitFor('h1');
  await page.wait(700);

  section('Profil');
  await page.goto('/settings');
  await page.waitForText('main', 'Profil');
  checkEqual(
    await page.valueByLabel('Adresse e-mail'),
    email,
    'l’adresse du compte est affichée, en lecture seule',
  );
  await page.fillByLabel('Nom affiché', 'Camille Durand');
  await page.clickText('button', 'Enregistrer');
  await page.wait(1200);
  check(
    (await page.text('header')).includes('Camille Durand'),
    'le nom change aussi dans l’en-tête, sans rechargement',
  );
  await page.shot('01-compte');

  section('Mot de passe');
  check(
    (await page.text('main')).includes('déconnecte vos autres appareils'),
    'le changement de mot de passe prévient que les sessions sont révoquées',
  );
  check(
    (await page.text('main')).includes('Douze caractères au minimum'),
    'la règle de robustesse est annoncée avant la saisie',
  );

  section('Comptes liés');
  // `innerText` rend le texte tel qu'affiché : `text-transform` compris.
  const compte = (await page.text('main')).toLowerCase();
  check(
    compte.includes('google') && compte.includes('github'),
    'les deux fournisseurs de connexion sont proposés',
  );

  section('Préférences culinaires');
  await page.clickText('nav[aria-label="Sections des paramètres"] a', 'Préférences');
  await page.waitForText('main', 'Préférences culinaires');
  check(
    (await page.text('main')).includes('écarte aussi le beurre'),
    'la portée volontairement large des allergies est expliquée',
  );
  await page.fill('input[role="combobox"]', 'arachide');
  await page.wait(300);
  await page.press('input[role="combobox"]', 'Enter');
  await page.fillByLabel('Portions par défaut', '4');
  await page.clickText('button', 'Enregistrer');
  await page.wait(1200);
  check(
    (await page.text('main')).includes('Préférences enregistrées'),
    'les préférences sont enregistrées',
  );
  await page.shot('02-preferences');

  // Rechargement : ce qui a été enregistré doit revenir du serveur.
  await page.goto('/settings/preferences');
  await page.waitForText('main', 'Préférences culinaires');
  check(
    (await page.text('main')).includes('arachide'),
    'l’allergie déclarée est bien persistée',
  );

  section('Export et import');
  await page.clickText('nav[aria-label="Sections des paramètres"] a', 'Données');
  await page.waitForText('main', 'Exporter mes recettes');
  check(
    (await page.text('main')).includes('en clair'),
    'l’avertissement sur les données en clair précède le téléchargement',
  );
  check(
    (await page.text('main')).includes('ne se réimporte pas'),
    'la portabilité est distinguée de l’export réimportable',
  );
  await page.shot('03-donnees');

  section('Aller-retour export puis import');
  /*
   * Le fichier exporté est réimporté tel quel : les titres étant déjà
   * possédés, tout doit être ignoré. C'est ce qui rend l'import idempotent,
   * et ce qui prouve que le format produit se relit.
   */

  /** Télécharge dans un dossier neuf : `waitForDownload` prend le premier venu. */
  async function telecharger(libelle) {
    const dossier = join(tmpdir(), 'supmeal-dl-' + Math.random().toString(36).slice(2));
    await page.acceptDownloads(dossier);
    await page.clickText('button', libelle);
    const fichier = await page.waitForDownload(dossier);
    return { dossier, fichier };
  }

  /** Réimporte un fichier et rend le compte rendu, en minuscules. */
  async function reimporter(fichier) {
    await page.upload('input[type="file"]', fichier);
    await page.waitForText('main', 'ignorées');
    await page.wait(700);
    // Les libellés du compte rendu sont en capitales à l'écran.
    return (await page.text('main')).toLowerCase();
  }

  const json = await telecharger('Télécharger');
  check(
    json.fichier.includes('supmeal-export-'),
    'le nom du fichier vient du serveur, non d’un repli du client',
  );
  const rapportJson = await reimporter(json.fichier);
  check(/0\s*créées/.test(rapportJson), 'réimporter son propre export ne crée aucun doublon');
  check(/1\s*ignorées/.test(rapportJson), 'la recette déjà possédée est comptée comme ignorée');
  await page.shot('04-import');
  rmSync(json.dossier, { recursive: true, force: true });

  section('Les autres formats');
  // Le CSV est le plus fragile des trois : il passe par un analyseur maison.
  await page.fillByLabel("Format d'export", 'csv');
  const csv = await telecharger('Télécharger');
  check(csv.fichier.endsWith('.csv'), 'l’export CSV produit bien un fichier .csv');
  const rapportCsv = await reimporter(csv.fichier);
  check(
    /1\s*ignorées/.test(rapportCsv),
    'un export CSV se relit par l’import : l’aller-retour tient dans les deux formats',
  );
  rmSync(csv.dossier, { recursive: true, force: true });

  await page.fillByLabel("Format d'export", 'mealie');
  const mealie = await telecharger('Télécharger');
  check(
    mealie.fichier.endsWith('.json') && mealie.fichier.includes('supmeal-export-'),
    'l’export Mealie produit un .json, nommé par le serveur',
  );
  rmSync(mealie.dossier, { recursive: true, force: true });

  section('Portabilité des données personnelles');
  const perso = await telecharger('Télécharger mes données');
  check(
    perso.fichier.includes('supmeal-donnees'),
    'le fichier de portabilité porte son propre nom, distinct de l’export',
  );
  const contenu = JSON.parse(readFileSync(perso.fichier, 'utf8'));
  check(
    contenu.profile !== undefined && contenu.preferences !== undefined,
    'il décrit bien une personne : profil et préférences',
  );
  checkEqual(
    JSON.stringify(contenu).includes('passwordHash'),
    false,
    'aucun secret n’y figure',
  );
  rmSync(perso.dossier, { recursive: true, force: true });

  checkEqual(await page.pageErrors(), '[]', 'aucune erreur de page sur tout le parcours');
});
