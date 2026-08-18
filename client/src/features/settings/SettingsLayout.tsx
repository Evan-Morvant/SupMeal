import { NavLink, Outlet } from 'react-router-dom';
import styles from './Settings.module.css';

/** Trois familles de réglages, en vraies routes pour rester partageables. */
export function SettingsLayout(): JSX.Element {
  return (
    <>
      <header className={styles.head}>
        <h1>Paramètres</h1>
        <p className={styles.lede}>Votre compte, vos goûts, et vos données.</p>
      </header>

      <nav className={styles.tabs} aria-label="Sections des paramètres">
        <NavLink to="/settings" end className={styles.tab}>
          Compte
        </NavLink>
        <NavLink to="/settings/preferences" className={styles.tab}>
          Préférences
        </NavLink>
        <NavLink to="/settings/donnees" className={styles.tab}>
          Données
        </NavLink>
      </nav>

      <Outlet />
    </>
  );
}
