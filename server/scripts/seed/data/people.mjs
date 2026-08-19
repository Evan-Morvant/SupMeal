/**
 * Les comptes du jeu de données, leurs cookbooks et qui appartient à quoi.
 *
 * Tous partagent le même mot de passe, écrit dans le README : le correcteur
 * doit pouvoir entrer par n'importe quelle porte et voir l'application sous
 * l'angle d'un créateur de cookbook comme sous celui d'un simple lecteur.
 *
 * `joursAvant` situe l'inscription dans le passé. Les dates réelles sont
 * réécrites après coup par `backdate.mjs` — l'API, elle, horodate au présent.
 */

export const MOT_DE_PASSE = 'Motdepasse123!';

export const PERSONNES = [
  {
    cle: 'camille',
    displayName: 'Camille Roux',
    email: 'camille.roux@supmeal.fr',
    joursAvant: 244,
    preferences: {
      diets: [],
      allergies: [],
      preferredCuisines: ['française', 'italienne'],
      defaultServings: 4,
    },
  },
  {
    cle: 'mehdi',
    displayName: 'Mehdi Benali',
    email: 'mehdi.benali@supmeal.fr',
    joursAvant: 231,
    preferences: {
      diets: [],
      allergies: ['fruits à coque'],
      preferredCuisines: ['marocaine', 'libanaise'],
      defaultServings: 6,
    },
  },
  {
    cle: 'lucie',
    displayName: 'Lucie Marchand',
    email: 'lucie.marchand@supmeal.fr',
    joursAvant: 218,
    preferences: {
      diets: ['végétarien'],
      allergies: [],
      preferredCuisines: ['française', 'indienne'],
      defaultServings: 2,
    },
  },
  {
    cle: 'thomas',
    displayName: 'Thomas Girard',
    email: 'thomas.girard@supmeal.fr',
    joursAvant: 196,
    preferences: {
      diets: [],
      allergies: [],
      preferredCuisines: ['italienne'],
      defaultServings: 2,
    },
  },
  {
    cle: 'awa',
    displayName: 'Awa Diallo',
    email: 'awa.diallo@supmeal.fr',
    joursAvant: 174,
    preferences: {
      diets: [],
      allergies: ['crustacés'],
      preferredCuisines: ['sénégalaise', 'libanaise'],
      defaultServings: 6,
    },
  },
  {
    cle: 'paul',
    displayName: 'Paul Lefèvre',
    email: 'paul.lefevre@supmeal.fr',
    joursAvant: 158,
    preferences: {
      diets: [],
      allergies: [],
      preferredCuisines: ['française'],
      defaultServings: 4,
    },
  },
  {
    cle: 'ines',
    displayName: 'Inès Fournier',
    email: 'ines.fournier@supmeal.fr',
    joursAvant: 133,
    preferences: {
      diets: ['végétarien'],
      allergies: ['lactose'],
      preferredCuisines: ['japonaise', 'mexicaine'],
      defaultServings: 2,
    },
  },
  {
    cle: 'hugo',
    displayName: 'Hugo Lemoine',
    email: 'hugo.lemoine@supmeal.fr',
    joursAvant: 121,
    preferences: {
      diets: [],
      allergies: [],
      preferredCuisines: ['thaïlandaise', 'japonaise'],
      defaultServings: 4,
    },
  },
  {
    cle: 'sarah',
    displayName: 'Sarah Cohen',
    email: 'sarah.cohen@supmeal.fr',
    joursAvant: 96,
    preferences: {
      diets: [],
      allergies: [],
      preferredCuisines: ['française'],
      defaultServings: 8,
    },
  },
  {
    cle: 'nadia',
    displayName: 'Nadia Bouchard',
    email: 'nadia.bouchard@supmeal.fr',
    joursAvant: 62,
    preferences: {
      diets: [],
      allergies: ['gluten'],
      preferredCuisines: ['grecque', 'italienne'],
      defaultServings: 4,
    },
  },
];

/**
 * Quatre cookbooks aux usages distincts : une famille, une colocation, un
 * atelier du dimanche, un cercle de pâtisserie. Les rôles y sont volontairement
 * mélangés — un cookbook où tout le monde est OWNER ne montre rien des
 * permissions.
 */
export const COOKBOOKS = [
  {
    cle: 'famille',
    name: 'Cuisine de famille',
    description: 'Les recettes qu’on se transmet, et celles qu’on essaie de reproduire.',
    owner: 'camille',
    joursAvant: 240,
    membres: [
      { personne: 'mehdi', role: 'EDITOR', joursAvant: 236 },
      { personne: 'paul', role: 'EDITOR', joursAvant: 150 },
      { personne: 'lucie', role: 'COMMENTER', joursAvant: 210 },
      { personne: 'thomas', role: 'READER', joursAvant: 188 },
    ],
  },
  {
    cle: 'coloc',
    name: 'Colocation Vaugirard',
    description: 'Qui cuisine quoi cette semaine, et la liste de courses qui va avec.',
    owner: 'hugo',
    joursAvant: 118,
    membres: [
      { personne: 'ines', role: 'EDITOR', joursAvant: 116 },
      { personne: 'awa', role: 'EDITOR', joursAvant: 112 },
      { personne: 'nadia', role: 'COMMENTER', joursAvant: 58 },
    ],
  },
  {
    cle: 'batch',
    name: 'Batch cooking du dimanche',
    description: 'Cinq plats en trois heures, pour tenir la semaine sans y penser.',
    owner: 'lucie',
    joursAvant: 165,
    membres: [
      { personne: 'camille', role: 'EDITOR', joursAvant: 162 },
      { personne: 'awa', role: 'EDITOR', joursAvant: 140 },
      { personne: 'ines', role: 'READER', joursAvant: 128 },
    ],
  },
  {
    cle: 'desserts',
    name: 'Desserts & pâtisserie',
    description: 'Les recettes qu’on pèse au gramme près.',
    owner: 'sarah',
    joursAvant: 92,
    membres: [
      { personne: 'thomas', role: 'EDITOR', joursAvant: 88 },
      { personne: 'camille', role: 'COMMENTER', joursAvant: 80 },
      { personne: 'nadia', role: 'READER', joursAvant: 55 },
    ],
  },
];

/**
 * Invitations laissées en attente : sans elles, l'écran des invitations est
 * vide et la fonctionnalité passe inaperçue. La première attend une réponse
 * d'un compte existant, la seconde une adresse encore inconnue.
 */
export const INVITATIONS_EN_ATTENTE = [
  { cookbook: 'famille', email: 'awa.diallo@supmeal.fr', role: 'COMMENTER', joursAvant: 6 },
  { cookbook: 'coloc', email: 'jules.petit@supmeal.fr', role: 'READER', joursAvant: 3 },
];
