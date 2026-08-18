import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useIsFetching } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { Avatar } from '../ui/Avatar';
import { buttonClass } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import styles from './AppHeader.module.css';

/**
 * En-tête commun à tous les écrans. Il dit **qui** est là et **où** l'on est ;
 * le rail et la barre d'onglets disent où aller. Sans lui, la coque connectée
 * n'offrait ni marque ni déconnexion dès que le rail cédait la place, sur
 * téléphone.
 */
export function AppHeader(): JSX.Element {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();
  // La marque est l'indicateur de chargement : sa couronne tourne tant qu'une
  // requête est en vol.
  const busy = useIsFetching() > 0;

  const signOut = useCallback(async () => {
    await logout();
    navigate('/', { replace: true });
  }, [logout, navigate]);

  return (
    <header className={styles.header}>
      <Link to="/" className={styles.brand} aria-label="SUPMEAL, accueil">
        <Logo
          variant="lockup"
          size={36}
          spinning={busy}
          hoverable
          wordClassName={styles.brandWord}
        />
      </Link>

      <span className={styles.spacer} />

      <div className={styles.actions}>
        {status === 'authenticated' && user !== null ? (
          <div className={styles.account}>
            <span className={styles.name}>{user.displayName}</span>
            <Avatar displayName={user.displayName} avatarUrl={user.avatarUrl} size={34} />
            {/* Le nom accessible est porté par le bouton, non par l'icône. */}
            <button
              type="button"
              className={styles.logout}
              onClick={() => void signOut()}
              aria-label="Se déconnecter"
            >
              <Icon name="deconnexion" size={20} />
            </button>
          </div>
        ) : (
          <>
            <Link to="/login" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
              Se connecter
            </Link>
            <Link to="/register" className={buttonClass({ variant: 'primary', size: 'sm' })}>
              Créer un compte
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
