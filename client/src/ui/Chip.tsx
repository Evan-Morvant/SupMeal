import { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './Chip.module.css';

/** Étiquette compacte : tag, ingrédient, critère actif. */
export function Chip({ children }: { children: ReactNode }): JSX.Element {
  return <span className={styles.chip}>{children}</span>;
}

/**
 * Puce de filtre. `aria-pressed` plutôt qu'une classe seule : l'état
 * sélectionné doit être annoncé, pas seulement coloré.
 */
export function ChipToggle({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className={[styles.chip, styles.selectable, selected ? styles.selected : '']
        .filter(Boolean)
        .join(' ')}
      aria-pressed={selected}
      onClick={onToggle}
    >
      {label}
    </button>
  );
}

/** Jeton retirable, tel qu'en produit une saisie multivaleur. */
export function ChipToken({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}): JSX.Element {
  return (
    <span className={styles.chip}>
      {label}
      <button
        type="button"
        className={styles.remove}
        onClick={onRemove}
        aria-label={'Retirer ' + label}
      >
        <Icon name="fermer" size={12} />
      </button>
    </span>
  );
}

export function ChipList({ children }: { children: ReactNode }): JSX.Element {
  return <div className={styles.list}>{children}</div>;
}
