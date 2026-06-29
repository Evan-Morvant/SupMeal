# SUPMEAL — Catalogue des endpoints de l'API REST

Conception **design-first** : ce contrat est défini **avant** l'implémentation.
Base URL : `/api/v1`. Échanges en JSON. Authentification par **JWT Bearer**
(`Authorization: Bearer <access_token>`).

La spec exécutable correspondante : [`openapi.yaml`](openapi.yaml) (Swagger UI).

---

## Pile de middlewares (serveur Express)

| Middleware | Rôle |
|---|---|
| `requestLogger` | Journalisation des requêtes (corrélation). |
| `rateLimit` | Limitation de débit (appliqué surtout sur `/auth/*`). |
| `validate(schema)` | Validation **body / params / query** (Zod ou Joi) → 400 si invalide. |
| `authenticate` | Vérifie le JWT, charge `req.user`. → 401 si absent/invalide. |
| `loadMembership(:cookbookId)` | Charge le `CookbookMembership` (rôle) de l'utilisateur pour le cookbook ciblé. → 404 si non membre. |
| `requireRole(min)` | Vérifie la hiérarchie de rôle `READER < COMMENTER < EDITOR < OWNER`. → 403 si insuffisant. |
| `requireRecipeAccess` | Autorise la lecture si l'utilisateur est **owner**, **membre** d'un cookbook contenant la recette, **ou** si la recette est `public`. → 403/404. |
| `requireRecipeOwner` | Réserve l'action au **créateur** de la recette. → 403. |
| `upload` | `multer` pour les fichiers (image de recette, fichier d'import). |
| `errorHandler` | Gestion d'erreurs centralisée (format d'erreur uniforme). |

**Hiérarchie des rôles** (un membre possède exactement un rôle par cookbook) :
`READER` (1) < `COMMENTER` (2) < `EDITOR` (3) < `OWNER` (4).
`requireRole(min)` passe si `rôle.niveau >= min.niveau`.

**Format d'erreur uniforme :**
```json
{ "error": { "code": "FORBIDDEN", "message": "Rôle insuffisant", "details": [] } }
```

---

## 1. Authentification — `/auth`

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| POST | `/auth/register` | Inscription par compte local | ❌ | `rateLimit`, `validate` |
| POST | `/auth/login` | Connexion locale (renvoie access+refresh) | ❌ | `rateLimit`, `validate` |
| POST | `/auth/refresh` | Renouvelle l'access token | ❌* | `validate` (refresh token) |
| POST | `/auth/logout` | Invalide le refresh token | ✅ | `authenticate` |
| GET | `/auth/oauth/:provider` | Démarre le flux OAuth2 (`google`) | ❌ | — |
| GET | `/auth/oauth/:provider/callback` | Callback OAuth2 (échange code → JWT) | ❌ | — |
| GET | `/auth/me` | Utilisateur courant (depuis le JWT) | ✅ | `authenticate` |

\* protégé par le refresh token lui-même.

## 2. Utilisateur & préférences — `/users/me`

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/users/me` | Profil courant | ✅ | `authenticate` |
| PATCH | `/users/me` | Modifier le profil (nom, avatar) | ✅ | `authenticate`, `validate` |
| PATCH | `/users/me/password` | Changer le mot de passe | ✅ | `authenticate`, `validate` |
| GET | `/users/me/preferences` | Préférences culinaires | ✅ | `authenticate` |
| PUT | `/users/me/preferences` | Définir préférences (régime, allergies, cuisines, portions) | ✅ | `authenticate`, `validate` |
| GET | `/users/me/oauth` | Lister les comptes OAuth2 liés | ✅ | `authenticate` |
| POST | `/users/me/oauth/:provider` | Lier un compte OAuth2 supplémentaire | ✅ | `authenticate` |
| DELETE | `/users/me/oauth/:provider` | Délier un compte OAuth2 | ✅ | `authenticate` |

## 3. Recettes — `/recipes`

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/recipes` | Liste + **recherche plein texte** + filtres (voir query) | ✅ | `authenticate`, `validate` |
| POST | `/recipes` | Créer une recette **personnelle** (owner = user) | ✅ | `authenticate`, `validate` |
| GET | `/recipes/:id` | Détail d'une recette | ✅ | `authenticate`, `requireRecipeAccess` |
| PATCH | `/recipes/:id` | Modifier une recette | ✅ | `authenticate`, `requireRecipeOwner` ou `requireRole(EDITOR)`** |
| DELETE | `/recipes/:id` | Supprimer la recette (entité) | ✅ | `authenticate`, `requireRecipeOwner` |
| POST | `/recipes/:id/image` | Uploader l'image | ✅ | `authenticate`, `requireRecipeOwner`, `upload` |
| POST | `/recipes/:id/favorite` | Marquer favori | ✅ | `authenticate`, `requireRecipeAccess` |
| DELETE | `/recipes/:id/favorite` | Retirer des favoris | ✅ | `authenticate` |

\*\* modifiable par le créateur, ou par un Éditeur+ d'un cookbook contenant la recette.

**Query params de `GET /recipes`** (filtrage et recherche du sujet) :

| Param | Type | Effet |
|---|---|---|
| `q` | string | Recherche plein texte (titre, description, ingrédients). |
| `cookbookId` | uuid | Restreint à un cookbook. |
| `tags` | csv | Filtre par tags/catégories. |
| `ingredients` | csv | Filtre par ingrédients. |
| `maxPrep` / `maxCook` | int | Temps de préparation / cuisson max (min). |
| `favorite` | bool | Uniquement les favoris de l'utilisateur. |
| `sort` | enum | `relevance` \| `recent` \| `prepTime`. |
| `page` / `pageSize` | int | Pagination. |

> **Visibilité** : `POST /recipes` et `PATCH /recipes/:id` acceptent `visibility`
> (`private` par défaut, `public`). Seul le **créateur** peut basculer une recette en public.

## 3 bis. Découverte (recettes publiques) — *bonus*

Navigation publique des recettes `visibility = public`. Lecture sans authentification.

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/discover/recipes` | Lister/rechercher les recettes publiques (filtres + tri par note) | ❌ | `validate` |
| GET | `/discover/recipes/:id` | Détail public d'une recette `public` (+ avis) | ❌ | — |

## 4. Commentaires (conseils, **privés au cookbook**)

Rattachés au couple (recette, cookbook) → le fil reste interne au groupe.

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/cookbooks/:id/recipes/:recipeId/comments` | Lister le fil du cookbook | ✅ | `loadMembership`, `requireRole(READER)` |
| POST | `/cookbooks/:id/recipes/:recipeId/comments` | Commenter | ✅ | `loadMembership`, `requireRole(COMMENTER)`, `validate` |
| PATCH | `/comments/:commentId` | Modifier son commentaire | ✅ | `authenticate` (auteur) |
| DELETE | `/comments/:commentId` | Supprimer (auteur ou OWNER du cookbook) | ✅ | `authenticate` |

## 4 bis. Avis & notation (**publics**, par recette) — *bonus*

Attachés à la recette, visibles partout où elle l'est. Un avis par utilisateur.

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/recipes/:id/reviews` | Lister les avis + note moyenne | ❌* | `requireRecipeAccess` |
| PUT | `/recipes/:id/reviews` | Créer / mettre à jour **son** avis (note 1–5 + texte) | ✅ | `authenticate`, `requireRecipeAccess`, `validate` |
| DELETE | `/recipes/:id/reviews` | Supprimer son avis | ✅ | `authenticate` |

\* lecture autorisée sans authentification si la recette est `public`.

## 5. Cookbooks — `/cookbooks`

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/cookbooks` | Lister mes cookbooks | ✅ | `authenticate` |
| POST | `/cookbooks` | Créer un cookbook (créateur = OWNER) | ✅ | `authenticate`, `validate` |
| GET | `/cookbooks/:id` | Détail (+ rôles des membres) | ✅ | `authenticate`, `loadMembership`, `requireRole(READER)` |
| PATCH | `/cookbooks/:id` | Modifier le cookbook | ✅ | `authenticate`, `loadMembership`, `requireRole(OWNER)` |
| DELETE | `/cookbooks/:id` | Supprimer le cookbook (≠ recettes) | ✅ | `authenticate`, `loadMembership`, `requireRole(OWNER)` |

### 5.1 Recettes d'un cookbook (liaison N–N)

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/cookbooks/:id/recipes` | Recettes du cookbook + recherche propre | ✅ | `loadMembership`, `requireRole(READER)` |
| POST | `/cookbooks/:id/recipes` | Créer une recette **dans** le cookbook (crée + lie) | ✅ | `loadMembership`, `requireRole(EDITOR)`, `validate` |
| PUT | `/cookbooks/:id/recipes/:recipeId` | **Lier** une recette existante | ✅ | `loadMembership`, `requireRole(EDITOR)` |
| DELETE | `/cookbooks/:id/recipes/:recipeId` | **Retirer** la recette (supprime la liaison, pas la recette) | ✅ | `loadMembership`, `requireRole(EDITOR)` |

### 5.2 Membres & invitations

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/cookbooks/:id/members` | Lister les membres et leurs rôles | ✅ | `loadMembership`, `requireRole(READER)` |
| PATCH | `/cookbooks/:id/members/:userId` | Changer le rôle d'un membre | ✅ | `loadMembership`, `requireRole(OWNER)` |
| DELETE | `/cookbooks/:id/members/:userId` | Retirer un membre | ✅ | `loadMembership`, `requireRole(OWNER)` |
| POST | `/cookbooks/:id/invitations` | Inviter (email + rôle) | ✅ | `loadMembership`, `requireRole(OWNER)`, `validate` |
| GET | `/cookbooks/:id/invitations` | Lister les invitations | ✅ | `loadMembership`, `requireRole(OWNER)` |
| DELETE | `/cookbooks/:id/invitations/:invId` | Révoquer une invitation | ✅ | `loadMembership`, `requireRole(OWNER)` |
| POST | `/invitations/:token/accept` | Accepter une invitation | ✅ | `authenticate` |
| POST | `/invitations/:token/decline` | Refuser une invitation | ✅ | `authenticate` |

### 5.3 Messagerie de groupe — `/cookbooks/:id/messages`

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/cookbooks/:id/messages` | Historique du chat (paginé) | ✅ | `loadMembership`, `requireRole(COMMENTER)` |
| POST | `/cookbooks/:id/messages` | Envoyer un message (fallback REST) | ✅ | `loadMembership`, `requireRole(COMMENTER)`, `validate` |

> Le temps réel passe par **WebSocket (Socket.io)** — voir ci-dessous. Le `POST` REST
> est un fallback / pour les clients sans WS.

## 6. Planification des repas — `/meal-plan`

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/meal-plan` | Entrées du planning (`from`, `to`, `cookbookId?`) | ✅ | `authenticate` (+ `loadMembership` si cookbook) |
| POST | `/meal-plan` | Ajouter une entrée (perso ou groupe) | ✅ | `authenticate`, `validate` (+ `requireRole(EDITOR)` si cookbook) |
| PATCH | `/meal-plan/:entryId` | Modifier une entrée | ✅ | `authenticate` (propriétaire ou EDITOR) |
| DELETE | `/meal-plan/:entryId` | Supprimer une entrée | ✅ | `authenticate` (propriétaire ou EDITOR) |

## 7. Liste de courses (bonus) — `/shopping-lists`

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/shopping-lists` | Mes listes (perso + groupe) | ✅ | `authenticate` |
| POST | `/shopping-lists` | **Générer** depuis le planning (`from`, `to`, `cookbookId?`) | ✅ | `authenticate`, `validate` (+ `requireRole(EDITOR)` si cookbook) |
| GET | `/shopping-lists/:id` | Détail (items agrégés) | ✅ | `authenticate` (accès) |
| PATCH | `/shopping-lists/:id/items/:itemId` | Cocher / modifier un item | ✅ | `authenticate` (accès) |
| DELETE | `/shopping-lists/:id` | Supprimer la liste | ✅ | `authenticate` (accès) |

## 8. Référentiels (autocomplétion / filtres) — `/ingredients`, `/tags`

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/ingredients?q=` | Recherche d'ingrédients (autocomplétion) | ✅ | `authenticate` |
| GET | `/tags?type=` | Lister les tags par type | ✅ | `authenticate` |

## 9. Import / Export — `/import`, `/export`

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/export?format=json\|csv\|mealie` | Exporter toutes ses recettes & cookbooks (données en clair) | ✅ | `authenticate` |
| POST | `/import` | Importer un fichier (importeur = créateur) | ✅ | `authenticate`, `upload`, `validate` |

---

## WebSocket (Socket.io) — messagerie temps réel

Namespace authentifié par JWT (handshake). Salons par cookbook.

| Événement | Sens | Payload | Garde |
|---|---|---|---|
| `connection` | client → serveur | `{ token }` | Vérifie le JWT |
| `cookbook:join` | client → serveur | `{ cookbookId }` | Membre ≥ COMMENTER |
| `message:send` | client → serveur | `{ cookbookId, content }` | Membre ≥ COMMENTER → persiste `Message` |
| `message:new` | serveur → clients (room) | `Message` | Diffusion à la room |
| `cookbook:leave` | client → serveur | `{ cookbookId }` | — |

---

## Codes de statut conventionnels

| Code | Usage |
|---|---|
| 200 / 201 / 204 | Succès / création / suppression sans contenu |
| 400 | Validation échouée (`validate`) |
| 401 | Non authentifié (`authenticate`) |
| 403 | Rôle/permission insuffisant (`requireRole`, `requireRecipeOwner`) |
| 404 | Ressource introuvable / non membre |
| 409 | Conflit (email déjà pris, liaison déjà existante) |
| 422 | Entité non traitable (import mal formé) |
| 429 | Trop de requêtes (`rateLimit`) |
