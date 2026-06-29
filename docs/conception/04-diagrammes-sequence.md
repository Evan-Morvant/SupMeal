# SUPMEAL — Diagrammes de séquence

Flux clés de l'application. Tous passent par l'API REST (le client web ne contient
aucune logique métier).

## 1. Connexion via OAuth2 (ex. Google)

```mermaid
sequenceDiagram
  actor U as Utilisateur
  participant C as Client React
  participant A as API Express
  participant O as Service OAuth2
  participant DB as PostgreSQL

  U->>C: Clic « Se connecter avec Google »
  C->>A: GET /auth/oauth/google
  A-->>C: Redirection (URL d'autorisation + state)
  C->>O: Redirection navigateur
  O->>U: Demande de consentement
  U->>O: Autorise
  O-->>A: GET /auth/oauth/google/callback?code
  A->>O: Échange code → access_token
  O-->>A: Profil (id, email, nom)
  A->>DB: Cherche OAuthAccount / User
  alt Compte inexistant
    A->>DB: Crée User + OAuthAccount
  end
  A-->>C: JWT (access + refresh)
  C->>C: Stocke le token, redirige vers l'app
```

## 2. Ajout d'une recette dans un cookbook (avec contrôle de permission)

```mermaid
sequenceDiagram
  actor U as Utilisateur
  participant C as Client React
  participant A as API Express
  participant MW as Middleware Auth/Rôle
  participant DB as PostgreSQL

  U->>C: Remplit le formulaire de recette
  C->>A: POST /cookbooks/:id/recipes (JWT + payload)
  A->>MW: Vérifie JWT + rôle dans CookbookMembership
  alt Rôle insuffisant (READER/COMMENTER)
    MW-->>C: 403 Forbidden
  else Rôle EDITOR/OWNER
    A->>DB: BEGIN
    A->>DB: INSERT Recipe (owner_id = user)
    A->>DB: UPSERT Ingredient(s) + INSERT RecipeIngredient
    A->>DB: INSERT RecipeStep(s) + RECIPE_TAG
    A->>DB: INSERT CookbookRecipe (liaison recette ↔ cookbook)
    A->>DB: MAJ search_vector
    A->>DB: COMMIT
    A-->>C: 201 Created (recette)
    C-->>U: Affiche la recette créée
  end
```

## 3. Recherche plein texte + filtres

```mermaid
sequenceDiagram
  actor U as Utilisateur
  participant C as Client React
  participant A as API Express
  participant DB as PostgreSQL

  U->>C: Saisit « poulet curry » + filtre tags/temps/favoris
  C->>A: GET /recipes?q=poulet+curry&tags=...&maxPrep=30&favorite=true
  A->>A: Valide & construit la requête (couche service)
  A->>DB: SELECT ... WHERE search_vector @@ to_tsquery('poulet & curry')
  Note over A,DB: + jointures tags / ingrédients / favoris<br/>+ ts_rank pour le tri par pertinence
  DB-->>A: Recettes paginées + classées
  A-->>C: 200 OK (résultats)
  C-->>U: Affiche la liste filtrée
```

## 4. Messagerie instantanée du cookbook (WebSocket)

```mermaid
sequenceDiagram
  actor A1 as Membre A
  actor A2 as Membre B
  participant C as Client React
  participant WS as Serveur Socket.io
  participant MW as Middleware Auth/Rôle
  participant DB as PostgreSQL

  A1->>WS: connect (JWT) + join room cookbook:id
  WS->>MW: Vérifie membership (>= COMMENTER)
  A2->>WS: connect (JWT) + join room cookbook:id
  A1->>WS: emit message { content }
  WS->>DB: INSERT Message
  WS-->>A1: broadcast message (room)
  WS-->>A2: broadcast message (room)
```

## 5. Import / Export de données

```mermaid
sequenceDiagram
  actor U as Utilisateur
  participant C as Client React
  participant A as API Express
  participant DB as PostgreSQL

  rect rgb(249,248,253)
  note right of U: Export
  U->>C: Clic « Exporter » (+ avertissement données en clair)
  C->>A: GET /export?format=json
  A->>DB: SELECT recettes + cookbooks de l'utilisateur
  A->>A: Sérialise (JSON / CSV / format Mealie)
  A-->>C: Fichier téléchargeable
  end

  rect rgb(255,237,232)
  note right of U: Import
  U->>C: Dépose un fichier (JSON/CSV/Mealie)
  C->>A: POST /import (multipart)
  A->>A: Parse + valide le schéma
  A->>DB: Crée recettes/cookbooks (importeur = créateur)
  A-->>C: Rapport d'import (créés / ignorés / erreurs)
  end
```
