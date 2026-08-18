import { PASSWORD, account, check, checkEqual, main, section } from './lib.mjs';

/**
 * Messagerie de cookbook, éprouvée avec **deux sessions simultanées** : chaque
 * page vit dans son propre contexte de navigation, donc son propre compte.
 *
 * C'est le seul montage qui prouve la diffusion temps réel, et le seul qui
 * reproduise le trou laissé par un passage sur un autre onglet.
 *
 * Usage : node scripts/demo/messagerie.mjs
 */

const NOM = 'Salon de la demo ' + Date.now().toString(36);

async function signUp(page, nom, email) {
  await page.goto('/register');
  await page.waitFor('form');
  await page.fillByLabel('Nom affiché', nom);
  await page.fillByLabel('Adresse e-mail', email);
  await page.fillByLabel('Mot de passe', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitFor('nav[aria-label="Navigation principale"]');
}

async function envoyer(page, texte) {
  await page.fill('[aria-label="Écrire un message"]', texte);
  await page.clickText('button', 'Envoyer');
}

main(async (chef) => {
  section('Cookbook et invitations');
  await signUp(chef, 'Camille Roux', account('salon'));
  await chef.goto('/cookbooks');
  await chef.waitForText('main', 'Aucun cookbook');
  await chef.clickText('button', 'Créer mon premier cookbook');
  await chef.waitFor('dialog[open]');
  await chef.fillByLabel('Nom', NOM);
  await chef.clickText('dialog[open] button', 'Créer');
  await chef.wait(1200);
  await chef.clickText('h2 a', NOM);
  await chef.waitFor('nav a[aria-current="page"]');
  const chemin = await chef.path();

  const commentateur = account('commentateur');
  const lecteur = account('lecteur');
  await chef.goto(chemin + '/membres');
  await chef.waitForText('main', 'Invitations');
  await chef.fillByLabel('Adresse e-mail', commentateur);
  await chef.fillByLabel('Rôle', 'COMMENTER');
  await chef.clickText('button', 'Inviter');
  await chef.wait(1200);
  const lienCommentateur = await chef.text('code');

  await chef.fillByLabel('Adresse e-mail', lecteur);
  await chef.fillByLabel('Rôle', 'READER');
  await chef.clickText('button', 'Inviter');
  await chef.wait(1200);
  const lienLecteur = await chef.text('code');
  check(lienCommentateur !== lienLecteur, 'chaque invitation porte son propre lien');

  section('Deux membres dans le salon');
  const membre = await chef.fork();
  await signUp(membre, 'Alex Petit', commentateur);
  await membre.goto(new URL(lienCommentateur).pathname);
  await membre.waitForText('main', 'Rejoindre un cookbook');
  await membre.clickText('button', "Accepter l'invitation");
  await membre.wait(1400);

  await chef.goto(chemin + '/discussion');
  await chef.waitForText('main', 'En direct');
  await membre.goto(chemin + '/discussion');
  await membre.waitForText('main', 'En direct');
  check(
    (await membre.text('main')).includes("Rien n'a encore été dit"),
    'un salon vide invite à lancer la conversation',
  );
  await chef.shot('01-salon-vide');

  section('Diffusion en direct');
  await envoyer(chef, 'On se cale sur samedi midi ?');
  // Aucune navigation côté membre : le message ne peut arriver que par le salon.
  await membre.waitForText('main', 'samedi midi');
  check(
    (await membre.text('main')).includes('Camille Roux'),
    'le message d’un membre parvient à l’autre sans rechargement',
  );
  await envoyer(membre, 'Parfait pour moi.');
  await chef.waitForText('main', 'Parfait pour moi');
  check(
    (await chef.text('main')).includes('Alex Petit'),
    'la diffusion fonctionne dans les deux sens, auteur compris',
  );
  await chef.shot('02-salon-actif');

  section('Retour d’un autre onglet du cookbook');
  /*
   * Le cas signalé : quitter la Discussion pour un autre onglet ferme le salon.
   * Ce qui s'y dit pendant ce temps n'arrive par aucun socket — seule une
   * relecture de l'historique au retour peut le rattraper.
   */
  // Onglets **cliqués**, pas rechargés : une navigation complète viderait le
  // cache et masquerait justement le défaut qu'on cherche à éprouver.
  await membre.clickText('nav[aria-label="Sections du cookbook"] a', 'Membres');
  await membre.waitForText('main', 'Chaque membre a exactement un rôle');
  await envoyer(chef, 'Je m’occupe du dessert.');
  await chef.waitForText('main', 'dessert');

  // Le socket reste ouvert sur les autres onglets : la pastille compte.
  await membre.wait(800);
  checkEqual(
    await membre.text('nav[aria-label="Sections du cookbook"] span[class*="badge"]'),
    '1',
    'une pastille annonce le message reçu depuis un autre onglet',
  );
  await membre.shot('03-pastille');

  await membre.clickText('nav[aria-label="Sections du cookbook"] a', 'Discussion');
  await membre.waitFor('[aria-label="Écrire un message"]');
  await membre.wait(1000);
  check(
    (await membre.text('main')).includes('Je m’occupe du dessert'),
    'les messages dits pendant l’absence apparaissent au retour dans le salon',
  );
  checkEqual(
    await membre.text('nav[aria-label="Sections du cookbook"] span[class*="badge"]'),
    '',
    'la pastille s’efface une fois le salon rouvert',
  );
  const fil = await membre.text('main');
  check(
    fil.indexOf('samedi midi') < fil.indexOf('Parfait pour moi') &&
      fil.indexOf('Parfait pour moi') < fil.indexOf('dessert'),
    'le fil reste dans l’ordre de lecture après ce rattrapage',
  );
  await membre.shot('04-retour-onglet');

  section('Le lecteur reste à la porte');
  const spectateur = await chef.fork();
  await signUp(spectateur, 'Dominique Blanc', lecteur);
  await spectateur.goto(new URL(lienLecteur).pathname);
  await spectateur.waitForText('main', 'Rejoindre un cookbook');
  await spectateur.clickText('button', "Accepter l'invitation");
  await spectateur.wait(1400);
  await spectateur.goto(chemin);
  await spectateur.waitForText('main', 'Membres');
  check(
    !(await spectateur.text('nav[aria-label="Sections du cookbook"]')).includes('Discussion'),
    'le Lecteur ne se voit pas proposer le salon',
  );
  await spectateur.shot('05-vue-lecteur');

  checkEqual(await chef.pageErrors(), '[]', 'aucune erreur de page côté créateur');
  checkEqual(await membre.pageErrors(), '[]', 'aucune erreur de page côté membre');
});
