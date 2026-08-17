import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './features/auth/LoginPage';
import { OAuthCallbackPage } from './features/auth/OAuthCallbackPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { RecipeDetailPage } from './features/recipes/RecipeDetailPage';
import { RecipeEditPage } from './features/recipes/RecipeEditPage';
import { RecipeNewPage } from './features/recipes/RecipeNewPage';
import { RecipesPage } from './features/recipes/RecipesPage';
import { AdaptiveLayout } from './layout/AdaptiveLayout';
import { AppShell } from './layout/AppShell';
import { PublicLayout } from './layout/PublicLayout';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlaceholderPage } from './pages/PlaceholderPage';

/*
 * Trois familles de routes, et donc trois coques :
 *   - AdaptiveLayout : ouvertes à tous, mais affichées dans le rail une fois
 *     connecté (accueil, découverte) ;
 *   - PublicLayout : les portes d'entrée, qui n'ont pas à montrer de rail ;
 *   - RequireAuth + AppShell : l'espace personnel.
 */
export const router = createBrowserRouter([
  {
    element: <AdaptiveLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/discover', element: <PlaceholderPage title="Découvrir" /> },
      { path: '/discover/:id', element: <PlaceholderPage title="Recette publique" /> },
    ],
  },
  {
    element: <PublicLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/oauth/callback', element: <OAuthCallbackPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/recipes', element: <RecipesPage /> },
          // Déclarée avant `/recipes/:id`, qui capterait sinon « new » comme
          // un identifiant — le même piège que côté API avec « suggestions ».
          { path: '/recipes/new', element: <RecipeNewPage /> },
          { path: '/recipes/:id', element: <RecipeDetailPage /> },
          { path: '/recipes/:id/edit', element: <RecipeEditPage /> },
          { path: '/cookbooks', element: <PlaceholderPage title="Cookbooks" /> },
          { path: '/planning', element: <PlaceholderPage title="Planning" /> },
          { path: '/shopping-lists', element: <PlaceholderPage title="Listes de courses" /> },
          { path: '/settings', element: <PlaceholderPage title="Paramètres" /> },
        ],
      },
    ],
  },
  {
    element: <PublicLayout />,
    children: [{ path: '*', element: <NotFoundPage /> }],
  },
]);
