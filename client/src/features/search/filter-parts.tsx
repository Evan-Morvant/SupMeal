import type { Tag } from '../../api/types';
import { ChipList, ChipToggle } from '../../ui/Chip';
import { Select } from '../../ui/Field';
import styles from './search.module.css';

/*
 * Morceaux de panneau partagés par la liste personnelle et la découverte, qui
 * n'acceptent pas les mêmes critères mais proposent les mêmes contrôles.
 */

/** On cherche « ce qui tient en vingt minutes », pas en dix-sept. */
const DURATIONS = [15, 30, 45, 60, 90];

export function DurationSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}): JSX.Element {
  return (
    <label className={styles.duration}>
      <span className={styles.groupTitle}>{label}</span>
      <Select
        value={value === undefined ? '' : String(value)}
        onChange={(event) =>
          onChange(event.target.value === '' ? undefined : Number(event.target.value))
        }
      >
        <option value="">Peu importe</option>
        {DURATIONS.map((minutes) => (
          <option key={minutes} value={minutes}>
            {minutes} min ou moins
          </option>
        ))}
      </Select>
    </label>
  );
}

export function DurationFilters({
  maxPrep,
  maxCook,
  onChange,
}: {
  maxPrep: number | undefined;
  maxCook: number | undefined;
  onChange: (values: { maxPrep?: number; maxCook?: number }) => void;
}): JSX.Element {
  return (
    <div className={styles.group}>
      <p className={styles.groupTitle}>Durées</p>
      <div className={styles.durations}>
        <DurationSelect
          label="Préparation"
          value={maxPrep}
          onChange={(value) => onChange({ maxPrep: value })}
        />
        <DurationSelect
          label="Cuisson"
          value={maxCook}
          onChange={(value) => onChange({ maxCook: value })}
        />
      </div>
      <p className={styles.groupNote}>
        Un filtre de durée écarte les recettes dont le temps n'est pas renseigné.
      </p>
    </div>
  );
}

export function TagFilter({
  tags,
  selected,
  onChange,
}: {
  tags: Tag[];
  selected: string[];
  onChange: (tags: string[]) => void;
}): JSX.Element | null {
  if (tags.length === 0) {
    return null;
  }
  return (
    <div className={styles.group}>
      <p className={styles.groupTitle}>Tags</p>
      <div className={styles.tagList}>
        <ChipList>
          {tags.map((tag) => {
            const on = selected.includes(tag.name);
            return (
              <ChipToggle
                key={tag.id}
                label={tag.name}
                selected={on}
                onToggle={() =>
                  onChange(
                    on ? selected.filter((name) => name !== tag.name) : [...selected, tag.name],
                  )
                }
              />
            );
          })}
        </ChipList>
      </div>
      <p className={styles.groupNote}>Cumulés : les tags s'additionnent.</p>
    </div>
  );
}

export interface SortOption {
  value: string;
  label: string;
}

export function SortSelect({
  options,
  value,
  onChange,
}: {
  options: SortOption[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}): JSX.Element {
  return (
    <Select
      className={styles.sort}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value === '' ? undefined : event.target.value)}
      aria-label="Ordre de tri"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

export { styles as searchStyles };
