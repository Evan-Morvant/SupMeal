import { Icon } from './Icon';
import styles from './Rating.module.css';

/**
 * Note moyenne d'une recette. `avgRating` vaut `null` tant que personne n'a
 * noté : afficher 0 sur 5 serait un mensonge, une recette sans avis n'est pas
 * une mauvaise recette.
 */
export function Rating({
  avgRating,
  reviewCount,
}: {
  avgRating: number | null;
  reviewCount: number;
}): JSX.Element {
  if (avgRating === null) {
    return <span className={styles.unrated}>Pas encore d'avis</span>;
  }
  return (
    <span
      className={styles.rating}
      title={reviewCount + ' avis, moyenne de ' + avgRating.toFixed(1) + ' sur 5'}
    >
      <Icon name="etoile" size={15} filled className={styles.star} />
      <span className={styles.value}>{avgRating.toFixed(1)}</span>
      <span className={styles.count}>({reviewCount})</span>
    </span>
  );
}
