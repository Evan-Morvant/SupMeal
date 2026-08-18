import { useCallback, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Icon, IconName } from '../ui/Icon';
import { AppHeader } from './AppHeader';
import styles from './AppShell.module.css';

/*
 * Coque de l'application connectée : rail latéral sur grand écran, barre
 * d'onglets en bas sur mobile — on cuisine avec le téléphone posé sur le plan
 * de travail, la navigation doit rester sous le pouce.
 */

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Libellé court : « Mes recettes » déborderait sur un cinquième de largeur. */
  tab?: string;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Accueil', icon: 'accueil' },
  { to: '/recipes', label: 'Mes recettes', icon: 'recettes', tab: 'Recettes' },
  { to: '/discover', label: 'Découvrir', icon: 'decouvrir', tab: 'Découvrir' },
  { to: '/cookbooks', label: 'Cookbooks', icon: 'cookbooks' },
  { to: '/planning', label: 'Planning', icon: 'planning', tab: 'Planning' },
  { to: '/shopping-lists', label: 'Courses', icon: 'courses', tab: 'Courses' },
];

const COLLAPSE_KEY = 'supmeal.railCollapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function AppShell(): JSX.Element {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleRail = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        /* ignoré : le repli reste valable le temps de la session */
      }
      return next;
    });
  }, []);

  return (
    <div className={styles.shell}>
      <AppHeader />

      <nav className={styles.rail} data-collapsed={collapsed} aria-label="Navigation principale">
        <div className={styles.nav}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={styles.item}
              title={collapsed ? item.label : undefined}
            >
              <Icon name={item.icon} />
              <span className={styles.itemLabel}>{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div className={styles.spacer} />

        <NavLink to="/settings" className={styles.item} title={collapsed ? 'Paramètres' : undefined}>
          <Icon name="reglages" />
          <span className={styles.itemLabel}>Paramètres</span>
        </NavLink>

        <button
          type="button"
          className={styles.railButton}
          onClick={toggleRail}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Déplier la navigation' : 'Replier la navigation'}
        >
          <Icon name="chevronGauche" size={20} className={styles.collapse} />
        </button>
      </nav>

      <main className={styles.content}>
        <div className={styles.inner}>
          <Outlet />
        </div>
      </main>

      <nav className={styles.tabbar} aria-label="Navigation">
        {NAV.filter((item) => item.tab !== undefined).map((item) => (
          <NavLink key={item.to} to={item.to} className={styles.tab}>
            <Icon name={item.icon} size={22} />
            {item.tab}
          </NavLink>
        ))}
        <NavLink to="/settings" className={styles.tab}>
          <Icon name="reglages" size={22} />
          Profil
        </NavLink>
      </nav>
    </div>
  );
}
