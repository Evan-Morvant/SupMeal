# SUPMEAL — Diagramme de classes (modèle de domaine)

C'est la pièce centrale : le schéma de base de données et les diagrammes de séquence
en découlent directement.

```mermaid
classDiagram
  direction LR

  class User {
    +UUID id
    +string email
    +string passwordHash  «null si OAuth seul»
    +string displayName
    +string avatarUrl
    +datetime createdAt
    +datetime updatedAt
  }

  class UserPreferences {
    +UUID id
    +string[] diets        «régimes alimentaires»
    +string[] allergies
    +string[] preferredCuisines
    +int defaultServings
  }

  class OAuthAccount {
    +UUID id
    +enum provider  «google|github»
    +string providerUserId
    +datetime createdAt
  }

  class Cookbook {
    +UUID id
    +string name
    +string description
    +datetime createdAt
    +datetime updatedAt
  }

  class CookbookMembership {
    +UUID id
    +enum role  «OWNER|EDITOR|COMMENTER|READER»
    +datetime joinedAt
  }

  class CookbookInvitation {
    +UUID id
    +string invitedEmail
    +enum role
    +string token
    +enum status  «pending|accepted|declined»
    +datetime createdAt
  }

  class Recipe {
    +UUID id
    +string title
    +string description
    +int prepTimeMin
    +int cookTimeMin
    +int servings
    +string imageUrl
    +string source       «URL ou 'user'»
    +enum visibility     «private|public»
    +tsvector searchVector  «index full-text»
    +datetime createdAt
    +datetime updatedAt
    +float avgRating     «calculé depuis Review»
    +int reviewCount     «calculé»
  }

  class CookbookRecipe {
    +UUID id
    +datetime addedAt
    «liaison N–N : retirer ≠ supprimer la recette»
  }

  class RecipeStep {
    +UUID id
    +int position
    +string instruction
  }

  class Ingredient {
    +UUID id
    +string name  «normalisé, unique»
  }

  class RecipeIngredient {
    +UUID id
    +decimal quantity
    +string unit
    +string note
    +int position
  }

  class Tag {
    +UUID id
    +string name
    +enum type  «cuisine|diet|difficulty|course|custom»
  }

  class Favorite {
    +UUID id
    +datetime createdAt
  }

  class MealPlanEntry {
    +UUID id
    +date date
    +enum mealType  «petit-déjeuner|déjeuner|dîner|collation»
    +int servings
    «cookbookId nullable = planning de groupe»
  }

  class Comment {
    +UUID id
    +string content
    +datetime createdAt
    +datetime updatedAt
    «privé : rattaché à un cookbook»
  }

  class Review {
    +UUID id
    +int rating       «1..5 étoiles»
    +string body      «texte optionnel»
    +datetime createdAt
    +datetime updatedAt
    «public : 1 avis / user / recette»
  }

  class Message {
    +UUID id
    +string content
    +datetime createdAt
  }

  class ShoppingList {
    +UUID id
    +string name
    +date fromDate
    +date toDate
    +datetime createdAt
    «générée depuis le planning»
  }

  class ShoppingListItem {
    +UUID id
    +decimal quantity
    +string unit
    +boolean checked
  }

  %% ---------- Relations utilisateur ----------
  User "1" --> "0..1" UserPreferences : possède
  User "1" --> "0..*" OAuthAccount : lie
  User "1" --> "0..*" Recipe : crée (owner)
  User "1" --> "0..*" Favorite : marque
  Recipe "1" --> "0..*" Favorite
  User "1" --> "0..*" MealPlanEntry : planifie
  Recipe "1" --> "0..*" MealPlanEntry
  User "1" --> "0..*" Comment : écrit
  Recipe "1" --> "0..*" Comment : reçoit
  User "1" --> "0..*" Review : note
  Recipe "1" --> "0..*" Review : évaluée
  User "1" --> "0..*" Message : envoie
  User "1" --> "0..*" CookbookRecipe : a ajouté

  %% ---------- Relations cookbook ----------
  Cookbook "1" --> "1..*" CookbookMembership : regroupe
  User "1" --> "0..*" CookbookMembership : appartient à
  Cookbook "1" --> "0..*" CookbookInvitation : émet
  Cookbook "1" --> "0..*" Message : héberge le chat
  Cookbook "1" --> "0..*" Comment : contextualise (privé)
  Cookbook "1" --> "0..*" MealPlanEntry : planning de groupe
  Cookbook "1" --> "0..*" ShoppingList : possède

  %% ---------- Liaison N–N recette / cookbook ----------
  Cookbook "1" --> "0..*" CookbookRecipe
  Recipe "1" --> "0..*" CookbookRecipe

  %% ---------- Composition recette ----------
  Recipe "1" --> "1..*" RecipeStep : décrit
  Recipe "1" --> "1..*" RecipeIngredient
  Ingredient "1" --> "0..*" RecipeIngredient : référencé par
  Recipe "*" --> "*" Tag : catégorisé par

  %% ---------- Liste de courses ----------
  ShoppingList "1" --> "1..*" ShoppingListItem
  Ingredient "1" --> "0..*" ShoppingListItem : agrège
```

## Choix de modélisation (à justifier dans la doc technique)

| Décision | Justification |
|---|---|
| **`CookbookRecipe` (liaison N–N)** | Une recette a un **créateur unique** (`ownerId`) et existe indépendamment ; elle peut être **partagée dans plusieurs cookbooks**. Retirer une recette d'un cookbook = supprimer la ligne de liaison, **sans détruire la recette**. Couvre aussi le cas « recette personnelle » = aucune liaison. |
| `RecipeIngredient` comme classe-association | Stocke **quantité + unité** propres au couple (recette, ingrédient), avec une table `Ingredient` **normalisée et unique** → recherche par ingrédient optimisée, sans duplication. |
| `Ingredient` séparé | « farine » partagée par toutes les recettes → index unique, filtrage rapide, agrégation pour la liste de courses. |
| `searchVector` (tsvector) sur `Recipe` | **Recherche plein texte native PostgreSQL** (titre + description + ingrédients) avec index GIN. |
| `CookbookMembership.role` | Implémente les 4 rôles **OWNER/EDITOR/COMMENTER/READER** (un membre = un rôle par cookbook). Permissions appliquées par middleware serveur. |
| `MealPlanEntry.cookbookId` **nullable** | `null` = planning personnel ; renseigné = **planning de groupe** partagé (ex. cookbook familial). |
| `Message` (chat cookbook) ≠ `Comment` (par recette) | Deux besoins distincts : messagerie instantanée de groupe vs commentaire ciblé. |
| **`Comment` rattaché au cookbook** (`cookbookId`) | Les conseils restent **privés au groupe** : pas de fuite inter-cookbooks quand une recette est partagée dans plusieurs cookbooks. Permission via `requireRole(COMMENTER)`. |
| **`Review` (avis) ≠ `Comment`** | L'avis est **public** (visible partout où la recette l'est), porte une note `1..5` + texte, `UNIQUE(recipe, user)`. Alimente `avgRating` (base de suggestions). Distinct de la discussion privée du cookbook. |
| **`Recipe.visibility`** `private`\|`public` | `private` (défaut) = créateur + membres des cookbooks ; `public` = visible de tous + page de **découverte**. Bascule réservée au créateur. *(Bonus — à implémenter en dernier.)* |
| `ShoppingList` / `ShoppingListItem` *(bonus)* | **Générées depuis le planning** sur une plage de dates : agrégation des `RecipeIngredient` par ingrédient/unité, avec cases à cocher. |
| `RecipeStep.position` | Étapes ordonnées et réordonnables. |
```
