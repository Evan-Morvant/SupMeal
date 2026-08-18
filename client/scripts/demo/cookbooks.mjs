import { PASSWORD, account, check, checkEqual, main, section } from './lib.mjs';

/**
 * Cookbooks partagés : création, recette rangée dedans, invitation, rôles et
 * commentaires. C'est ici que se vérifient les permissions par action.
 *
 * Usage : node scripts/demo/cookbooks.mjs
 */

const NOM = 'Cuisine de la demo ' + Date.now().toString(36);
const RECETTE = 'Gratin partagé ' + Date.now().toString(36);

async function signUp(page, nom) {
  await page.goto('/register');
  await page.waitFor('form');
  await page.fillByLabel('Nom affiché', nom);
  const email = account('cookbooks');
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
  section('Création du cookbook');
  const proprietaire = await signUp(page, 'Camille Roux');
  await page.goto('/cookbooks');
  await page.waitForText('main', 'Aucun cookbook');
  await page.shot('01-liste-vide');
  await page.clickText('button', 'Créer mon premier cookbook');
  await page.waitFor('dialog[open]');
  await page.fillByLabel('Nom', NOM);
  await page.fillByLabel('Description', 'Ce qu’on cuisine à la maison.');
  await page.clickText('dialog[open] button', 'Créer');
  await page.wait(1200);
  check((await page.text('main')).includes(NOM), 'le cookbook créé apparaît dans la liste');
  check((await page.text('main')).includes('Créateur'), 'son créateur en est le Créateur');

  section('Recette rangée dans le cookbook');
  await page.clickText('h2 a', NOM);
  await page.waitFor('nav a[aria-current="page"]');
  const chemin = await page.path();
  await page.waitForText('main', 'Ce cookbook est vide');
  await page.clickText('a', 'Nouvelle recette');
  await page.waitFor('form');
  await page.fillByLabel('Titre', RECETTE);
  await page.fill('[aria-label^="Nom de l"][aria-label$="1"]', 'pommes de terre');
  await page.fill('[aria-label="Étape 1"]', 'Enfourner 45 minutes.');
  await page.clickText('button[type="submit"]', 'Enregistrer la recette');
  await page.waitFor('h1');
  await page.wait(800);
  checkEqual(await page.text('h1'), RECETTE, 'la recette est créée directement dans le cookbook');
  const cheminRecette = await page.path();
  check(
    (await page.text('main')).includes('Commentaires'),
    'la recette vue du cookbook porte le fil du groupe',
  );

  section('Commentaire du créateur');
  await page.fill('[aria-label="Écrire un commentaire"]', 'Prévoir un plat plus grand.');
  await page.clickText('button', 'Commenter');
  await page.wait(1000);
  check(
    (await page.text('main')).includes('Prévoir un plat plus grand'),
    'le commentaire apparaît dans le fil',
  );
  await page.shot('02-recette-et-fil');

  section('Invitation');
  await page.goto(chemin + '/membres');
  await page.waitForText('main', 'Invitations');
  const invite = account('invite');
  await page.fillByLabel('Adresse e-mail', invite);
  await page.clickText('button', 'Inviter');
  await page.wait(1200);
  // Le lien est lu sur son propre element : le texte de la page colle le
  // libelle du bouton voisin juste apres le jeton.
  const lien = await page.text('code');
  check(lien.includes('/invitations/'), 'le lien d’acceptation est donné une fois, à copier');
  await page.shot('03-membres-et-invitation');

  section('Le lecteur rejoint');
  await signOut(page);
  // L'invitation ne vaut que pour l'adresse invitée : le compte doit être créé
  // avec celle-ci, sinon l'acceptation est refusée.
  await page.goto('/register');
  await page.waitFor('form');
  await page.fillByLabel('Nom affiché', 'Alex Petit');
  await page.fillByLabel('Adresse e-mail', invite);
  await page.fillByLabel('Mot de passe', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitFor('nav[aria-label="Navigation principale"]');

  await page.goto(new URL(lien).pathname);
  await page.waitForText('main', 'Rejoindre un cookbook');
  await page.clickText('button', "Accepter l'invitation");
  await page.wait(1400);
  check((await page.text('main')).includes(NOM), 'l’invitation acceptée donne accès au cookbook');
  check((await page.text('main')).includes('Lecteur'), 'le membre entre avec le rôle invité');

  section('Ce qu’un lecteur ne peut pas faire');
  await page.goto(cheminRecette);
  await page.waitForText('main', 'Commentaires');
  check(
    (await page.text('main')).includes('pas d’y écrire') ||
      (await page.text('main')).includes("pas d'y écrire"),
    'le Lecteur lit la discussion sans pouvoir y écrire',
  );
  check(
    !(await page.exists('[aria-label="Écrire un commentaire"]')),
    'aucun champ de commentaire ne lui est proposé',
  );
  check(
    !(await page.text('main')).includes('Retirer du cookbook'),
    'il ne peut pas retirer la recette du cookbook',
  );
  await page.goto(chemin + '/membres');
  await page.wait(900);
  check(
    !(await page.text('main')).includes('Invitations'),
    'la gestion des invitations reste au créateur',
  );
  await page.shot('04-vue-lecteur');

  section('Promotion et dernier créateur');
  await signOut(page);
  await signIn(page, proprietaire);
  await page.goto(chemin + '/membres');
  await page.waitForText('main', 'Alex Petit');
  await page.fill('[aria-label="Rôle de Alex Petit"]', 'COMMENTER');
  await page.wait(1200);

  // Se rétrograder soi-même alors qu'on est seul créateur doit être refusé.
  await page.fill('[aria-label="Rôle de Camille Roux"]', 'EDITOR');
  await page.wait(1200);
  check(
    (await page.text('main')).includes('Dernier créateur'),
    'le dernier créateur ne peut pas se rétrograder, et le message dit quoi faire',
  );
  await page.shot('05-dernier-createur');

  section('Le commentateur commente');
  await signOut(page);
  await signIn(page, invite);
  await page.goto(cheminRecette);
  await page.waitFor('[aria-label="Écrire un commentaire"]');
  await page.fill('[aria-label="Écrire un commentaire"]', 'J’ai doublé le fromage.');
  await page.clickText('button', 'Commenter');
  await page.wait(1000);
  check(
    (await page.text('main')).includes('doublé le fromage'),
    'promu Commentateur, le membre peut écrire dans le fil',
  );

  checkEqual(await page.pageErrors(), '[]', 'aucune erreur de page sur tout le parcours');
});
