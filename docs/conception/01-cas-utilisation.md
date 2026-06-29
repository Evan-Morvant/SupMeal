# SUPMEAL — Diagramme de cas d'utilisation

> Les ovales (`(...)`) figurent les cas d'utilisation,
> les formes (`[...]`) figurent les acteurs.

## Acteurs

- **Visiteur** : non authentifié.
- **Utilisateur** : compte authentifié (gère son espace personnel).
- **Rôles au sein d'un cookbook partagé** (tous sont des utilisateurs **authentifiés et
  membres** — un cookbook n'est pas public ; héritage croissant de droits) :
  **Lecteur → Commentateur → Éditeur → Créateur**.
  - *Lecteur* = membre en **lecture seule** (consulte/recherche, ne contribue pas).
  - *Commentateur* = + commente les recettes et participe à la messagerie.
  - *Éditeur* = + ajoute/modifie/lie des recettes, tague, planifie, génère la liste de courses.
  - *Créateur* = + gère membres/permissions et supprime le cookbook.
- **Service OAuth2** (Google) : acteur secondaire (système externe).

## Diagramme

```mermaid
graph LR
  %% ---------- Acteurs ----------
  VIS([Visiteur])
  USR([Utilisateur])
  LEC([Lecteur])
  COM([Commentateur])
  EDI([Éditeur])
  CRE([Créateur])
  OAUTH([Service OAuth2]):::ext

  %% Héritage de rôles (un Créateur peut tout ce que peut un Éditeur, etc.)
  COM -.->|étend| LEC
  EDI -.->|étend| COM
  CRE -.->|étend| EDI
  USR -.->|peut devenir| LEC

  %% ---------- Cas : Visiteur ----------
  VIS --> UC_signup(S'inscrire)
  VIS --> UC_login(Se connecter)
  VIS --> UC_oauth(Se connecter via OAuth2)
  UC_oauth -.->|inclut| OAUTH
  VIS --> UC_discover(Parcourir les recettes publiques)

  %% ---------- Cas : Utilisateur (espace perso) ----------
  USR --> UC_profil(Gérer profil & préférences culinaires)
  USR --> UC_mdp(Changer mot de passe)
  USR --> UC_linkoauth(Lier un compte OAuth2)
  UC_linkoauth -.->|inclut| OAUTH
  USR --> UC_recipe_crud(Créer / gérer recettes personnelles)
  USR --> UC_publish(Publier une recette en public)
  USR --> UC_review(Noter / laisser un avis)
  USR --> UC_fav(Marquer une recette favorite)
  USR --> UC_plan(Planifier un repas)
  USR --> UC_search(Filtrer & rechercher des recettes)
  USR --> UC_import(Importer recettes / cookbooks)
  USR --> UC_export(Exporter ses données)
  USR --> UC_create_cb(Créer un cookbook)
  USR --> UC_join_cb(Rejoindre un cookbook sur invitation)

  %% ---------- Cas : Lecteur ----------
  LEC --> UC_view(Consulter les recettes du cookbook)
  LEC --> UC_search_cb(Rechercher dans le cookbook)

  %% ---------- Cas : Commentateur ----------
  COM --> UC_comment(Commenter une recette)
  COM --> UC_chat(Participer à la messagerie du cookbook)

  %% ---------- Cas : Éditeur ----------
  EDI --> UC_add_recipe(Ajouter / modifier des recettes)
  EDI --> UC_link(Lier / retirer une recette du cookbook)
  EDI --> UC_categorize(Catégoriser / taguer)
  EDI --> UC_shopping(Générer une liste de courses)
  EDI --> UC_plan_cb(Planifier les repas du groupe)

  %% ---------- Cas : Créateur ----------
  CRE --> UC_invite(Inviter / gérer les membres)
  CRE --> UC_perms(Définir les permissions des membres)
  CRE --> UC_del_cb(Supprimer le cookbook)

  classDef ext fill:#F9F8FD,stroke:#FF6B4A,stroke-width:2px,color:#1A153B;
```

## Notes de conception

- **Espace personnel vs cookbook** : une recette appartient toujours à un **créateur**
  (`ownerId`) et peut être **liée à un ou plusieurs cookbooks** via la table de liaison
  `CookbookRecipe`. Aucune liaison → recette personnelle. **Retirer** une recette d'un
  cookbook supprime la liaison, **pas la recette**.
- Les permissions par rôle (Lecteur/Commentateur/Éditeur/Créateur) seront appliquées
  côté serveur par des **middlewares d'autorisation** (vérification du rôle dans la table
  `CookbookMembership`). Voir la matrice complète dans le dossier de conception.
- La **planification** peut être **personnelle ou de groupe** (`MealPlanEntry.cookbookId`
  nullable) → un cookbook familial partage son planning.
```
