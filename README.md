<div align="center">

# 🍽️ SUPMEAL

**Gestion de recettes & planification de repas**

</div>

Application web de création, organisation et planification de recettes, avec cookbooks
partagés, messagerie, commentaires, import/export et recherche plein texte.

## Architecture (monorepo)

```
SupMeal/
├── client/              # Client web — React + Vite + TypeScript (interface pure)
├── server/              # API REST — Node.js + Express + Sequelize (TypeScript)
├── docs/
│   └── conception/      # Diagrammes UML, schéma BDD, contrat OpenAPI
├── docker-compose.yml   # Orchestration : web + api + db
├── .env.example         # Modèle de configuration (copier vers .env)
└── README.md
```

Trois briques distinctes (cf. sujet) : **client web** (n'interagit qu'avec l'API),
**serveur** (toute la logique métier), **base de données** PostgreSQL.

## Stack

| Brique | Techno |
|---|---|
| Client | React 18 + Vite + TypeScript |
| Serveur | Node.js 20 + Express + Sequelize (TypeScript) |
| Base de données | PostgreSQL 16 |
| Auth | JWT + OAuth2 (Google, GitHub) |
| Temps réel | Socket.io (messagerie) |
| Déploiement | Docker Compose |

## Prérequis

Docker et Docker Compose (ou, hors Docker, Node.js 20 et PostgreSQL 16).

**Génération des secrets de signature.** `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET`
n'ont aucune valeur par défaut : le serveur refuse de démarrer tant qu'elles ne sont
pas renseignées, avec au minimum 32 caractères.

Générer **une valeur différente pour chacun** :

```bash
openssl rand -hex 32
# ou, sans openssl :
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

puis reporter les deux valeurs dans le `.env` :

```dotenv
JWT_ACCESS_SECRET=<première valeur générée>
JWT_REFRESH_SECRET=<seconde valeur générée>
```

Changer ces secrets invalide les sessions ouvertes et les invitations de cookbook en
attente (leur empreinte est calculée avec le secret de refresh) : il faut se
reconnecter.

## Démarrage rapide (Docker)

```bash
cp .env.example .env      # puis générer et renseigner les secrets (cf. Prérequis)
docker compose up -d --build                  # la pile, base vide
docker compose --profile seed up -d --build   # la pile, avec le jeu de données
```

- Client web : http://localhost:8080
- API : http://localhost:4000/api/v1 (santé : `/health`)

Le profil `seed` remplit une base neuve d'un jeu de données plausible : dix
comptes, trente-quatre recettes, quatre cookbooks, des avis, des discussions et
un planning en cours. C'est la façon de découvrir l'application sans repartir
d'écrans vides. Tous les comptes partagent le mot de passe `Motdepasse123!` ; le
plus fourni est `camille.roux@supmeal.fr`. Détail et remise à zéro :
[`server/scripts/seed/`](server/scripts/seed/README.md).

## Développement local (hors Docker)

```bash
# Terminal 1 — API
cd server && npm install && npm run dev

# Terminal 2 — Client
cd client && npm install && npm run dev
```

## Documentation

- **Documentation technique** : [`docs/documentation-technique.md`](docs/documentation-technique.md)
  — déploiement, architecture, modèle de données, diagrammes de séquence, sécurité
- **Manuel utilisateur** : [`docs/manuel-utilisateur.pptx`](docs/manuel-utilisateur.pptx)
  — la prise en main écran par écran, en diaporama
- Conception (UML, BDD, API) : [`docs/conception/`](docs/conception/README.md)
- Contrat d'API (OpenAPI/Swagger) : [`server/openapi.yaml`](server/openapi.yaml), servi en
  Swagger UI sur [`/api/v1/swagger`](http://localhost:4000/api/v1/swagger)
- Mise en place OAuth2 : [Google](docs/oauth-google.md) · [GitHub](docs/oauth-github.md)

## Sécurité

Aucun secret n'est versionné (`.env` est ignoré) et aucun n'a de valeur de repli dans
le code : les secrets JWT sont un prérequis d'installation, le serveur s'arrête avec un
message explicite s'ils manquent. Les mots de passe sont hashés.

Les jetons sont signés avec **trois clés distinctes** : `JWT_ACCESS_SECRET` pour les
access tokens, `JWT_REFRESH_SECRET` pour les refresh tokens et l'empreinte HMAC des
jetons stockés, et une clé dérivée du secret d'accès pour le `state` OAuth2. Cette
dernière séparation est nécessaire : le `state` transite dans une redirection publique,
signé avec la clé d'accès il vaudrait access token.

Voir [`.env.example`](.env.example) pour la liste des variables à configurer.
