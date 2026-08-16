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
docker compose up --build
```

- Client web : http://localhost:8080
- API : http://localhost:4000/api/v1 (santé : `/health`)

## Développement local (hors Docker)

```bash
# Terminal 1 — API
cd server && npm install && npm run dev

# Terminal 2 — Client
cd client && npm install && npm run dev
```

## Documentation

- Conception (UML, BDD, API) : [`docs/conception/`](docs/conception/README.md)
- Contrat d'API (OpenAPI/Swagger) : [`server/openapi.yaml`](server/openapi.yaml), servi en
  Swagger UI sur [`/api/v1/swagger`](http://localhost:4000/api/v1/swagger)

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
