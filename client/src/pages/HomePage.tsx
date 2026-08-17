import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { buttonClass } from '../ui/Button';
import styles from './HomePage.module.css';

/*
 * Accueil. Version d'attente : le lot 3 y branchera les suggestions pour
 * quelqu'un de connecte et la decouverte triee par note pour un visiteur.
 */
export function HomePage(): JSX.Element {
  const { status } = useAuth();

  return (
    <section className={styles.hero}>
      <h1 className={styles.title}>
        Vos recettes, <span className={styles.accent}>rassemblées</span>.
      </h1>
      <p className={styles.lede}>
        Gardez vos recettes au même endroit, partagez-les dans un cookbook et planifiez la
        semaine sans y repenser trois fois.
      </p>
      <div className={styles.actions}>
        {status === 'authenticated' ? (
          <Link to="/recipes" className={buttonClass()}>
            Voir mes recettes
          </Link>
        ) : (
          <>
            <Link to="/register" className={buttonClass()}>
              Créer un compte
            </Link>
            <Link to="/discover" className={buttonClass({ variant: 'outline' })}>
              Parcourir les recettes publiques
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
