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
  FS[/Volume fichiers<br/>images de recettes/]
  OAUTH[[Fournisseurs OAuth2<br/>Google, GitHub]]

  UI -->|HTTPS / REST JSON| API
  UI -->|WebSocket| WSV
  API --> AUTH
  API --> SVC
  WSV --> SVC
  AUTH -->|OAuth2| OAUTH
  SVC --> ORM
  SVC -->|lecture / ecriture| FS
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
      PG[(PostgreSQL<br/>volume db_data)]
    end
    MIG[Conteneur: migrate<br/>ephemere, s'arrete apres]
    UP[(Volume uploads_data<br/>images de recettes)]
  end
  USER([Utilisateur]) -->|:80/:443| NGINX
  NGINX -->|/api proxy| NODE
  NODE -->|5432| PG
  NODE -->|/app/uploads| UP
  MIG -->|migrations Umzug| PG
  MIG -.->|doit finir avant| NODE

  classDef v fill:#F9F8FD,stroke:#3B2F92,color:#1A153B;
  class c1,c2,c3 v;
```

## Services `docker-compose.yml`

| Service | Rôle | Notes |
|---|---|---|
| `web` | Client React buildé, servi par Nginx | Proxy `/api` → service `api`. |
| `api` | Serveur Express (REST + WebSocket) | Variables d'env pour secrets (JWT, OAuth, DB) — **jamais en clair dans le code**. Volume `uploads_data` monté sur `/app/uploads`. |
| `db` | PostgreSQL | Volume `db_data` pour la persistance. `.env` exclu du dépôt (`.gitignore`). |
| `migrate` | Applique les migrations Umzug puis s'arrête | Éphémère (`restart: "no"`). `api` attend sa terminaison réussie (`service_completed_successfully`), pour qu'aucune requête n'atteigne un schéma incomplet. |

> ≥ 3 services distincts ✅ — l'application doit pouvoir démarrer intégralement
> via `docker compose up`.

## Volumes nommés

| Volume | Monté sur | Contenu |
|---|---|---|
| `db_data` | `db:/var/lib/postgresql/data` | Données PostgreSQL. |
| `uploads_data` | `api:/app/uploads` | Images de recettes envoyées par les utilisateurs. |

Les images sont stockées **hors du conteneur** : sans ce volume, chaque
reconstruction de l'image Docker les effacerait. En base, seul un chemin
relatif est conservé (`/uploads/recipes/<uuid>.jpg`), rendu absolu à la
sortie de l'API — un changement d'URL publique n'invalide donc rien.

## Gestion des secrets (anti-malus)

- Tous les secrets (clés OAuth2, secret JWT, mot de passe DB) passent par des
  **variables d'environnement** injectées via `docker-compose` + fichier `.env`.
- `.env` est ajouté au `.gitignore` ; un `.env.example` documenté est versionné à la place.
- Mots de passe utilisateurs **hashés** (bcrypt, coût 12) — jamais en clair.
