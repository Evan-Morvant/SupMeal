import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageLoader } from '../ui/Feedback';
import { useAuth } from './auth-context';

/**
 * Garde des routes privées. L'adresse demandée est conservée dans l'état de
 * navigation, pour y revenir une fois connecté plutôt que sur l'accueil.
 */
export function RequireAuth(): JSX.Element {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <PageLoader label="Reprise de votre session…" />;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }
  return <Outlet />;
}
