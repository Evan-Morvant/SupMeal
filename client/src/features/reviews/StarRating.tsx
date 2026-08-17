import { useId, useState } from 'react';
import { Icon } from '../../ui/Icon';
import styles from './StarRating.module.css';

const SCALE = [1, 2, 3, 4, 5];

/** Note figée d'un avis déjà déposé. */
export function StarDisplay({ rating, size = 16 }: { rating: number; size?: number }): JSX.Element {
  return (
    <span className={styles.stars} role="img" aria-label={rating + ' sur 5'}>
      {SCALE.map((value) => (
        <Icon
          key={value}
          name="etoile"
          size={size}
          filled={value <= rating}
          className={value <= rating ? styles.on : styles.star}
        />
      ))}
    </span>
  );
}

/**
 * Saisie de la note. Cinq boutons radio d'un même groupe, habillés en étoiles :
 * le clavier, les flèches et les lecteurs d'écran fonctionnent sans qu'on ait
 * à les réimplémenter, ce qu'une rangée de `<button>` aurait imposé.
 */
export function StarInput({
  value,
  onChange,
  label = 'Votre note',
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}): JSX.Element {
  const name = useId();
  // Le survol montre la note qu'on s'apprête à donner, pas celle déjà choisie.
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? value;

  return (
    <fieldset className={styles.stars} onMouseLeave={() => setPreview(null)}>
      <legend className="srOnly">{label}</legend>
      {SCALE.map((option) => (
        <span
          key={option}
          className={[styles.option, option <= shown ? styles.optionOn : '']
            .filter(Boolean)
            .join(' ')}
          onMouseEnter={() => setPreview(option)}
        >
          <input
            className={styles.input}
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            aria-label={option + ' sur 5'}
          />
          <span className={styles.icon}>
            <Icon name="etoile" size={26} filled={option <= shown} />
          </span>
        </span>
      ))}
      <span className={styles.value}>{shown > 0 ? shown + ' / 5' : 'Non noté'}</span>
    </fieldset>
  );
}
