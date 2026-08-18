import { Link, Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import styles from './PublicLayout.module.css';

/**
 * Coque des pages ouvertes aux visiteurs. Pas de rail : montrer sept sections
 * dont aucune n'est accessible n'avancerait personne.
 */
export function PublicLayout(): JSX.Element {
  return (
    <div className={styles.page}>
      <AppHeader />

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        SUPMEAL — recettes et planification de repas ·{' '}
        <Link to="/cgu">Conditions d'utilisation</Link>
      </footer>
    </div>
  );
}
