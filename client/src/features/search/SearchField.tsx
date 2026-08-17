import { useEffect, useRef, useState } from 'react';
import { Input } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { useDebounce } from '../../hooks/useDebounce';
import styles from './search.module.css';

interface SearchFieldProps {
  /** Valeur portée par l'URL, source de vérité. */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder: string;
  label: string;
}

/**
 * La frappe est immédiate à l'écran, retardée dans l'URL. `pushed` retient ce
 * qu'on y a écrit : sans ce repère, taper « abc » vite pousse « ab », que le
 * retour de l'URL remettrait dans le champ.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: SearchFieldProps): JSX.Element {
  const [draft, setDraft] = useState(value ?? '');
  const settled = useDebounce(draft, 350);
  const pushed = useRef<string | null>(value ?? '');

  useEffect(() => {
    if (settled !== (value ?? '')) {
      pushed.current = settled;
      onChange(settled === '' ? undefined : settled);
    }
  }, [settled, value, onChange]);

  // Changement venu d'ailleurs : bouton « Effacer », retour arrière, lien reçu.
  useEffect(() => {
    const fromUrl = value ?? '';
    if (fromUrl !== pushed.current) {
      pushed.current = fromUrl;
      setDraft(fromUrl);
    }
  }, [value]);

  return (
    <div className={styles.search}>
      <Icon name="decouvrir" size={22} className={styles.searchIcon} />
      <Input
        className={styles.searchInput}
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
    </div>
  );
}
