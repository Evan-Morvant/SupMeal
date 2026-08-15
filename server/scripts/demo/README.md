# Scénarios de démonstration

Scripts de vérification manuelle jouant les fonctionnalités de l'API **contre la
stack Docker réellement en marche**, là où `npm test` monte l'application en
mémoire sur une base jetable. Ils couvrent donc ce que les tests d'intégration
ne peuvent pas voir : l'image déployée est à jour, le serveur démarre, la
configuration tient debout, le WebSocket accepte les connexions.

Chaque scénario est **indépendant** : il crée ses propres comptes, horodatés, ne
suppose rien de l'état de la base et tourne dans son propre processus. On peut
les rejouer autant de fois que voulu, dans n'importe quel ordre, sans purge.

## Préparer la stack

Une seule ligne à ajouter au `.env` **de la racine du dépôt** :

```
AUTH_RATE_LIMIT_MAX=100000
```

Puis, depuis la racine :

```bash
docker compose up -d --build
```

## Jouer les scénarios

Depuis `server/` :

```bash
npm run demo                                   # les douze scénarios
node scripts/demo/recipes.mjs                  # un seul
node scripts/demo/run-all.mjs recipes search   # une sélection
```

L'API est attendue sur `http://localhost:4000`, aucune variable à poser.

## Nettoyer après coup

La série crée une quarantaine de comptes `<role>-<horodatage>-<n>@demo.fr`, avec
leurs recettes, cookbooks et messages. Rien n'oblige à les supprimer : les
scénarios se rejouent tels quels. Pour repartir d'une base vierge :

```bash
docker compose down -v
docker compose up -d --build
```

**`-v` supprime les volumes** : toute la base et toutes les images de recettes
envoyées, pas seulement les données de démonstration. Les migrations sont
rejouées au démarrage.

## Le plafond du limiteur

`/auth/register` et `/auth/login` sont limitées à **20 requêtes par quart d'heure
et par IP** pour freiner le bruteforce (`AUTH_RATE_LIMIT_MAX`).

| | Appels concernés | Sous le plafond par défaut |
|---|---:|---|
| Un scénario seul | 2 à 11 | oui |
| La série complète | ~40 | non |

Un scénario isolé tourne donc sans rien changer ; la série complète s'arrête en
cours de route sur un `429`, et les scripts le disent explicitement plutôt que
de laisser chercher l'erreur dans le scénario. Attention : deux scénarios lancés
coup sur coup partagent la même fenêtre de quinze minutes.

C'est un plafond de développement. **Retirez la ligne du `.env` une fois la
démonstration finie** : elle n'a rien à faire dans une configuration déployée.

## Les scénarios

| Script | Ce qu'il exerce | Vérifications |
|---|---|---:|
| `auth.mjs` | Inscription, connexion, rotation du refresh token, déconnexion, refus | 16 |
| `users.mjs` | Profil, mot de passe, préférences culinaires, comptes OAuth2 | 19 |
| `recipes.mjs` | Cycle de vie complet, image, favoris, droits du créateur | 27 |
| `search.mjs` | Plein texte français, tags, ingrédients, temps, tri, pagination | 20 |
| `catalog.mjs` | Autocomplétion des ingrédients, liste des tags par type | 17 |
| `suggestions.mjs` | Exclusions (allergies, favoris, déjà prévu), score et motifs | 16 |
| `reviews.mjs` | Note et texte, un avis par personne, moyenne, lecture anonyme | 22 |
| `cookbooks.mjs` | Invitations, hiérarchie des rôles, permissions par action | 26 |
| `comments.mjs` | Fils par recette, cloisonnement entre cookbooks, modération | 18 |
| `meal-plan.mjs` | Planning personnel et partagé, fenêtres de consultation | 24 |
| `shopping-lists.mjs` | Agrégation, mise à l'échelle, instantané, liste de groupe | 20 |
| `chat.mjs` | WebSocket, repli REST, historique, rétrogradation | 10 |
| `import-export.mjs` | Trois formats, trois périmètres, règles d'import | 60 |
| | | **295** |

`users.mjs` s'adapte à la configuration de l'instance : sans identifiants OAuth2
renseignés, il vérifie le refus explicite (`503 PROVIDER_NOT_CONFIGURED`) au lieu
de l'URL de liaison.

## Écrire un nouveau scénario

`lib.mjs` porte le socle commun : `call` / `callFull` (appels JSON),
`sendFile` (multipart), `register` (compte neuf), `check` / `checkEqual`
(vérifications) et `main` (point d'entrée, code de sortie non nul au premier
écart). Un scénario se termine par `main('Titre', run)` et s'ajoute à la liste
`SCENARIOS` de `run-all.mjs`.

Les refus font partie de la démonstration au même titre que les succès :
`expect: 403` attend un refus précis, et une liste (`expect: [200, 503]`) couvre
ce qui dépend de la configuration de l'instance plutôt que du code.
