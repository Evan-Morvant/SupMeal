# SUPMEAL — Catalogue des endpoints de l'API REST

Conception **design-first** : ce contrat est défini **avant** l'implémentation.
Base URL : `/api/v1`. Échanges en JSON. Authentification par **JWT Bearer**
(`Authorization: Bearer <access_token>`).

La spec exécutable correspondante : [`server/openapi.yaml`](../../server/openapi.yaml),
servie par l'API sur `/api/v1/swagger` (Swagger UI).

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
| `requireRecipeEditor` | Autorise la modification du contenu au **créateur** ou à un **Éditeur+** d'un cookbook contenant la recette. → 403. |
| `requireRecipeOwner` | Réserve l'action au **créateur** de la recette (suppression, image, visibilité). → 403. |
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
| GET | `/auth/oauth/:provider` | Démarre le flux OAuth2 (`google`, `github`) | ❌ | — |
| GET | `/auth/oauth/:provider/callback` | Callback OAuth2 (échange code, redirige vers le front avec les tokens) | ❌ | — |
| GET | `/auth/me` | Utilisateur courant (depuis le JWT) | ✅ | `authenticate` |

\* protégé par le refresh token lui-même.

## 2. Utilisateur & préférences — `/users/me`

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/users/me` | Profil courant | ✅ | `authenticate` |
| PATCH | `/users/me` | Modifier le profil (nom, avatar) | ✅ | `authenticate`, `validate` |
| PUT | `/users/me/password` | Changer le mot de passe (révoque les sessions) | ✅ | `authenticate`, `validate` |
| GET | `/users/me/preferences` | Préférences culinaires | ✅ | `authenticate` |
| PUT | `/users/me/preferences` | Définir préférences (régime, allergies, cuisines, portions) | ✅ | `authenticate`, `validate` |
| GET | `/users/me/oauth` | Lister les comptes OAuth2 liés | ✅ | `authenticate` |
| POST | `/users/me/oauth/:provider` | Renvoie l'URL d'autorisation pour lier un compte OAuth2 | ✅ | `authenticate` |
| DELETE | `/users/me/oauth/:provider` | Délier un compte OAuth2 | ✅ | `authenticate` |

## 3. Recettes — `/recipes`

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/recipes` | Liste + **recherche plein texte** + filtres (voir query) | ✅ | `authenticate`, `validate` |
| POST | `/recipes` | Créer une recette **personnelle** (owner = user) | ✅ | `authenticate`, `validate` |
| GET | `/recipes/suggestions` | **Suggestions** classées (bonus) | ✅ | `authenticate`, `validate` |
| GET | `/recipes/:id` | Détail d'une recette | ✅ | `authenticate`, `requireRecipeAccess` |
| PATCH | `/recipes/:id` | Modifier une recette | ✅ | `authenticate`, `requireRecipeEditor`** |
| DELETE | `/recipes/:id` | Supprimer la recette (entité) | ✅ | `authenticate`, `requireRecipeOwner` |
| POST | `/recipes/:id/image` | Uploader l'image | ✅ | `authenticate`, `requireRecipeOwner`, `upload` |
| POST | `/recipes/:id/favorite` | Marquer favori | ✅ | `authenticate`, `requireRecipeAccess` |
| DELETE | `/recipes/:id/favorite` | Retirer des favoris | ✅ | `authenticate` |

**Suggestions (bonus).** Le vivier est celui que l'utilisateur peut lire — ses recettes et celles de ses cookbooks. On ne suggère jamais ce qui n'est pas accessible : une suggestion menant à un 403 serait pire que pas de suggestion.

*Écartées en SQL* : les recettes contenant un ingrédient dont le nom rappelle une **allergie** déclarée, celles déjà en **favori** et celles déjà **prévues au planning** à venir. La correspondance sur les allergies est volontairement large — « arachide » écarte « beurre d'arachide » — parce que l'erreur n'a pas le même coût des deux côtés : proposer une recette dangereuse est bien plus grave que d'en écarter une inoffensive. Le passé reste éligible, une recette cuisinée le mois dernier pouvant revenir.

*Classées en mémoire*, sur un vivier déjà réduit, par une somme de signaux nommés : régime déclaré (3), cuisine préférée (2), puis proximité avec ce que l'utilisateur cuisine déjà — les tags de ses favoris pèsent le double de ceux qu'il a seulement planifiés, la contribution d'un même tag étant plafonnée pour qu'une catégorie omniprésente n'écrase pas le reste. Chaque suggestion porte ses **motifs en clair** : un classement qu'on ne sait pas expliquer n'a pas sa place ici. À score égal, l'ordre du vivier fait foi — les recettes les plus récentes — ce qui donne une réponse utile même à un profil vide.

La correspondance des régimes et cuisines se fait sur le **libellé** du tag, non sur son type : hors des quelques tags de référence posés par la migration, tout tag saisi par un utilisateur naît `custom`, et filtrer sur `type = 'diet'` rendrait ce signal définitivement muet. La règle de score est isolée dans `suggestions/scoring.ts`, fonction pure éprouvée sans base.

La route est déclarée **avant** `/recipes/:id`, qui capterait sinon « suggestions » comme un identifiant.

\*\* modifiable par le créateur, ou par un Éditeur+ d'un cookbook contenant la recette : partager une recette dans un groupe, c'est accepter que le groupe la corrige. Le droit tombe dès que la recette est retirée du cookbook. **La visibilité fait exception** : seul le créateur bascule sa recette en `public` (403 sinon), de même que la suppression et l'image restent son privilège.

**Query params de `GET /recipes`** (filtrage et recherche du sujet) :

| Param | Type | Effet |
|---|---|---|
| `q` | string | Recherche plein texte (titre, description, ingrédients). |
| `cookbookId` | uuid | Restreint à un cookbook. |
| `tags` | csv | Filtre par tags/catégories, insensible à la casse. Valeurs cumulées en **ET**. |
| `ingredients` | csv | Filtre par ingrédients, cumulés en **ET** (« qu'est-ce que je peux faire avec ce que j'ai »). |
| `maxPrep` / `maxCook` | int | Temps de préparation / cuisson max (min). Exclut les recettes sans temps renseigné. |
| `favorite` | bool | Uniquement les favoris de l'utilisateur. |
| `sort` | enum | `relevance` \| `recent` \| `prepTime`. Défaut : `relevance` si `q`, sinon `recent`. |
| `page` / `pageSize` | int | Pagination (`pageSize` ≤ 100). |

> **Périmètre** : ses propres recettes et celles des cookbooks dont on est membre.
> Les entrées renvoyées sont des résumés (tags oui, ingrédients et étapes non) ;
> le détail complet passe par `GET /recipes/:id`.

> **Visibilité** : `POST /recipes` et `PATCH /recipes/:id` acceptent `visibility`
> (`private` par défaut, `public`). Seul le **créateur** peut basculer une recette en public.

## 3 bis. Découverte (recettes publiques) — *bonus*

Navigation publique des recettes `visibility = public`. Lecture sans authentification.

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/discover/recipes` | Lister/rechercher les recettes publiques (`q`, `tags`, tri) | ❌ | `authenticateOptional`, `validate` |
| GET | `/discover/recipes/:id` | Détail public d'une recette `public` | ❌ | `authenticateOptional` |

**Règles de gestion :**
- **Le périmètre est la seule différence avec `/recipes`** : `visibility = 'public'` remplace le périmètre du compte, et les filtres de contenu (plein texte, tags, temps) sont les mêmes fonctions, partagées dans `recipes.filters.ts`.
- **`cookbookId` et `favorite` en sont absents** : ils désignent le périmètre d'un compte, qu'un visiteur n'a pas. Le tri accepte `relevance`, `rating` et `recent` — `prepTime` reste à la liste personnelle.
- **Tri `rating`** : `avg_rating DESC NULLS LAST`, servi par l'index partiel `recipes_rating_idx` posé sur les seules recettes publiques.
- **`authenticateOptional`** : un jeton est accepté sans être exigé. Il renseigne alors `isFavorite`, sans jamais élargir le périmètre — le créateur d'une recette privée ne la voit pas non plus dans la découverte, il la lit par `/recipes`.
- **Le détail répond 404 sur une recette non publique**, jamais 403. La route est anonyme et adressable par n'importe quel identifiant : un 403 confirmerait l'existence de la recette à qui la cherche, et les identifiants fuient légitimement (l'export de `/users/me/data` liste les siens).
- Réponse de la liste : l'enveloppe paginée `{ items, total, page, pageSize }`, la même que `/recipes` — sans `total`, le client ne peut pas construire sa pagination.

> **Page d'accueil.** `/discover?sort=rating` alimente l'accueil d'un visiteur. Un utilisateur connecté reçoit `GET /recipes/suggestions` (scoré, avec motifs) ; si la liste revient vide — compte neuf, sans recette ni cookbook — le client se rabat sur `/discover`. Choisir laquelle afficher relève de la composition d'affichage, pas de la logique métier.

## 4. Commentaires (conseils, **privés au cookbook**)

Rattachés au couple (recette, cookbook) → le fil reste interne au groupe.

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/cookbooks/:id/recipes/:recipeId/comments` | Lister le fil du cookbook | ✅ | `loadMembership`, `requireRole(READER)` |
| POST | `/cookbooks/:id/recipes/:recipeId/comments` | Commenter | ✅ | `loadMembership`, `requireRole(COMMENTER)`, `validate` |
| PATCH | `/comments/:commentId` | Modifier son commentaire | ✅ | `authenticate` (auteur) |
| DELETE | `/comments/:commentId` | Supprimer (auteur ou OWNER du cookbook) | ✅ | `authenticate` |

**Règles de gestion :**
- Le fil n'existe que si la recette est **effectivement liée** au cookbook (404 `RECIPE_NOT_IN_COOKBOOK`) : commenter sous une recette absente du cookbook n'aurait pas de sens, et le fil apparaîtrait par surprise si elle y était liée plus tard.
- **Modification : l'auteur seul**, le créateur du cookbook ne réécrit les propos de personne.
- **Suppression : l'auteur, ou le créateur du cookbook** au titre de la modération de son groupe. Un éditeur, si haut placé soit-il, n'y touche pas.
- Les commentaires disparaissent avec la recette ou avec le cookbook (`ON DELETE CASCADE`).

## 4 bis. Avis & notation (**publics**, par recette) — *bonus*

Attachés à la recette, visibles partout où elle l'est. Un avis par utilisateur.

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/recipes/:id/reviews` | Lister les avis + note moyenne | ❌* | `requireRecipeAccess` |
| PUT | `/recipes/:id/reviews` | Créer / mettre à jour **son** avis (note 1–5 + texte) | ✅ | `authenticate`, `requireRecipeAccess`, `validate` |
| DELETE | `/recipes/:id/reviews` | Supprimer son avis | ✅ | `authenticate` |

\* lecture autorisée sans authentification si la recette est `public`.

**Règles de gestion :**
- **Un avis par couple (recette, utilisateur)** : le `PUT` dépose l'avis ou remplace le sien, d'où l'absence de `POST`. La note est obligatoire, le texte non.
- **Le créateur ne note pas sa propre recette** (403) : sa voix pèserait sur une moyenne qui sert à départager les recettes.
- `avg_rating` et `review_count` sont **portés par la recette**, rafraîchis à chaque écriture d'avis : la découverte trie par note, un `AVG` à la lecture imposerait un regroupement de toute la table `reviews`. `updated_at` reste intact, et `avgRating` vaut `null` sans avis — non notée n'est pas notée zéro.
- La suppression ne repasse pas `requireRecipeAccess` : perdre l'accès à une recette ne doit pas y laisser un avis qu'on ne pourrait plus effacer.

## 5. Cookbooks — `/cookbooks`

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/cookbooks` | Lister mes cookbooks | ✅ | `authenticate` |
| POST | `/cookbooks` | Créer un cookbook (créateur = OWNER) | ✅ | `authenticate`, `validate` |
| GET | `/cookbooks/:id` | Détail (rôle du demandeur, compteurs) | ✅ | `authenticate`, `loadMembership`, `requireRole(READER)` |
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
| DELETE | `/cookbooks/:id/members/me` | Quitter le cookbook | ✅ | `loadMembership`, `requireRole(READER)` |
| POST | `/cookbooks/:id/invitations` | Inviter (email + rôle) | ✅ | `loadMembership`, `requireRole(OWNER)`, `validate` |
| GET | `/cookbooks/:id/invitations` | Lister les invitations | ✅ | `loadMembership`, `requireRole(OWNER)` |
| DELETE | `/cookbooks/:id/invitations/:invId` | Révoquer une invitation | ✅ | `loadMembership`, `requireRole(OWNER)` |
| POST | `/invitations/:token/accept` | Accepter une invitation | ✅ | `authenticate` |
| POST | `/invitations/:token/decline` | Refuser une invitation | ✅ | `authenticate` |

**Règles de gestion :**
- **Dernier créateur** : ni rétrogradation ni départ si c'est le seul `OWNER` restant (409 `LAST_OWNER`) — sinon le cookbook n'aurait plus personne pour inviter, changer les rôles ou le supprimer. Il faut d'abord promouvoir un successeur.
- **Token d'invitation** : tiré au sort, transmis **une seule fois** dans la réponse de création (`token` + `acceptUrl`), stocké **haché** (HMAC, comme les refresh tokens) et jamais renvoyé par la liste.
- **Acceptation** : réservée au titulaire de l'adresse invitée (403 `INVITATION_EMAIL_MISMATCH`), comparaison insensible à la casse. Une invitation déjà acceptée ou refusée ne resert pas (409).
- **Départ d'un membre** : les recettes qu'il avait liées **restent** dans le cookbook ; elles ont été partagées avec le groupe et lui appartiennent toujours par ailleurs.

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
| GET | `/meal-plan` | Entrées du planning (`from`, `to`, `cookbookId?`) | ✅ | `authenticate`, `validate` (+ READER si cookbook) |
| POST | `/meal-plan` | Ajouter une entrée (perso ou groupe) | ✅ | `authenticate`, `validate` (+ EDITOR si cookbook) |
| PATCH | `/meal-plan/:entryId` | Modifier une entrée | ✅ | `authenticate`, `validate` (auteur ou EDITOR) |
| DELETE | `/meal-plan/:entryId` | Supprimer une entrée | ✅ | `authenticate` (auteur ou EDITOR) |

**Règles de gestion :**
- **Le cookbook est désigné hors de l'URL** (chaîne de requête ou corps) :
  `loadMembership`, qui lit les paramètres de route, ne s'applique pas. Le
  contrôle passe par `assertCookbookRole(userId, cookbookId, min)`, partagé avec
  la messagerie, et rend 404 au non-membre comme le fait `loadMembership`.
- **Deux plannings distincts** : sans `cookbookId`, l'appelant ne voit et
  n'alimente que son planning personnel ; avec, celui du groupe — toutes
  personnes confondues, c'est ce qui en fait un planning partagé.
- **Accès à la recette exigé** : on ne planifie que ce qu'on peut consulter
  (même règle que la consultation d'une recette), à la création comme lors
  d'une substitution de recette. Sans ce contrôle, un identifiant deviné
  ferait apparaître la recette privée d'un tiers dans le planning.
- **Une entrée ne déménage pas** : `cookbookId` est absent du corps de `PATCH`
  et les clés inconnues sont refusées (400). Passer du personnel au groupe
  changerait les droits qui encadrent l'entrée : il faut la supprimer et la
  recréer.
- **Tri** : par date, puis par repas. L'ordre des repas vient de l'énuméré
  PostgreSQL, déclaré dans l'ordre de la journée.
- **`author`** accompagne chaque entrée : sur un planning partagé, savoir qui a
  prévu quoi fait partie de l'information, et conditionne les droits de
  modification.

## 7. Liste de courses (bonus) — `/shopping-lists`

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/shopping-lists` | Mes listes (perso + groupe) | ✅ | `authenticate` |
| POST | `/shopping-lists` | **Générer** depuis le planning (`fromDate`, `toDate`, `cookbookId?`) | ✅ | `authenticate`, `validate` (+ `requireRole(EDITOR)` si cookbook) |
| GET | `/shopping-lists/:id` | Détail (items agrégés) | ✅ | `authenticate` (accès) |
| PATCH | `/shopping-lists/:id/items/:itemId` | Cocher / modifier un item | ✅ | `authenticate` (accès) |
| DELETE | `/shopping-lists/:id` | Supprimer la liste | ✅ | `authenticate` (accès) |

**Règle d'agrégation.** Deux lignes ne se cumulent que si elles portent le même ingrédient **dans la même unité** : « 2 pommes » et « 200 g de pommes » restent séparés, faute de table de conversion — les additionner donnerait 202 de rien du tout. L'unité est comparée sans casse ni espaces de bordure, pour que « g » et « G » ne fassent pas deux lignes. Un ingrédient sans quantité — le sel, le poivre — le reste : lui en attribuer une serait inventer.

**Mise à l'échelle.** Une entrée de planning porte ses portions, la recette les siennes : prévoir 8 parts d'une recette qui en donne 4 double les quantités. À défaut de connaître les deux nombres, aucune mise à l'échelle n'est appliquée — mieux vaut une quantité brute qu'une quantité inventée. La règle est isolée dans `shopping-lists/aggregate.ts`, fonction pure éprouvée sans base.

**Un instantané, pas une vue.** Les lignes sont écrites en base à la génération. Modifier une recette ensuite ne réécrit pas une liste déjà emportée au marché.

**Permissions.** Une liste personnelle n'appartient qu'à son auteur. Une liste de groupe suit les rôles du cookbook : `READER` pour la consulter — un membre voit donc une liste qu'il n'a pas générée — et `EDITOR` pour la générer, cocher ses lignes ou la supprimer, conformément à la matrice des rôles (l'éditeur gère recettes, tags, planning et liste de courses). Le périmètre des repas repris est exactement celui qu'affiche `/meal-plan` sur la même fenêtre : les deux règles partagent le même constructeur de requête.

Générer sur une période sans aucun repas planifié répond `422` plutôt que de créer une liste vide, qu'on croirait complète.

## 8. Référentiels (autocomplétion / filtres) — `/ingredients`, `/tags`

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/ingredients?q=&limit=` | Recherche d'ingrédients (autocomplétion) | ✅ | `authenticate`, `validate` |
| GET | `/tags?type=` | Lister les tags par type | ✅ | `authenticate`, `validate` |

**Un vocabulaire partagé, sans propriétaire.** Ingrédients et tags ne sont cloisonnés par aucun utilisateur : les restreindre à ce que l'utilisateur a déjà écrit viderait l'autocomplétion sur un compte neuf, précisément quand elle sert le plus. Ce sont des noms communs, pas des données personnelles. Les deux routes restent fermées à l'anonyme : c'est le vocabulaire de l'application, pas une page publique.

**Autocomplétion par fragment.** « olive » retrouve « huile d'olive » — un préfixe seul échouerait sur les noms composés. Les noms qui *commencent* par la saisie passent devant, le reste suit par ordre alphabétique. La casse est ignorée (les noms sont normalisés en minuscules à l'écriture) et les jokers `LIKE` sont neutralisés, sans quoi un `%` tapé dans le champ ferait remonter tout le catalogue. `limit` vaut 20 par défaut, 50 au maximum. Sans `q`, la route rend le début du catalogue par ordre alphabétique.

La recherche s'appuie sur un **index trigramme** (`pg_trgm`, GIN) posé par la migration `0003` : l'index d'unicité sur `name` est un btree, inutilisable pour un `LIKE '%…%'`. Mesuré sur 200 000 ingrédients : 36 ms en parcours séquentiel contre 0,7 ms via l'index, que le planificateur choisit de lui-même.

**Tags.** Rendus en entier, groupés par type puis par ordre alphabétique. Le type `course` (entrée, plat, dessert...) est posé par la migration initiale ; les tags `custom` naissent des recettes.

## 9. Import / Export — `/import`, `/export`

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/export?format=json\|csv\|mealie` | Exporter toutes ses recettes & cookbooks (données en clair) | ✅ | `authenticate`, `validate` |
| GET | `/recipes/:id/export?format=` | Exporter une seule recette | ✅ | `authenticate`, `requireRecipeAccess`, `validate` |
| GET | `/cookbooks/:id/export?format=` | Exporter un cookbook et ses recettes | ✅ | `authenticate`, `loadMembership`, `requireRole(READER)`, `validate` |
| POST | `/import` | Importer un fichier (importeur = créateur) | ✅ | `authenticate`, `upload`, `validate` |

**Formats.** `json` est le format natif (le plus complet, à privilégier pour sauvegarder puis restaurer) ; `csv` ouvre l'export dans un tableur, une recette par ligne, les collections tenant dans une cellule à raison d'un élément par ligne ; `mealie` suit le schéma de recette de Mealie (schema.org : `recipeIngredient`, `recipeInstructions`, durées ISO 8601), pour l'interopérabilité.

**Export.** Réponse en pièce jointe (`Content-Disposition: attachment`), nommée `supmeal-export-AAAA-MM-JJ.<ext>`. Le périmètre est celui de la lecture : ses propres recettes et celles des cookbooks dont on est membre. L'avertissement exigé au cahier des charges figure dans le champ `warning` de l'export JSON et en tête du fichier CSV ; le client doit également l'afficher avant le téléchargement.

**Trois périmètres, une seule enveloppe.** Les exports partiels produisent la même structure que l'export complet, réduite à leur périmètre — le fichier obtenu se réimporte donc par `/import` sans traitement particulier, quel que soit son périmètre d'origine.

| Route | `recipes` | `cookbooks` | Nom du fichier |
|---|---|---|---|
| `/export` | tout ce qui est lisible | tous ceux dont on est membre | `supmeal-export-AAAA-MM-JJ.<ext>` |
| `/cookbooks/:id/export` | celles du cookbook | le cookbook visé | `supmeal-<nom-du-cookbook>-…` |
| `/recipes/:id/export` | la recette visée | `[]` | `supmeal-<titre-recette>-…` |

Le périmètre d'accès s'applique dans tous les cas : `requireRecipeAccess` pour une recette, `requireRole(READER)` pour un cookbook (un non-membre reçoit 404, jamais 403). L'export d'un cookbook est ouvert au Lecteur, qui peut déjà tout y consulter.

**Aucune donnée personnelle dans l'export.** L'enveloppe ne porte ni l'identité de l'exportateur, ni ses préférences culinaires : un fichier d'export est fait pour être transmis, et y joindre une adresse ou un régime alimentaire reviendrait à les divulguer à qui le reçoit. Ce qui relève de la personne sort par `GET /users/me/data` (voir 9 bis). Un fichier d'une version antérieure qui porterait encore ces champs voit l'import les ignorer.

**Import.** `multipart/form-data` : `file` (obligatoire) et `format` (facultatif — déduit du contenu s'il est omis). L'importeur devient créateur de chaque recette importée, et celle-ci est créée **privée**, quelle que soit la visibilité d'origine : un aller-retour de fichier ne doit jamais publier quelque chose par accident. Une recette dont le titre est déjà possédé est ignorée (`skipped`), ce qui rend l'import idempotent. Une recette invalide n'interrompt pas le traitement : elle est consignée dans `errors` et les suivantes sont traitées.

Réponse `200` : `{ format, created, skipped, errors[] }`. Fichier illisible ou vide, ou plus de 500 recettes : `422`.

## 9 bis. Données personnelles (portabilité) — `/users/me/data`

| Méthode | Route | Description | Auth | Middlewares |
|---|---|---|:---:|---|
| GET | `/users/me/data` | Exporter ses données personnelles | ✅ | `authenticate` |

Deux exports, deux objets distincts. `/export` produit du **contenu réimportable**, en trois formats et trois périmètres. `/users/me/data` décrit **une personne**, ne se réimporte pas, et n'existe qu'en JSON — le CSV ne saurait porter un ensemble aussi hétérogène, et le schéma Mealie ne décrit que des recettes.

Contenu : profil, préférences culinaires, comptes OAuth2 liés, adhésions aux cookbooks, favoris, avis, commentaires, messages, planning, listes de courses. Les recettes n'y figurent **qu'en référence** (identifiant, titre, visibilité, date) : leur contenu s'obtient par `/export`, dont c'est la raison d'être, et le dupliquer imposerait un second chemin de sérialisation moins bon.

**Deux règles tiennent le fichier :**
- **Aucun secret** : ni hash de mot de passe, ni jeton d'aucune sorte. Le profil dit seulement `hasPassword`, l'existence d'un mot de passe local étant une donnée du compte, sa valeur non.
- **Rien qui appartienne à autrui** : commentaires, messages et avis sont filtrés sur leur auteur, et un cookbook n'apparaît que par l'adhésion de l'intéressé, jamais par sa liste de membres. Un export de portabilité qui livrerait les propos des autres membres ferait le contraire de ce qu'on lui demande.

---

## WebSocket (Socket.io) — messagerie temps réel

Authentifié par JWT au handshake (`auth: { token }`, ou en-tête `Authorization`).
Salons par cookbook, nommés `cookbook:<id>`.

| Événement | Sens | Payload | Garde |
|---|---|---|---|
| `connection` | client → serveur | `{ token }` | Vérifie le JWT — sinon `connect_error` |
| `cookbook:join` | client → serveur | `{ cookbookId }` | Membre ≥ COMMENTER |
| `cookbook:joined` | serveur → client | `{ cookbookId }` | Confirme l'entrée dans le salon |
| `message:send` | client → serveur | `{ cookbookId, content }` | Membre ≥ COMMENTER → persiste `Message` |
| `message:new` | serveur → clients (room) | `Message` | Diffusion à la room |
| `cookbook:leave` | client → serveur | `{ cookbookId }` | — |
| `app:error` | serveur → client | `{ code, message, details? }` | Échec d'un événement client |

**Règles de gestion :**
- **Même règle des deux côtés** : le rôle minimal (COMMENTER) est défini une fois
  (`CHAT_MIN_ROLE`) et appliqué par les middlewares côté REST, par un contrôle
  direct côté WebSocket — ce dernier n'ayant pas de pile Express.
- **Accès revérifié à chaque envoi** : un membre exclu ou rétrogradé après son
  entrée dans le salon ne peut plus y écrire.
- **`app:error`** reprend le vocabulaire de codes de l'API REST (`FORBIDDEN`,
  `COOKBOOK_NOT_FOUND`, `VALIDATION_ERROR`), pour que le client traite l'échec
  au même endroit quelle que soit la voie empruntée.
- **Le repli REST diffuse aussi** : un message posté en `POST` est poussé dans le
  salon, sinon les clients connectés ne le verraient qu'au rechargement.
- **Historique à rebours** : la page 1 porte les messages les plus récents, rendus
  dans l'ordre de lecture ; les pages suivantes remontent la conversation.

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
