import { Link, Outlet } from 'react-router-dom';
import { useIsFetching } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { buttonClass } from '../ui/Button';
import { Logo } from '../ui/Logo';
import styles from './PublicLayout.module.css';

/**
 * Coque des pages ouvertes aux visiteurs. Pas de rail : montrer sept sections
 * dont aucune n'est accessible n'avancerait personne.
 */
export function PublicLayout(): JSX.Element {
  const { status } = useAuth();
  const busy = useIsFetching() > 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          <Logo variant="lockup" size={36} spinning={busy} hoverable />
        </Link>
        <div className={styles.spacer} />
        <div className={styles.actions}>
          {status === 'authenticated' ? (
            <Link to="/recipes" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
              Mon espace
            </Link>
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

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>SUPMEAL — recettes et planification de repas</footer>
    </div>
  );
}
