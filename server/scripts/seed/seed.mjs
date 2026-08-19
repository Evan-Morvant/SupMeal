import 'dotenv/config';
import fs from 'fs';
import { API, call, sendFile } from '../demo/lib.mjs';
import { appliquerDates, effacerComptes, verifierAcces } from './backdate.mjs';
import { coverPng } from './cover.mjs';
import { COOKBOOKS, INVITATIONS_EN_ATTENTE, MOT_DE_PASSE, PERSONNES } from './data/people.mjs';
import { RECETTES } from './data/recipes.mjs';
import {
  AVIS,
  COMMENTAIRES,
  CONVERSATIONS,
  FAVORIS,
  LISTES_DE_COURSES,
  PLANNINGS,
} from './data/social.mjs';

/**
 * Peuplement de la base avec un jeu de données plausible.
 *
 * Ce script ne vérifie rien : c'est le rôle de `npm run demo`, qui joue des
 * scénarios et s'arrête au premier écart. Ici on remplit, pour qu'une instance
 * fraîchement montée ne s'ouvre pas sur des écrans vides — dix comptes, trente-
 * quatre recettes écrites en entier, quatre cookbooks, des avis, des
 * discussions, des plannings et des listes de courses en cours.
 *
 * Tout passe par l'API publique, sans raccourci par la base : le jeu de
 * données ne peut donc rien contenir qu'un utilisateur n'aurait pas pu créer
 * lui-même. Seule exception assumée, la passe finale de `backdate.mjs`, qui
 * recule les dates de création — l'API horodate au présent et n'offre aucun
 * moyen de dire « ceci a été écrit en février ».
 *
 * Usage : npm run seed
 *         SEED_RESET=1 npm run seed   (efface d'abord les comptes @supmeal.fr)
 */

const DOMAINE = 'supmeal.fr';

/** Extensions acceptées pour une photo fournie, avec leur type MIME. */
const TYPES_PHOTO = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const DATABASE_URL = process.env.DATABASE_URL;

const tokens = new Map();
const cookbooks = new Map();
const recettes = new Map();

/** Lignes dont la date de création sera reculée à la fin. */
const journal = [];

let ecrits = 0;

function titre(texte) {
  console.log('\n--- ' + texte);
}

function ligne(texte) {
  console.log('    ' + texte);
}

/** Instant situé dans le passé, à l'heure et à la minute voulues. */
function moment(joursAvant, heure = 12, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() - joursAvant);
  date.setHours(heure, minute, 0, 0);
  return date;
}

function horodater(table, id, date) {
  journal.push({ table, id, at: date.toISOString() });
}

/** Lundi de la semaine en cours, point d'origine de tous les plannings. */
function lundiCourant() {
  const date = new Date();
  const decalage = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - decalage);
  date.setHours(12, 0, 0, 0);
  return date;
}

/** Date d'un jour de planning : semaine relative, puis jour de 0 (lundi) à 6. */
function jourDePlanning(semaine, jour) {
  const date = lundiCourant();
  date.setDate(date.getDate() + semaine * 7 + jour);
  return date.toISOString().slice(0, 10);
}

/**
 * Illustration d'une recette. Une photo déposée dans `photos/` sous la clé de
 * la recette l'emporte ; sinon on peint la couverture. Le dossier peut donc se
 * remplir au fil du temps, sans que rien ne casse tant qu'il est incomplet.
 */
function illustration(recette) {
  for (const [extension, type] of Object.entries(TYPES_PHOTO)) {
    const chemin = new URL('photos/' + recette.cle + extension, import.meta.url);
    if (fs.existsSync(chemin)) {
      return { nom: recette.cle + extension, type, contenu: fs.readFileSync(chemin), photo: true };
    }
  }
  return {
    nom: recette.cle + '.png',
    type: 'image/png',
    contenu: coverPng(recette.titre),
    photo: false,
  };
}

function jeton(cle) {
  const token = tokens.get(cle);
  if (token === undefined) {
    throw new Error('Compte inconnu : ' + cle);
  }
  return token;
}

/**
 * Contrôle des dates avant la première écriture : un avis ne peut pas précéder
 * la recette qu'il note, ni un message le cookbook où il est écrit. Les
 * fichiers de données étant tenus à la main, cette incohérence-là passerait
 * inaperçue jusqu'à ce qu'un correcteur la lise à l'écran.
 */
function verifierChronologie() {
  const naissanceRecette = new Map(RECETTES.map((r) => [r.cle, r.joursAvant]));
  const naissanceCookbook = new Map(COOKBOOKS.map((c) => [c.cle, c.joursAvant]));

  const apres = (quoi, joursAvant, origine) => {
    if (joursAvant >= origine) {
      throw new Error(
        quoi + ' est daté de ' + joursAvant + ' jours, avant ce qu’il vise (' + origine + ').',
      );
    }
  };

  for (const avis of AVIS) {
    const quoi = 'L’avis de ' + avis.auteur + ' sur ' + avis.recette;
    apres(quoi, avis.joursAvant, naissanceRecette.get(avis.recette));
  }
  for (const commentaire of COMMENTAIRES) {
    apres(
      'Le commentaire de ' + commentaire.auteur + ' sur ' + commentaire.recette,
      commentaire.joursAvant,
      naissanceRecette.get(commentaire.recette),
    );
  }
  for (const conversation of CONVERSATIONS) {
    for (const salve of conversation.salves) {
      apres(
        'La discussion du ' + conversation.cookbook,
        salve.joursAvant,
        naissanceCookbook.get(conversation.cookbook),
      );
    }
  }
}

async function creerComptes() {
  titre('Comptes');
  for (const personne of PERSONNES) {
    const session = await call('POST', '/auth/register', {
      body: {
        email: personne.email,
        password: MOT_DE_PASSE,
        displayName: personne.displayName,
      },
    });
    const profil = await call('GET', '/auth/me', { token: session.accessToken });

    tokens.set(personne.cle, session.accessToken);
    horodater('users', profil.id, moment(personne.joursAvant, 9));

    await call('PUT', '/users/me/preferences', {
      token: session.accessToken,
      body: personne.preferences,
    });
    ecrits += 2;
  }
  ligne(PERSONNES.length + ' comptes, préférences culinaires comprises');
}

async function creerCookbooks() {
  titre('Cookbooks et membres');
  let membres = 0;

  for (const modele of COOKBOOKS) {
    const proprietaire = jeton(modele.owner);
    const cookbook = await call('POST', '/cookbooks', {
      token: proprietaire,
      body: { name: modele.name, description: modele.description },
    });
    cookbooks.set(modele.cle, cookbook.id);
    horodater('cookbooks', cookbook.id, moment(modele.joursAvant, 10));

    for (const membre of modele.membres) {
      const personne = PERSONNES.find((p) => p.cle === membre.personne);
      const invitation = await call('POST', '/cookbooks/' + cookbook.id + '/invitations', {
        token: proprietaire,
        body: { email: personne.email, role: membre.role },
      });
      await call('POST', '/invitations/' + invitation.token + '/accept', {
        token: jeton(membre.personne),
      });
      membres += 1;
    }
    ecrits += 1 + modele.membres.length * 2;
  }
  ligne(COOKBOOKS.length + ' cookbooks, ' + membres + ' membres invités puis entrés');
}

/**
 * Qui range la recette dans le cookbook : son auteur s'il en a le droit, le
 * créateur du cookbook sinon. La règle du serveur est la même dans les deux
 * cas — savoir lire la recette et pouvoir écrire dans le carnet.
 */
function rangeur(recette, cookbookCle) {
  const carnet = COOKBOOKS.find((c) => c.cle === cookbookCle);
  if (carnet.owner === recette.auteur) {
    return carnet.owner;
  }
  const membre = carnet.membres.find((m) => m.personne === recette.auteur);
  if (membre !== undefined && (membre.role === 'EDITOR' || membre.role === 'OWNER')) {
    return recette.auteur;
  }
  return carnet.owner;
}

async function creerRecettes() {
  titre('Recettes');
  let liaisons = 0;
  let photos = 0;

  for (const recette of RECETTES) {
    const token = jeton(recette.auteur);
    const creee = await call('POST', '/recipes', {
      token,
      body: {
        title: recette.titre,
        description: recette.description,
        prepTimeMin: recette.prepTimeMin,
        cookTimeMin: recette.cookTimeMin,
        servings: recette.servings,
        source: recette.source,
        visibility: recette.visibility,
        tags: recette.tags,
        ingredients: recette.ingredients,
        steps: recette.steps,
      },
    });
    recettes.set(recette.cle, creee.id);
    horodater('recipes', creee.id, moment(recette.joursAvant, 18, (recette.joursAvant * 7) % 60));

    const image = illustration(recette);
    await sendFile('/recipes/' + creee.id + '/image', {
      token,
      filename: image.nom,
      contentType: image.type,
      content: image.contenu,
    });
    if (image.photo) {
      photos += 1;
    }

    for (const cookbookCle of recette.cookbooks) {
      await call('PUT', '/cookbooks/' + cookbooks.get(cookbookCle) + '/recipes/' + creee.id, {
        token: jeton(rangeur(recette, cookbookCle)),
      });
      liaisons += 1;
    }
    ecrits += 2 + recette.cookbooks.length;
  }

  const publiques = RECETTES.filter((r) => r.visibility === 'public').length;
  ligne(RECETTES.length + ' recettes dont ' + publiques + ' publiques');
  const peintes = RECETTES.length - photos;
  ligne(photos + ' photos fournies' + (peintes === 0 ? '' : ', ' + peintes + ' couvertures peintes'));
  ligne(liaisons + ' rangements dans un cookbook');
}

async function ajouterFavoris() {
  titre('Favoris');
  let total = 0;
  for (const [personne, cles] of Object.entries(FAVORIS)) {
    for (const cle of cles) {
      await call('POST', '/recipes/' + recettes.get(cle) + '/favorite', {
        token: jeton(personne),
      });
      total += 1;
    }
  }
  ecrits += total;
  ligne(total + ' recettes mises de côté');
}

async function deposerAvis() {
  titre('Avis publics');
  for (const avis of AVIS) {
    const depose = await call('PUT', '/recipes/' + recettes.get(avis.recette) + '/reviews', {
      token: jeton(avis.auteur),
      body: { rating: avis.rating, body: avis.body },
    });
    horodater('reviews', depose.id, moment(avis.joursAvant, 21, (avis.joursAvant * 13) % 60));
  }
  ecrits += AVIS.length;

  const moyenne = AVIS.reduce((somme, avis) => somme + avis.rating, 0) / AVIS.length;
  ligne(AVIS.length + ' avis, note moyenne ' + moyenne.toFixed(2));
}

async function ecrireCommentaires() {
  titre('Commentaires de cookbook');
  for (const commentaire of COMMENTAIRES) {
    const chemin =
      '/cookbooks/' +
      cookbooks.get(commentaire.cookbook) +
      '/recipes/' +
      recettes.get(commentaire.recette) +
      '/comments';
    const ecrit = await call('POST', chemin, {
      token: jeton(commentaire.auteur),
      body: { content: commentaire.content },
    });
    horodater(
      'comments',
      ecrit.id,
      moment(commentaire.joursAvant, 19, (commentaire.joursAvant * 17) % 60),
    );
  }
  ecrits += COMMENTAIRES.length;
  ligne(COMMENTAIRES.length + ' commentaires, visibles des seuls membres');
}

async function ecrireDiscussions() {
  titre('Discussions');
  let total = 0;

  for (const conversation of CONVERSATIONS) {
    const cookbookId = cookbooks.get(conversation.cookbook);
    for (const salve of conversation.salves) {
      let minute = 0;
      for (const [auteur, contenu] of salve.echanges) {
        const message = await call('POST', '/cookbooks/' + cookbookId + '/messages', {
          token: jeton(auteur),
          body: { content: contenu },
        });
        horodater('messages', message.id, moment(salve.joursAvant, salve.heure, minute));
        // Deux à quatre minutes entre deux répliques : le rythme d'une
        // conversation, pas celui d'une boucle.
        minute += 2 + (contenu.length % 3);
        total += 1;
      }
    }
  }
  ecrits += total;
  ligne(total + ' messages répartis en salves de conversation');
}

async function remplirPlannings() {
  titre('Plannings');
  let total = 0;

  for (const planning of PLANNINGS) {
    const auteur = planning.auteur ?? planning.personne;
    const cookbookId =
      planning.cookbook === undefined ? undefined : cookbooks.get(planning.cookbook);

    for (const entree of planning.entrees) {
      await call('POST', '/meal-plan', {
        token: jeton(auteur),
        body: {
          recipeId: recettes.get(entree.recette),
          cookbookId,
          date: jourDePlanning(entree.semaine, entree.jour),
          mealType: entree.mealType,
          servings: entree.servings,
        },
      });
      total += 1;
    }
  }
  ecrits += total;
  ligne(total + ' repas planifiés, de la semaine dernière à la suivante');
}

async function genererListes() {
  titre('Listes de courses');
  let coches = 0;

  for (const modele of LISTES_DE_COURSES) {
    const token = jeton(modele.personne);
    const liste = await call('POST', '/shopping-lists', {
      token,
      body: {
        fromDate: jourDePlanning(modele.semaine, modele.duJour),
        toDate: jourDePlanning(modele.semaine, modele.auJour),
      },
    });
    horodater('shopping_lists', liste.id, moment(-modele.semaine * 7, 11));

    const aCocher = Math.round(liste.items.length * modele.coche);
    for (const item of liste.items.slice(0, aCocher)) {
      await call('PATCH', '/shopping-lists/' + liste.id + '/items/' + item.id, {
        token,
        body: { checked: true },
      });
      coches += 1;
    }
    ecrits += 1 + aCocher;
  }
  ligne(LISTES_DE_COURSES.length + ' listes engendrées, ' + coches + ' lignes déjà rayées');
}

async function laisserDesInvitations() {
  titre('Invitations en attente');
  for (const invitation of INVITATIONS_EN_ATTENTE) {
    const carnet = COOKBOOKS.find((c) => c.cle === invitation.cookbook);
    const chemin = '/cookbooks/' + cookbooks.get(invitation.cookbook) + '/invitations';
    const envoyee = await call('POST', chemin, {
      token: jeton(carnet.owner),
      body: { email: invitation.email, role: invitation.role },
    });
    horodater('cookbook_invitations', envoyee.id, moment(invitation.joursAvant, 15));
  }
  ecrits += INVITATIONS_EN_ATTENTE.length;
  ligne(INVITATIONS_EN_ATTENTE.length + ' invitations laissées sans réponse');
}

async function reculerLesDates() {
  if (DATABASE_URL === undefined) {
    return;
  }
  titre('Horodatages');
  await appliquerDates(DATABASE_URL, journal, (table, lignes) => {
    ligne(lignes + ' lignes reculées dans ' + table);
  });
}

async function reinitialiser() {
  if (process.env.SEED_RESET !== '1') {
    return;
  }
  if (DATABASE_URL === undefined) {
    throw new Error('SEED_RESET demande DATABASE_URL pour retrouver les comptes à effacer.');
  }
  titre('Remise à zéro');
  await effacerComptes(DATABASE_URL, DOMAINE, (nombre) => {
    ligne(nombre + ' comptes @' + DOMAINE + ' effacés, avec tout ce qui en dépendait');
  });
}

/**
 * L'accès direct sert deux fois — la remise à zéro et les horodatages — et se
 * vérifie donc avant tout le reste. `DATABASE_URL` doit désigner la base de
 * l'API visée, pas une autre : en Docker, celle publiée sur 5433.
 */
async function verifierAccesBase() {
  if (DATABASE_URL === undefined) {
    ligne('DATABASE_URL absente : les dates de création resteront celles d’aujourd’hui.');
    return;
  }
  try {
    await verifierAcces(DATABASE_URL);
  } catch (err) {
    throw new Error(
      'Base injoignable avec DATABASE_URL.\n' +
        '      Elle doit désigner la base derrière ' + API + '.\n' +
        '      Détail : ' + err.message,
    );
  }
}

/**
 * Le jeu de données est-il déjà là ? Ce n'est pas une erreur : le service
 * `seed` du compose est rejoué à chaque `docker compose up`, et une pile qui
 * remonte ne doit pas signaler un échec parce que le travail est déjà fait.
 *
 * On interroge le catalogue public plutôt que d'essayer une connexion : le mot
 * de passe d'un compte peut très bien avoir été changé depuis l'application,
 * le titre d'une recette publique, non.
 */
async function dejaPeuplee() {
  const temoin = RECETTES.find((recette) => recette.visibility === 'public');
  const trouvees = await call('GET', '/discover/recipes', { query: { q: temoin.titre } });
  return trouvees.items.some((item) => item.title === temoin.titre);
}

async function main() {
  const debut = Date.now();
  console.log('Peuplement de ' + API);

  try {
    await call('GET', '/health');
  } catch (err) {
    console.error(
      '\nAPI injoignable sur ' +
        API +
        '\n      Lancez « npm run dev », ou pointez ailleurs avec API_URL.\n      Détail : ' +
        err.message,
    );
    process.exitCode = 1;
    return;
  }

  try {
    verifierChronologie();
    await verifierAccesBase();
    await reinitialiser();
    if (await dejaPeuplee()) {
      console.log(
        '\nLa base contient déjà ce jeu de données, rien à faire.' +
          '\nPour le rejouer à neuf, relancer avec SEED_RESET=1.',
      );
      return;
    }
    await creerComptes();
    await creerCookbooks();
    await creerRecettes();
    await ajouterFavoris();
    await deposerAvis();
    await ecrireCommentaires();
    await ecrireDiscussions();
    await remplirPlannings();
    await genererListes();
    await laisserDesInvitations();
    await reculerLesDates();
  } catch (err) {
    console.error('\nPeuplement interrompu : ' + err.message);
    process.exitCode = 1;
    return;
  }

  const secondes = ((Date.now() - debut) / 1000).toFixed(1);
  console.log('\n' + ecrits + ' écritures en ' + secondes + ' s.');
  console.log('Entrez avec ' + PERSONNES[0].email + ' / ' + MOT_DE_PASSE + '.');
}

await main();
