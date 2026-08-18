import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { LoginPage } from './features/auth/LoginPage';
import { OAuthCallbackPage } from './features/auth/OAuthCallbackPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { CookbookLayout } from './features/cookbooks/CookbookLayout';
import { CookbookMembersTab } from './features/cookbooks/CookbookMembersTab';
import { CookbookRecipePage } from './features/cookbooks/CookbookRecipePage';
import { CookbookRecipesTab } from './features/cookbooks/CookbookRecipesTab';
import { CookbooksPage } from './features/cookbooks/CookbooksPage';
import { InvitationPage } from './features/cookbooks/InvitationPage';
import { DiscoverPage } from './features/discover/DiscoverPage';
import { ChatTab } from './features/messages/ChatTab';
import { PlanningPage } from './features/meal-plan/PlanningPage';
import { ShoppingListPage } from './features/shopping-lists/ShoppingListPage';
import { ShoppingListsPage } from './features/shopping-lists/ShoppingListsPage';
import { AccountTab } from './features/settings/AccountTab';
import { DataTab } from './features/settings/DataTab';
import { PreferencesTab } from './features/settings/PreferencesTab';
import { SettingsLayout } from './features/settings/SettingsLayout';
import { DiscoverRecipePage } from './features/discover/DiscoverRecipePage';
import { RecipeDetailPage } from './features/recipes/RecipeDetailPage';
import { RecipeEditPage } from './features/recipes/RecipeEditPage';
import { RecipeNewPage } from './features/recipes/RecipeNewPage';
import { RecipesPage } from './features/recipes/RecipesPage';
import { AdaptiveLayout } from './layout/AdaptiveLayout';
import { AppShell } from './layout/AppShell';
import { PublicLayout } from './layout/PublicLayout';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

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
      { path: '/discover', element: <DiscoverPage /> },
      { path: '/discover/:id', element: <DiscoverRecipePage /> },
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
          { path: '/cookbooks', element: <CookbooksPage /> },
          {
            path: '/cookbooks/:id',
            element: <CookbookLayout />,
            children: [
              { index: true, element: <CookbookRecipesTab /> },
              { path: 'membres', element: <CookbookMembersTab /> },
              { path: 'discussion', element: <ChatTab /> },
            ],
          },
          // Hors de la coque a onglets : la recette occupe l'ecran entier.
          { path: '/cookbooks/:id/recipes/:recipeId', element: <CookbookRecipePage /> },
          { path: '/invitations/:token', element: <InvitationPage /> },
          { path: '/planning', element: <PlanningPage /> },
          { path: '/shopping-lists', element: <ShoppingListsPage /> },
          { path: '/shopping-lists/:id', element: <ShoppingListPage /> },
          {
            path: '/settings',
            element: <SettingsLayout />,
            children: [
              { index: true, element: <AccountTab /> },
              { path: 'preferences', element: <PreferencesTab /> },
              { path: 'donnees', element: <DataTab /> },
            ],
          },
        ],
      },
    ],
  },
  {
    element: <PublicLayout />,
    children: [{ path: '*', element: <NotFoundPage /> }],
  },
]);
