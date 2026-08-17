import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChipList, ChipToken } from './Chip';
import { Input } from './Field';
import { Logo } from './Logo';
import styles from './TokenInput.module.css';

/*
 * Saisie multivaleur avec suggestions, employée pour les ingrédients comme pour
 * les tags. Les propositions viennent de l'appelant, qui sait où les chercher.
 */

interface TokenInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  /** Propositions déjà chargées, dans l'ordre d'affichage voulu. */
  suggestions?: string[];
  /** Prévient du texte tapé, pour aller chercher les suggestions. */
  onQueryChange?: (query: string) => void;
  loading?: boolean;
  placeholder?: string;
  hint?: string;
  /** Nombre maximal de valeurs, quand l'API en impose une borne. */
  max?: number;
  id?: string;
}

/** Comparaison des valeurs déjà retenues : « Dessert » et « dessert » sont un. */
function sameValue(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function TokenInput({
  label,
  values,
  onChange,
  suggestions = [],
  onQueryChange,
  loading = false,
  placeholder,
  hint,
  max,
  id,
}: TokenInputProps): JSX.Element {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const listId = fieldId + '-list';
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const full = max !== undefined && values.length >= max;

  /** Ce qui reste à proposer : le déjà retenu n'a plus rien à faire là. */
  const available = useMemo(
    () => suggestions.filter((option) => !values.some((value) => sameValue(value, option))),
    [suggestions, values],
  );

  // Un clic ailleurs referme la liste : sans cela elle resterait ouverte
  // au-dessus du reste du formulaire.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent): void => {
      if (wrapRef.current?.contains(event.target as Node) === false) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function commit(raw: string): void {
    const value = raw.trim();
    setQuery('');
    onQueryChange?.('');
    setActive(-1);
    setOpen(false);
    if (value === '' || full || values.some((existing) => sameValue(existing, value))) {
      return;
    }
    onChange([...values, value]);
  }

  function handleQuery(next: string): void {
    // La virgule vaut validation : coller « tomate, basilic » remplit deux
    // jetons au lieu d'un seul jeton absurde.
    if (next.includes(',')) {
      const parts = next.split(',');
      const last = parts.pop() ?? '';
      parts.forEach(commit);
      setQuery(last);
      onQueryChange?.(last);
      return;
    }
    setQuery(next);
    onQueryChange?.(next);
    setOpen(next.trim().length > 0);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(active >= 0 && active < available.length ? available[active] : query);
      return;
    }
    if (event.key === 'Backspace' && query === '' && values.length > 0) {
      onChange(values.slice(0, -1));
      return;
    }
    if (event.key === 'ArrowDown' && available.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActive((current) => (current + 1) % available.length);
      return;
    }
    if (event.key === 'ArrowUp' && available.length > 0) {
      event.preventDefault();
      setActive((current) => (current <= 0 ? available.length - 1 : current - 1));
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  const showList = open && (available.length > 0 || (query.trim().length > 0 && !loading));

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <label className="srOnly" htmlFor={fieldId}>
        {label}
      </label>

      {values.length > 0 && (
        <ChipList>
          {values.map((value) => (
            <ChipToken
              key={value}
              label={value}
              onRemove={() => onChange(values.filter((kept) => kept !== value))}
            />
          ))}
        </ChipList>
      )}

      <div className={styles.field}>
        <Input
          id={fieldId}
          value={query}
          onChange={(event) => handleQuery(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(query.trim().length > 0)}
          placeholder={full ? label + ' : maximum atteint' : placeholder}
          disabled={full}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? listId + '-' + active : undefined}
          aria-describedby={hint === undefined ? undefined : fieldId + '-hint'}
        />
        {loading && <Logo className={styles.loading} size={18} spinning decorative mono />}

        {showList && (
          <ul className={styles.list} id={listId} role="listbox" aria-label={label}>
            {available.map((option, index) => (
              <li
                key={option}
                id={listId + '-' + index}
                role="option"
                aria-selected={index === active}
                className={[styles.option, index === active ? styles.active : '']
                  .filter(Boolean)
                  .join(' ')}
                // Le pointeur ne doit pas voler le focus au champ de saisie.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(option)}
              >
                {option}
              </li>
            ))}
            {available.length === 0 && (
              <li className={styles.empty}>
                Aucune correspondance — Entrée pour ajouter « {query.trim()} »
              </li>
            )}
          </ul>
        )}
      </div>

      {hint !== undefined && (
        <p className={styles.empty} id={fieldId + '-hint'}>
          {hint}
        </p>
      )}
    </div>
  );
}
