# SUPMEAL — Architecture & déploiement

## Diagramme de composants (les 3 briques)

```mermaid
flowchart TB
  subgraph Navigateur
    UI[Client web<br/>React + Vite + TS]
  end

  subgraph Serveur[Serveur — Node.js + Express]
    API[API REST]
    WSV[Serveur WebSocket<br/>Socket.io]
    AUTH[Module Auth<br/>JWT + Passport OAuth2]
    SVC[Couche services<br/>logique métier]
    ORM[Sequelize ORM]
  end

  DB[(PostgreSQL)]
  OAUTH[[Fournisseurs OAuth2<br/>Google]]

  UI -->|HTTPS / REST JSON| API
  UI -->|WebSocket| WSV
  API --> AUTH
  API --> SVC
  WSV --> SVC
  AUTH -->|OAuth2| OAUTH
  SVC --> ORM
  ORM -->|SQL| DB

  classDef ext fill:#F9F8FD,stroke:#FF6B4A,stroke-width:2px,color:#1A153B;
  class OAUTH ext;
```

> **Contrainte du sujet respectée** : toute la logique métier est dans la couche
> `services` du serveur. Le client React ne fait qu'afficher et relayer les requêtes.

## Diagramme de déploiement (Docker Compose)

```mermaid
flowchart LR
  subgraph host[Hôte Docker]
    direction TB
    subgraph c1[Conteneur: web]
      NGINX[Nginx<br/>sert le build React]
    end
    subgraph c2[Conteneur: api]
      NODE[Node.js + Express<br/>REST + Socket.io]
    end
    subgraph c3[Conteneur: db]
      PG[(PostgreSQL<br/>volume persistant)]
    end
  end
  USER([Utilisateur]) -->|:80/:443| NGINX
  NGINX -->|/api proxy| NODE
  NODE -->|5432| PG

  classDef v fill:#F9F8FD,stroke:#3B2F92,color:#1A153B;
  class c1,c2,c3 v;
```

## Services `docker-compose.yml` (cible)

| Service | Rôle | Notes |
|---|---|---|
| `web` | Client React buildé, servi par Nginx | Proxy `/api` → service `api`. |
| `api` | Serveur Express (REST + WebSocket) | Variables d'env pour secrets (JWT, OAuth, DB) — **jamais en clair dans le code**. |
| `db` | PostgreSQL | Volume nommé pour la persistance. `.env` exclu du dépôt (`.gitignore`). |

> ≥ 3 services distincts ✅ — l'application doit pouvoir démarrer intégralement
> via `docker compose up`.

## Gestion des secrets (anti-malus)

- Tous les secrets (clés OAuth2, secret JWT, mot de passe DB) passent par des
  **variables d'environnement** injectées via `docker-compose` + fichier `.env`.
- `.env` est ajouté au `.gitignore` ; un `.env.example` documenté est versionné à la place.
- Mots de passe utilisateurs **hashés** (bcrypt/argon2) — jamais en clair (sinon ajournement).
```
