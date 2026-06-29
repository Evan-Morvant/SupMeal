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
| Auth | JWT + OAuth2 (Google) |
| Temps réel | Socket.io (messagerie) |
| Déploiement | Docker Compose |

## Démarrage rapide (Docker)

```bash
cp .env.example .env      # puis renseigner les secrets
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
- Contrat d'API (OpenAPI/Swagger) : [`docs/conception/openapi.yaml`](docs/conception/openapi.yaml)

## Sécurité

Aucun secret n'est versionné (`.env` est ignoré). Les mots de passe sont hashés.
Voir [`.env.example`](.env.example) pour la liste des variables à configurer.
