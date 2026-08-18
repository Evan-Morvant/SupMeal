# Jeu de données

`npm run seed` remplit une instance de SUPMEAL comme si elle servait depuis
huit mois. Ce n'est pas un test : les scénarios de `npm run demo` vérifient le
comportement de l'API et s'arrêtent au premier écart, celui-ci ne fait
qu'écrire. Il existe pour qu'une instance fraîchement montée ne s'ouvre pas sur
des écrans vides.

## Ce qui est créé

| | |
|---|---|
| Comptes | 10, avec leurs préférences culinaires |
| Recettes | 34, écrites en entier, dont 29 publiques, toutes avec une image |
| Cookbooks | 4, et 13 adhésions réparties sur les quatre rôles |
| Avis | 57, note moyenne 4,7 |
| Commentaires | 33, dans les cookbooks |
| Messages | 39, en salves de conversation |
| Planning | 30 repas, de la semaine dernière à la suivante |
| Courses | 4 listes, dont deux partiellement cochées |
| Invitations | 2 laissées sans réponse |

Tous les comptes partagent le mot de passe **`motdepasse123`**. Le plus fourni
est `camille.roux@supmeal.fr` : quatre recettes, deux cookbooks, un planning
rempli et deux listes de courses.

Pour voir l'application depuis un autre angle : `hugo.lemoine@supmeal.fr` mène
une colocation, `thomas.girard@supmeal.fr` n'est que lecteur dans un cookbook
et éditeur dans un autre, `awa.diallo@supmeal.fr` a une invitation en attente.

## En Docker : rien à lancer

Le compose déclare un service `seed`, joué après que l'API est en bonne santé.
`docker compose up --build` suffit donc à obtenir une application pleine. Le
service est rejoué à chaque `up` et sort sans erreur quand le travail est déjà
fait, si bien qu'une pile qui remonte ne signale pas d'échec.

Pour le rejouer à neuf sur une pile déjà debout :

```bash
docker compose run --rm -e SEED_RESET=1 seed
```

## À la main

```bash
npm run seed
```

Deux variables comptent :

- **`API_URL`** — l'API visée, `http://localhost:4000` par défaut.
- **`DATABASE_URL`** — la base **derrière cette API**, et pas une autre. Elle
  sert à reculer les dates de création. Sans elle, le peuplement se fait quand
  même, mais tout date d'aujourd'hui.

En Docker, la base est publiée sur 5433 alors que `server/.env` désigne celle du
développement :

```bash
DATABASE_URL=postgres://<user>:<motdepasse>@localhost:5433/<base> npm run seed
```

Les identifiants sont ceux du `.env` à la racine du dépôt (`POSTGRES_USER`,
`POSTGRES_PASSWORD`, `POSTGRES_DB`).

## Rejouer

Le script ne travaille pas deux fois : il demande d'abord au catalogue public
si l'une de ses recettes s'y trouve déjà, et sort sans rien faire le cas
échéant. La sonde ne dépend d'aucun mot de passe, qui peut avoir été changé
depuis l'application. Pour repartir à neuf :

```bash
SEED_RESET=1 npm run seed
```

Cette variable **supprime les comptes en `@supmeal.fr`**, et avec eux, par
cascade, leurs recettes, cookbooks et discussions. Rien d'autre n'est touché :
les comptes créés à la main et ceux des scénarios de démonstration (`@demo.fr`)
restent en place.

## Ce qui se passe sous le capot

Tout passe par l'API publique, sans écriture directe : le jeu de données ne
peut donc rien contenir qu'un utilisateur n'aurait pas pu créer lui-même. Les
rôles sont respectés à la lettre — un lecteur ne commente pas, personne ne note
sa propre recette.

Deux exceptions assumées, toutes deux en SQL faute d'équivalent dans l'API :

- **les dates de création**, reculées à la fin. Sans cette passe, quarante
  messages afficheraient la même heure et la supercherie sauterait aux yeux ;
- **`SEED_RESET`**, qui supprime des comptes.

Les images sont peintes par `cover.mjs` : un aplat dérivé du titre, reprenant
l'assiette du logo. Ce ne sont pas des photographies et elles n'essaient pas de
le paraître.

## Si ça s'arrête

- **`Base injoignable avec DATABASE_URL`** — l'URL ne désigne pas la base de
  l'API visée. Rien n'a encore été écrit : cette vérification passe en premier.
- **`La base contient déjà ce jeu de données, rien à faire`** — ce n'est pas une
  erreur, la sortie vaut zéro. Voir « Rejouer » ci-dessus.
- **`429 : plafond du limiteur atteint`** — dix inscriptions d'affilée frôlent
  la limite par défaut (20 par quart d'heure). Relancer l'API avec
  `AUTH_RATE_LIMIT_MAX=100000`, ou attendre un quart d'heure.
