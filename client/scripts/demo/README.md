# Scénarios de démonstration du client

Pendant, côté interface, des scénarios de `server/scripts/demo/`. Là où
ceux-ci interrogent l'API, ceux-ci **conduisent un vrai navigateur** sur
l'application réellement servie : ils vérifient donc ce que ni les appels
d'API ni une relecture du code ne montrent — que l'écran affiche ce que l'API
renvoie, que le formulaire soumet, que la garde de route redirige.

Second usage : chaque scénario dépose ses **captures d'écran** dans
`client/screenshots/<scénario>/`. Elles ne partent pas au dépôt et ne servent
pas de référence ; elles montrent l'état réel de l'écran au moment du contrôle,
ce qui est la façon la plus rapide de comprendre un scénario qui échoue.

## Lancer

```bash
npm run demo              # tous les scénarios
npm run demo -- auth      # un seul
```

Prérequis : l'**API** et le **client** doivent tourner, et Chrome être
installé. Par défaut le client est attendu sur `http://localhost:5173`.

| Variable | Défaut | Rôle |
|---|---|---|
| `WEB_URL` | `http://localhost:5173` | Interface à conduire. Mettre `http://localhost:8080` pour jouer les scénarios contre la stack Docker. |
| `SHOTS_DIR` | `client/screenshots` | Où déposer les captures. |
| `CHROME_PATH` | détecté | Chemin de l'exécutable Chrome. |
| `HEADFUL` | absent | `1` pour voir le navigateur travailler. |

## Les scénarios

| Scénario | Ce qu'il éprouve |
|---|---|
| `auth` | Accueil visiteur, garde des routes privées, inscription, session reprise, déconnexion. |
| `recettes` | Création complète avec photo, détail, favori, recherche et filtres, modification, suppression. |
| `decouverte` | Publication, découverte publique, avis et notation, refus opposé au créateur. |
| `cookbooks` | Invitations, rôles, permissions par action, commentaires du groupe. |
| `messagerie` | **Deux sessions simultanées** : diffusion temps réel, pastille de non-lus, salon fermé au Lecteur. |
| `planning` | Semaine, déplacement d'un repas, liste de courses, période sans repas. |
| `parametres` | Profil, préférences, **aller-retour export → import** dans les trois formats, portabilité. |
| `accessibilite` | Titres, noms accessibles, libellés, repères, **contrastes WCAG AA** sur treize écrans. |
| `responsive` | Débordement horizontal et bascule du rail vers la barre d'onglets, en largeur de téléphone. |

## Limiteur d'authentification

Chaque scénario crée ses comptes : la suite complète fait une quinzaine
d'inscriptions et de connexions. Le limiteur anti-bruteforce du serveur
(20 requêtes par quart d'heure et par IP sur `/auth/register` et `/auth/login`)
la coupe donc en cours de route, avec un `429` qui ressemble à un défaut
d'interface — le scénario échoue sur une attente d'écran, pas sur un message
clair.

Démarrer l'API avec `AUTH_RATE_LIMIT_MAX=100000` le temps de la série lève
l'obstacle. C'est un réglage de développement : il n'a rien à faire dans le
`.env` du rendu.

## Sorties

Les captures vont dans `client/screenshots/<scénario>/`, **ignoré par Git** :
un scénario est du code et se versionne, une capture est un produit et se
régénère. Rien de cet outillage n'entre dans l'archive du rendu.

## Comment c'est fait

`lib.mjs` pilote Chrome par le **protocole DevTools**, en direct : Node
fournit `WebSocket` en global, aucune dépendance n'est donc ajoutée au projet.
Chrome choisit son port de débogage (`--remote-debugging-port=0`) et l'écrit
dans son profil, ce qui permet de lancer les scénarios à la suite sans se
disputer un numéro fixe.

Deux points à connaître avant d'écrire un scénario :

- **Cibler par le nom accessible**, pas par la classe CSS : les modules CSS
  hachent les noms de classe à chaque build. `button[aria-label="Se
  déconnecter"]` est stable, et si le sélecteur n'existe pas, c'est que
  l'élément n'est pas nommé — donc que l'accessibilité est à corriger.
- **`page.fill` pose la valeur par le setter natif puis émet `input`.** Un
  simple `el.value = …` ne prévient pas React : le champ paraîtrait rempli à
  l'écran et vide à la soumission.
- **`page.goto` recharge la page, `clickText` reste dans l'application.** La
  différence n'est pas cosmétique : un rechargement vide le cache de requêtes,
  et masque donc tout défaut lié à des données servies depuis ce cache. Pour
  éprouver un parcours tel qu'un utilisateur le vit, il faut **cliquer** les
  liens.
- **`page.fork()` ouvre une seconde page** dans son propre contexte de
  navigation : stockage isolé, donc session et compte distincts. C'est ce qui
  permet de faire dialoguer deux utilisateurs dans un même scénario.
