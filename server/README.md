# SUPMEAL — Serveur (API REST)

Node.js 20 + Express + Sequelize, en **TypeScript**. Porte **toute la logique métier**
(le client web ne fait qu'appeler cette API).

## Démarrage

```bash
cp .env.example .env     # renseigner DATABASE_URL et les secrets JWT
npm install
npm run dev              # http://localhost:4000/api/v1 (santé : /health)
```

| Script | Effet |
|---|---|
| `npm run dev` | Démarrage en watch (tsx) |
| `npm run build` | Compilation TypeScript → `dist/` |
| `npm start` | Exécution du build (`dist/index.js`) |
| `npm run typecheck` | Vérification de types sans émission |

## Architecture en couches

```
src/
├── index.ts              # Bootstrap : HTTP + Socket.io + connexion BDD
├── app.ts                # Application Express (middlewares globaux, montage des routes)
├── routes.ts             # Routeur racine /api/v1
├── config/
│   ├── env.ts            # Validation des variables d'env (Zod)
│   └── database.ts       # Instance Sequelize
├── common/
│   └── app-error.ts      # Erreur applicative typée
├── middlewares/
│   ├── authenticate.ts   # JWT Bearer → req.user
│   ├── require-role.ts   # Hiérarchie READER<COMMENTER<EDITOR<OWNER
│   ├── validate.ts       # Validation Zod du body
│   └── error-handler.ts  # 404 + format d'erreur uniforme
└── modules/              # Modules métier (un dossier par domaine)
    └── health/           # Exemple : GET /health
```

### Convention par module (à suivre en Phase 2)

Chaque domaine (`auth`, `users`, `recipes`, `cookbooks`, `meal-plan`, …) suit le même
découpage pour garantir modularité et absence de duplication :

```
modules/<domaine>/
├── <domaine>.routes.ts       # Définition des routes + middlewares
├── <domaine>.controller.ts   # Adaptation HTTP (req/res) → service
├── <domaine>.service.ts      # Logique métier (testable, sans HTTP)
├── <domaine>.model.ts        # Modèle(s) Sequelize
└── <domaine>.schema.ts       # Schémas Zod (validation)
```

Le contrat complet des endpoints : [`../docs/conception/06-api-endpoints.md`](../docs/conception/06-api-endpoints.md)
et [`openapi.yaml`](openapi.yaml), Swagger sur `/api/v1/swagger`.