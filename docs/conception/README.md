# SUPMEAL — Dossier de conception

Diagrammes UML et schéma de base de données (format **Mermaid**, rendus automatiquement
par GitHub/GitLab). Ces documents alimentent la **documentation technique** du rendu.

| # | Document | Contenu |
|---|----------|---------|
| 01 | [Cas d'utilisation](01-cas-utilisation.md) | Acteurs (Visiteur, Utilisateur, rôles cookbook, OAuth2) et leurs cas d'usage. |
| 02 | [Diagramme de classes](02-diagramme-classes.md) | Modèle de domaine — **pièce centrale**, justifications de modélisation. |
| 03 | [Schéma de la BDD](03-schema-bdd.md) | Modèle relationnel PostgreSQL, index & contraintes d'optimisation. |
| 04 | [Diagrammes de séquence](04-diagrammes-sequence.md) | OAuth2, ajout recette, recherche plein texte, messagerie temps réel, import/export. |
| 05 | [Architecture & déploiement](05-architecture-deploiement.md) | Composants (3 briques) + déploiement Docker Compose + gestion des secrets. |
| 06 | [Catalogue des endpoints](06-api-endpoints.md) | Toutes les routes REST + auth + rôles + middlewares + événements WebSocket. |
| — | [`server/openapi.yaml`](../../server/openapi.yaml) | Spec OpenAPI 3 (design-first). Rangée avec l'API, qui la sert telle quelle. |

## Visualiser l'OpenAPI

- **API démarrée** : [http://localhost:4000/api/v1/swagger](http://localhost:4000/api/v1/swagger),
  où les requêtes s'essaient pour de vrai (spec brute sur `/api/v1/swagger/openapi.json`).
- **Sans backend**, la spec étant écrite à la main :
  - coller `server/openapi.yaml` dans [editor.swagger.io](https://editor.swagger.io).
  - extension de prévisualisation.

## Stack technique

- **Client** : React + Vite + TypeScript
- **Serveur** : Node.js + Express (API REST) + Socket.io
- **ORM** : Sequelize
- **Base de données** : PostgreSQL
- **Auth** : JWT + Passport (OAuth2 Google et GitHub)
- **Déploiement** : Docker Compose (web + api + db, plus un service `migrate` éphémère)

## Charte graphique

| Usage | Couleur |
|---|---|
| Principal (nav, titres, marque) | `#3B2F92` |
| Accent / CTA | `#FF6B4A` |
| Fond & cartes | `#F9F8FD` |
| Texte | `#1A153B` |
