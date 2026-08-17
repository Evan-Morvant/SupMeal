import { useAuth } from '../auth/auth-context';
import { PageLoader } from '../ui/Feedback';
import { AppShell } from './AppShell';
import { PublicLayout } from './PublicLayout';

/**
 * Coque des pages ouvertes aux deux publics — l'accueil et la decouverte.
 * Un visiteur y voit l'en-tete public ; quelqu'un de connecte y garde son
 * rail, sinon cliquer « Découvrir » le ferait sortir de son espace pour le
 * remettre devant une page d'accueil qui lui propose de creer un compte.
 */
export function AdaptiveLayout(): JSX.Element {
  const { status } = useAuth();

  if (status === 'loading') {
    return <PageLoader />;
  }
  return status === 'authenticated' ? <AppShell /> : <PublicLayout />;
}
