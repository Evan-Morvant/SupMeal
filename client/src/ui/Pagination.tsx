import { Button } from './Button';
import { Icon } from './Icon';
import styles from './Pagination.module.css';

/**
 * Pagination à deux flèches. L'API plafonne `page` à 10 000, mais la vraie
 * borne est le total : c'est lui qui décide si « suivant » a un sens.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}): JSX.Element | null {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) {
    return null;
  }

  return (
    <nav className={styles.wrap} aria-label="Pagination">
      <Button
        variant="outline"
        size="sm"
        iconOnly
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Page précédente"
      >
        <Icon name="chevronGauche" size={18} />
      </Button>
      <p className={styles.status} aria-live="polite">
        Page <span className={styles.page}>{page}</span> sur{' '}
        <span className={styles.page}>{lastPage}</span>
        {' — '}
        <span className={styles.page}>{total}</span> recette{total > 1 ? 's' : ''}
      </p>
      <Button
        variant="outline"
        size="sm"
        iconOnly
        disabled={page >= lastPage}
        onClick={() => onChange(page + 1)}
        aria-label="Page suivante"
      >
        <Icon name="chevronDroite" size={18} />
      </Button>
    </nav>
  );
}
