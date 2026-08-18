/**
 * Ce que les comptes se disent : avis publics, commentaires de cookbook,
 * discussions, favoris et plannings.
 *
 * Les rôles sont respectés à la lettre — un READER ne commente pas et n'écrit
 * pas dans le salon. Le jeu de données ne doit rien contenir que l'application
 * elle-même refuserait.
 *
 * Un avis ne porte que sur une recette publique, et jamais sur la sienne :
 * l'API oppose un 403 dans les deux cas.
 */

export const AVIS = [
  { recette: 'blanquette', auteur: 'thomas', rating: 5, body: 'Refaite deux fois ce mois-ci. L’écumage au début change vraiment la couleur de la sauce.', joursAvant: 190 },
  { recette: 'blanquette', auteur: 'lucie', rating: 4, body: 'Très bon, mais j’ai réduit la crème de moitié et personne n’a rien remarqué.', joursAvant: 151 },
  { recette: 'blanquette', auteur: 'nadia', rating: 5, body: 'Le genre de plat qui fait parler tout le monde en même temps.', joursAvant: 44 },
  { recette: 'tatin', auteur: 'camille', rating: 5, body: 'Le caramel à sec me faisait peur, en fait c’est l’étape la plus simple.', joursAvant: 72 },
  { recette: 'tatin', auteur: 'thomas', rating: 4, body: 'Attention au démoulage : mon plat était trop petit, j’ai perdu la moitié du caramel.', joursAvant: 61 },
  { recette: 'tatin', auteur: 'hugo', rating: 5, body: 'Faite pour huit, il n’en restait rien.', joursAvant: 30 },
  { recette: 'ratatouille', auteur: 'camille', rating: 5, body: 'Cuire les légumes séparément demande une heure de plus et vaut chaque minute.', joursAvant: 176 },
  { recette: 'ratatouille', auteur: 'paul', rating: 4, body: 'Meilleure le lendemain, comme souvent.', joursAvant: 120 },
  { recette: 'ratatouille', auteur: 'ines', rating: 5, body: 'Je la fais en grande quantité le dimanche, elle tient toute la semaine.', joursAvant: 88 },
  { recette: 'couscous', auteur: 'camille', rating: 5, body: 'Le bouillon à part, c’est le détail qui fait la différence à table.', joursAvant: 201 },
  { recette: 'couscous', auteur: 'awa', rating: 5, body: 'Trois passages à la vapeur, pas deux. On sent la différence sur la semoule.', joursAvant: 140 },
  { recette: 'couscous', auteur: 'sarah', rating: 4, body: 'Un peu long pour un soir de semaine, parfait pour un dimanche.', joursAvant: 70 },
  { recette: 'risotto', auteur: 'ines', rating: 5, body: 'Le bouillon doit vraiment rester frémissant, sinon la cuisson s’arrête à chaque louche.', joursAvant: 130 },
  { recette: 'risotto', auteur: 'hugo', rating: 4, body: 'J’ai mis des cèpes séchés réhydratés, avec leur eau de trempage dans le bouillon.', joursAvant: 96 },
  { recette: 'padthai', auteur: 'ines', rating: 5, body: 'Tout préparer avant est vraiment obligatoire, la cuisson prend quatre minutes.', joursAvant: 100 },
  { recette: 'padthai', auteur: 'nadia', rating: 4, body: 'Le tamarin n’est pas facile à trouver, mais rien ne le remplace.', joursAvant: 42 },
  { recette: 'chili', auteur: 'hugo', rating: 5, body: 'Le carré de chocolat à la fin, je n’y croyais pas. J’avais tort.', joursAvant: 110 },
  { recette: 'chili', auteur: 'awa', rating: 4, body: 'J’ajoute une patate douce en dés, ça équilibre le piquant.', joursAvant: 76 },
  { recette: 'potimarron', auteur: 'thomas', rating: 5, body: 'Vingt minutes montre en main, et la peau non épluchée ne se sent pas du tout.', joursAvant: 144 },
  { recette: 'potimarron', auteur: 'nadia', rating: 5, body: 'Les graines torréfiées font toute la texture. Ne pas les sauter.', joursAvant: 38 },
  { recette: 'gratin', auteur: 'paul', rating: 5, body: 'Sans fromage, vraiment. C’est meilleur et ça reste crémeux.', joursAvant: 150 },
  { recette: 'gratin', auteur: 'sarah', rating: 4, body: 'Une heure trente au total chez moi, mon four chauffe mal.', joursAvant: 66 },
  { recette: 'yassa', auteur: 'mehdi', rating: 5, body: 'Six oignons, ce n’est pas une erreur de frappe. Ils fondent entièrement.', joursAvant: 155 },
  { recette: 'yassa', auteur: 'camille', rating: 5, body: 'Marinade de la veille, cuisson le soir : c’est devenu notre plat du vendredi.', joursAvant: 92 },
  { recette: 'lasagnes', auteur: 'thomas', rating: 5, body: 'Le lait dans la bolognaise avant les tomates, c’est ce qui l’adoucit.', joursAvant: 130 },
  { recette: 'lasagnes', auteur: 'hugo', rating: 4, body: 'Six couches, c’est ambitieux dans un plat normal. J’en ai fait quatre.', joursAvant: 58 },
  { recette: 'tajine', auteur: 'lucie', rating: 4, body: 'Très bon, j’ai remplacé l’agneau par des pois chiches et des patates douces.', joursAvant: 170 },
  { recette: 'tajine', auteur: 'sarah', rating: 5, body: 'Les amandes dorées à la fin, c’est ce qui fait le plat.', joursAvant: 74 },
  { recette: 'quiche', auteur: 'nadia', rating: 4, body: 'Précuire la pâte évite le fond détrempé, je ne le faisais jamais avant.', joursAvant: 48 },
  { recette: 'quiche', auteur: 'awa', rating: 5, body: 'Simple et jamais raté. J’en fais deux, une pour le lendemain.', joursAvant: 118 },
  { recette: 'bourguignon', auteur: 'camille', rating: 5, body: 'Sécher la viande avant de la saisir : sinon elle bout au lieu de colorer.', joursAvant: 124 },
  { recette: 'bourguignon', auteur: 'mehdi', rating: 5, body: 'Trois heures au four à 150 °C, c’est beaucoup plus régulier que sur le feu.', joursAvant: 90 },
  { recette: 'dahl', auteur: 'lucie', rating: 5, body: 'Mon plat de fin de mois. Vingt-cinq minutes et rien à acheter de frais.', joursAvant: 104 },
  { recette: 'dahl', auteur: 'thomas', rating: 5, body: 'Faire chanter les épices avant d’ajouter le liquide, ça n’a rien d’anecdotique.', joursAvant: 80 },
  { recette: 'dahl', auteur: 'sarah', rating: 4, body: 'Un peu liquide à mon goût, j’ai laissé réduire cinq minutes de plus.', joursAvant: 36 },
  { recette: 'falafels', auteur: 'ines', rating: 5, body: 'Au four et pas frits, on ne perd presque rien et la cuisine ne sent pas l’huile.', joursAvant: 86 },
  { recette: 'falafels', auteur: 'hugo', rating: 4, body: 'Bien penser à tremper les pois chiches la veille, sinon la recette tombe à l’eau.', joursAvant: 54 },
  { recette: 'gnocchis', auteur: 'nadia', rating: 5, body: 'Vingt minutes chrono un soir de semaine, avec le gril à la fin.', joursAvant: 40 },
  { recette: 'moussaka', auteur: 'camille', rating: 4, body: 'Les aubergines au four plutôt qu’à la poêle : bonne idée, beaucoup moins gras.', joursAvant: 14 },
  { recette: 'moussaka', auteur: 'mehdi', rating: 5, body: 'La cannelle en petite quantité, c’est ce qui la distingue d’un gratin d’aubergines.', joursAvant: 11 },
  { recette: 'citron', auteur: 'camille', rating: 5, body: 'La meringue italienne tient deux jours au frais sans rendre d’eau, confirmé.', joursAvant: 62 },
  { recette: 'citron', auteur: 'nadia', rating: 5, body: 'Le sirop à 118 °C demande un thermomètre, il n’y a pas de raccourci.', joursAvant: 26 },
  { recette: 'fondant', auteur: 'thomas', rating: 5, body: 'Onze minutes, effectivement. À douze c’est un gâteau au chocolat.', joursAvant: 64 },
  { recette: 'fondant', auteur: 'ines', rating: 5, body: 'Le passage au frais avant cuisson aide beaucoup au démoulage.', joursAvant: 45 },
  { recette: 'cookies', auteur: 'sarah', rating: 5, body: 'Les 24 heures de repos, c’est la seule chose qui sépare un bon cookie du reste.', joursAvant: 10 },
  { recette: 'cookies', auteur: 'hugo', rating: 4, body: 'Chocolat concassé au couteau plutôt que des pépites, très bon conseil.', joursAvant: 7 },
  { recette: 'crepes', auteur: 'lucie', rating: 5, body: 'La pâte au repos une heure, et la première crêpe pour le cuisinier. Tradition.', joursAvant: 120 },
  { recette: 'levain', auteur: 'paul', rating: 5, body: 'La cuisson en cocotte fermée donne une croûte qu’on n’obtient pas autrement.', joursAvant: 100 },
  { recette: 'levain', auteur: 'sarah', rating: 4, body: 'Bien expliqué. La nuit au frais rend le façonnage beaucoup plus facile.', joursAvant: 50 },
  { recette: 'petitspois', auteur: 'ines', rating: 5, body: 'Huit minutes de cuisson seulement, la couleur reste franchement verte.', joursAvant: 110 },
  { recette: 'houmous', auteur: 'lucie', rating: 5, body: 'Retirer les peaux prend dix minutes et donne une texture incomparable.', joursAvant: 82 },
  { recette: 'houmous', auteur: 'nadia', rating: 5, body: 'Les glaçons dans le mixeur, je note. Ça monte beaucoup mieux.', joursAvant: 24 },
  { recette: 'tiramisu', auteur: 'sarah', rating: 4, body: 'Sans crème liquide, c’est plus dense mais tellement plus franc.', joursAvant: 4 },
  { recette: 'tiramisu', auteur: 'camille', rating: 5, body: 'Une seconde par face dans le café, pas deux. Sinon c’est une soupe.', joursAvant: 2 },
  { recette: 'pokebowl', auteur: 'awa', rating: 4, body: 'Bon et rapide. Je remplace le saumon cru par du saumon grillé pour les enfants.', joursAvant: 50 },
  { recette: 'omelette', auteur: 'paul', rating: 5, body: 'Une omelette de trois lignes, c’est exactement ce qu’il fallait.', joursAvant: 41 },
  { recette: 'limonade', auteur: 'hugo', rating: 5, body: 'Le sirop tient deux semaines, on s’en sert tous les soirs depuis.', joursAvant: 1 },
];

/**
 * Commentaires attachés à une recette dans un cookbook. Ils ne sortent jamais
 * du groupe : c'est ce qui les distingue des avis.
 */
export const COMMENTAIRES = [
  { cookbook: 'famille', recette: 'blanquette', auteur: 'lucie', content: 'Maman mettait un peu de vin blanc dans le bouillon, je crois.', joursAvant: 180 },
  { cookbook: 'famille', recette: 'blanquette', auteur: 'camille', content: 'Bien vu, j’essaie dimanche et je note la quantité si ça marche.', joursAvant: 179 },
  { cookbook: 'famille', recette: 'blanquette', auteur: 'mehdi', content: 'Testé avec 10 cl : c’est mieux, mais il faut laisser réduire plus longtemps.', joursAvant: 172 },
  { cookbook: 'famille', recette: 'couscous', auteur: 'camille', content: 'On la garde pour le 15, on sera dix. Je double les pois chiches.', joursAvant: 60 },
  { cookbook: 'famille', recette: 'couscous', auteur: 'paul', content: 'Je m’occupe des merguez et du pain.', joursAvant: 59 },
  { cookbook: 'famille', recette: 'gratin', auteur: 'lucie', content: 'Pas de fromage sur un dauphinois, merci de le rappeler noir sur blanc.', joursAvant: 150 },
  { cookbook: 'famille', recette: 'gratin', auteur: 'mehdi', content: 'Pocher les tranches dans la crème avant, c’est la seule façon d’avoir une cuisson égale.', joursAvant: 148 },
  { cookbook: 'famille', recette: 'yassa', auteur: 'camille', content: 'Awa nous a donné la recette de sa grand-mère, je l’ai recopiée telle quelle.', joursAvant: 166 },
  { cookbook: 'famille', recette: 'bourguignon', auteur: 'paul', content: 'J’ai augmenté à trois heures de cuisson, le paleron était encore ferme à deux.', joursAvant: 134 },
  { cookbook: 'famille', recette: 'quiche', auteur: 'lucie', content: 'Version sans lardons pour moi : des poireaux fondus, ça marche très bien.', joursAvant: 96 },
  { cookbook: 'famille', recette: 'rotiporc', auteur: 'mehdi', content: 'Les restes en sandwich le lendemain, avec la moutarde du plat.', joursAvant: 55 },
  { cookbook: 'coloc', recette: 'padthai', auteur: 'ines', content: 'Il reste de la sauce de poisson dans le placard du haut.', joursAvant: 96 },
  { cookbook: 'coloc', recette: 'padthai', auteur: 'hugo', content: 'Parfait, je fais les courses pour le reste demain midi.', joursAvant: 95 },
  { cookbook: 'coloc', recette: 'chili', auteur: 'awa', content: 'On double les quantités, ça fait les gamelles de mardi et mercredi.', joursAvant: 88 },
  { cookbook: 'coloc', recette: 'chili', auteur: 'nadia', content: 'Sans gluten par défaut, ça m’arrange beaucoup.', joursAvant: 50 },
  { cookbook: 'coloc', recette: 'falafels', auteur: 'hugo', content: 'Pensez à mettre les pois chiches à tremper la veille au soir.', joursAvant: 84 },
  { cookbook: 'coloc', recette: 'houmous', auteur: 'ines', content: 'Le tahini du magasin d’en bas est bien meilleur que celui du supermarché.', joursAvant: 70 },
  { cookbook: 'coloc', recette: 'ramen', auteur: 'awa', content: 'Quatre heures de bouillon un dimanche, c’est jouable si on s’y met à deux.', joursAvant: 66 },
  { cookbook: 'coloc', recette: 'ramen', auteur: 'hugo', content: 'Les œufs doivent mariner une nuit, on les prépare la veille.', joursAvant: 65 },
  { cookbook: 'coloc', recette: 'pokebowl', auteur: 'nadia', content: 'Le riz doit être froid, sinon l’avocat noircit tout de suite.', joursAvant: 44 },
  { cookbook: 'batch', recette: 'ratatouille', auteur: 'camille', content: 'Trois bocaux d’un litre pour la semaine, ça tient sans problème.', joursAvant: 140 },
  { cookbook: 'batch', recette: 'ratatouille', auteur: 'awa', content: 'Je la congèle en portions, elle ne perd rien à la décongélation.', joursAvant: 128 },
  { cookbook: 'batch', recette: 'chili', auteur: 'lucie', content: 'Le plus rentable de la liste : une casserole, cinq gamelles.', joursAvant: 112 },
  { cookbook: 'batch', recette: 'dahl', auteur: 'camille', content: 'On peut le faire pendant que la ratatouille confit, même plan de travail.', joursAvant: 102 },
  { cookbook: 'batch', recette: 'potimarron', auteur: 'awa', content: 'La soupe se garde quatre jours au frais, pas plus avec le lait de coco.', joursAvant: 90 },
  { cookbook: 'batch', recette: 'petitspois', auteur: 'lucie', content: 'Version froide en été, version chaude en hiver, même recette.', joursAvant: 76 },
  { cookbook: 'desserts', recette: 'tatin', auteur: 'thomas', content: 'Quel moule utilises-tu ? Le mien colle systématiquement.', joursAvant: 68 },
  { cookbook: 'desserts', recette: 'tatin', auteur: 'sarah', content: 'Un moule à Tatin en cuivre, mais une poêle en fonte fait le travail.', joursAvant: 67 },
  { cookbook: 'desserts', recette: 'citron', auteur: 'camille', content: 'La meringue italienne demande un thermomètre, il faut le dire aux débutants.', joursAvant: 58 },
  { cookbook: 'desserts', recette: 'citron', auteur: 'sarah', content: 'Ajouté dans la description. Merci, c’était vraiment un manque.', joursAvant: 57 },
  { cookbook: 'desserts', recette: 'fondant', auteur: 'thomas', content: 'Onze minutes dans mon four c’était encore trop liquide. Douze chez moi.', joursAvant: 46 },
  { cookbook: 'desserts', recette: 'cookies', auteur: 'camille', content: 'La fleur de sel à la sortie du four, c’est ce que je retiens.', joursAvant: 8 },
  { cookbook: 'desserts', recette: 'brioche', auteur: 'thomas', content: 'Le beurre froid en trois fois, c’est là que je me plantais depuis des années.', joursAvant: 7 },
];

/**
 * Discussions des cookbooks, par salves : une conversation se tient un soir,
 * pas une phrase toutes les six heures. `joursAvant` situe la salve, les
 * messages s'y suivent de quelques minutes.
 */
export const CONVERSATIONS = [
  {
    cookbook: 'famille',
    salves: [
      {
        joursAvant: 62,
        heure: 20,
        echanges: [
          ['camille', 'On fait le couscous pour le 15 ? On sera dix avec les cousins.'],
          ['mehdi', 'Oui. Je m’occupe de la viande, il m’en faut un bon kilo et demi.'],
          ['paul', 'Je prends les merguez et le pain.'],
          ['camille', 'Parfait. Lucie, tu peux faire une version sans viande à côté ?'],
          ['lucie', 'Oui, je fais un tajine de légumes pour quatre, ça ira largement.'],
        ],
      },
      {
        joursAvant: 16,
        heure: 12,
        echanges: [
          ['mehdi', 'J’ai ajouté le tajine aux pruneaux dans le cookbook, il est relu.'],
          ['camille', 'Vu, merci. Je l’ai mis au planning de jeudi.'],
          ['lucie', 'J’ai relu la blanquette hier soir, je la teste ce week-end.'],
        ],
      },
      {
        joursAvant: 3,
        heure: 19,
        echanges: [
          ['camille', 'Quelqu’un se souvient de la quantité de vin blanc dans la blanquette ?'],
          ['mehdi', '10 cl, c’est noté dans le commentaire de la recette.'],
          ['camille', 'Trouvé, merci. Je l’ajoute directement aux ingrédients cette fois.'],
        ],
      },
    ],
  },
  {
    cookbook: 'coloc',
    salves: [
      {
        joursAvant: 47,
        heure: 21,
        echanges: [
          ['hugo', 'Planning de la semaine prochaine, chacun met son plat avant dimanche soir.'],
          ['ines', 'Mardi pour moi, je fais le dahl.'],
          ['awa', 'Jeudi, falafels. Je mets les pois chiches à tremper mercredi.'],
          ['nadia', 'Je ne cuisine pas cette semaine, je suis chez mes parents.'],
          ['hugo', 'Noté. Je prends lundi et vendredi.'],
        ],
      },
      {
        joursAvant: 21,
        heure: 18,
        echanges: [
          ['ines', 'La liste de courses est générée, elle est dans l’onglet Courses.'],
          ['hugo', 'Je passe au marché samedi matin, j’ai coché ce que j’ai déjà.'],
          ['awa', 'Il manque le lait de coco, j’en prends deux briques au passage.'],
        ],
      },
      {
        joursAvant: 8,
        heure: 22,
        echanges: [
          ['hugo', 'Le ramen de dimanche : il faut lancer le bouillon samedi après-midi.'],
          ['awa', 'Je peux m’en occuper, je suis là toute la journée.'],
          ['hugo', 'Génial. Les œufs marinent la nuit, ne les oublie pas.'],
          ['ines', 'Je m’occupe des nouilles et des accompagnements dimanche.'],
        ],
      },
      {
        joursAvant: 1,
        heure: 13,
        echanges: [
          ['nadia', 'Quelqu’un a repris le plat en verre ? Il n’est plus dans le placard.'],
          ['ines', 'Il est chez moi, je le ramène ce soir.'],
        ],
      },
    ],
  },
  {
    cookbook: 'batch',
    salves: [
      {
        joursAvant: 35,
        heure: 10,
        echanges: [
          ['lucie', 'Session de dimanche : ratatouille, dahl, soupe de potimarron.'],
          ['camille', 'Trois heures pour les trois, en se répartissant les plaques.'],
          ['awa', 'Je m’occupe du dahl, c’est le plus rapide et ça libère un feu.'],
          ['lucie', 'Pensez aux bocaux, la dernière fois on a manqué de contenants.'],
        ],
      },
      {
        joursAvant: 11,
        heure: 17,
        echanges: [
          ['camille', 'Bilan de la semaine : la ratatouille a tenu six jours au frais.'],
          ['lucie', 'Bon à savoir. Je vais l’écrire dans la recette.'],
          ['awa', 'La soupe, quatre jours maximum à cause du lait de coco.'],
        ],
      },
    ],
  },
  {
    cookbook: 'desserts',
    salves: [
      {
        joursAvant: 29,
        heure: 21,
        echanges: [
          ['sarah', 'J’ai mis à jour la tarte au citron avec la température du sirop.'],
          ['camille', 'Merci, c’est ce qui me bloquait la dernière fois.'],
          ['thomas', 'Je note. Je m’attaque à la brioche ce week-end.'],
        ],
      },
      {
        joursAvant: 5,
        heure: 20,
        echanges: [
          ['thomas', 'Brioche ratée : la pâte n’a jamais décollé de la cuve.'],
          ['sarah', 'Beurre trop mou ? Il doit être froid et rentrer en trois fois.'],
          ['thomas', 'C’est ça. Il était sorti depuis le matin. Je recommence dimanche.'],
          ['sarah', 'Tiens-moi au courant, j’ajouterai une note dans la recette.'],
        ],
      },
    ],
  },
];

/** Favoris, par compte. Ce que chacun garde sous la main. */
export const FAVORIS = {
  camille: ['tatin', 'yassa', 'risotto', 'dahl', 'citron'],
  mehdi: ['blanquette', 'bourguignon', 'gratin', 'yassa'],
  lucie: ['dahl', 'potimarron', 'petitspois', 'houmous', 'ratatouille'],
  thomas: ['blanquette', 'levain', 'fondant', 'gnocchis'],
  awa: ['couscous', 'chili', 'quiche', 'ratatouille'],
  paul: ['gratin', 'lasagnes', 'omelette'],
  ines: ['dahl', 'pokebowl', 'falafels', 'limonade', 'chili'],
  hugo: ['padthai', 'chili', 'risotto', 'cookies', 'limonade'],
  sarah: ['tatin', 'levain', 'tajine', 'couscous'],
  nadia: ['tiramisu', 'moussaka', 'gnocchis', 'potimarron'],
};

/**
 * Plannings. `semaine` compte les semaines par rapport à la semaine en cours :
 * deux passées, celle-ci, la suivante. Le correcteur tombe donc sur un planning
 * déjà rempli, et sur un historique derrière lui.
 */
export const PLANNINGS = [
  {
    personne: 'camille',
    entrees: [
      { semaine: -2, jour: 1, mealType: 'dîner', recette: 'quiche', servings: 4 },
      { semaine: -2, jour: 3, mealType: 'dîner', recette: 'ratatouille', servings: 4 },
      { semaine: -2, jour: 6, mealType: 'déjeuner', recette: 'blanquette', servings: 6 },
      { semaine: -1, jour: 0, mealType: 'dîner', recette: 'omelette', servings: 2 },
      { semaine: -1, jour: 2, mealType: 'dîner', recette: 'gratin', servings: 4 },
      { semaine: -1, jour: 5, mealType: 'déjeuner', recette: 'crepes', servings: 6 },
      { semaine: 0, jour: 1, mealType: 'dîner', recette: 'dahl', servings: 4 },
      { semaine: 0, jour: 3, mealType: 'dîner', recette: 'yassa', servings: 6 },
      { semaine: 0, jour: 4, mealType: 'déjeuner', recette: 'mimosa', servings: 6 },
      { semaine: 0, jour: 6, mealType: 'dîner', recette: 'risotto', servings: 4 },
      { semaine: 1, jour: 2, mealType: 'dîner', recette: 'quiche', servings: 4 },
      { semaine: 1, jour: 5, mealType: 'déjeuner', recette: 'couscous', servings: 8 },
    ],
  },
  {
    personne: 'hugo',
    entrees: [
      { semaine: -1, jour: 1, mealType: 'dîner', recette: 'padthai', servings: 4 },
      { semaine: -1, jour: 4, mealType: 'dîner', recette: 'cesar', servings: 4 },
      { semaine: 0, jour: 0, mealType: 'dîner', recette: 'chili', servings: 6 },
      { semaine: 0, jour: 2, mealType: 'dîner', recette: 'pokebowl', servings: 2 },
      { semaine: 0, jour: 6, mealType: 'déjeuner', recette: 'ramen', servings: 4 },
      { semaine: 1, jour: 3, mealType: 'dîner', recette: 'padthai', servings: 4 },
    ],
  },
  {
    personne: 'lucie',
    entrees: [
      { semaine: -1, jour: 0, mealType: 'déjeuner', recette: 'potimarron', servings: 2 },
      { semaine: 0, jour: 1, mealType: 'dîner', recette: 'dahl', servings: 2 },
      { semaine: 0, jour: 3, mealType: 'déjeuner', recette: 'petitspois', servings: 2 },
      { semaine: 0, jour: 5, mealType: 'dîner', recette: 'ratatouille', servings: 4 },
      { semaine: 1, jour: 1, mealType: 'dîner', recette: 'houmous', servings: 2 },
    ],
  },
  {
    cookbook: 'coloc',
    auteur: 'hugo',
    entrees: [
      { semaine: 0, jour: 0, mealType: 'dîner', recette: 'chili', servings: 4 },
      { semaine: 0, jour: 1, mealType: 'dîner', recette: 'dahl', servings: 4 },
      { semaine: 0, jour: 3, mealType: 'dîner', recette: 'falafels', servings: 4 },
      { semaine: 0, jour: 4, mealType: 'dîner', recette: 'padthai', servings: 4 },
      { semaine: 1, jour: 6, mealType: 'déjeuner', recette: 'ramen', servings: 4 },
    ],
  },
  {
    cookbook: 'famille',
    auteur: 'camille',
    entrees: [
      { semaine: 1, jour: 5, mealType: 'déjeuner', recette: 'couscous', servings: 10 },
      { semaine: 1, jour: 5, mealType: 'dîner', recette: 'crepes', servings: 10 },
    ],
  },
];

/**
 * Listes de courses, engendrées depuis une fenêtre du planning. `coche` donne
 * la proportion de lignes déjà rayées : une liste entièrement vierge et une
 * liste entièrement cochée racontent toutes les deux moins qu'une liste en
 * cours.
 */
export const LISTES_DE_COURSES = [
  { personne: 'camille', semaine: -1, duJour: 0, auJour: 6, coche: 1 },
  { personne: 'camille', semaine: 0, duJour: 0, auJour: 6, coche: 0.45 },
  { personne: 'hugo', semaine: 0, duJour: 0, auJour: 6, coche: 0.3 },
  { personne: 'lucie', semaine: 0, duJour: 0, auJour: 6, coche: 0 },
];
