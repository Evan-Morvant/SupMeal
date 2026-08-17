import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { toApiError } from './api/errors';
import { AuthProvider } from './auth/AuthProvider';
import { router } from './routes';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Les recettes bougent peu : pas de rechargement au retour d'onglet.
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = toApiError(error).status;
        // Un 4xx ne s'améliore pas en insistant ; une panne réseau, parfois.
        return status >= 500 || status === 0 ? failureCount < 2 : false;
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
