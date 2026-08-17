import { useEffect, useRef, useState } from 'react';
import type { RecipeFilters as Criteria } from '../../api/types';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ChipList, ChipToggle } from '../../ui/Chip';
import { Input, Select } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { TokenInput } from '../../ui/TokenInput';
import { useIngredientSearch, useTags } from '../catalog/catalog.hooks';
import { useDebounce } from '../../hooks/useDebounce';
import type { RecipeFiltersState } from './useRecipeFilters';
import styles from './RecipeFilters.module.css';

/*
 * Barre de recherche et panneau de critères de la liste personnelle. Les durées
 * sont proposées par paliers plutôt qu'en minutes libres : on cherche « ce qui
 * tient en vingt minutes », pas en dix-sept.
 */

const DURATIONS = [15, 30, 45, 60, 90];

/** Ordre de tri, avec le libellé que comprend quelqu'un qui cherche. */
const SORTS: { value: string; label: string }[] = [
  { value: '', label: 'Tri automatique' },
  { value: 'recent', label: 'Plus récentes' },
  { value: 'prepTime', label: 'Préparation la plus courte' },
  { value: 'relevance', label: 'Pertinence' },
];

function DurationSelect({
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

export function RecipeFilters({ state }: { state: RecipeFiltersState }): JSX.Element {
  const { filters, patch, clear, activeCount } = state;
  const [open, setOpen] = useState(activeCount > 0);

  /*
   * La frappe est immédiate à l'écran et retardée dans l'URL, sans quoi chaque
   * lettre remplirait l'historique du navigateur. `pushed` retient ce que la
   * saisie y a écrit : sans ce repère, taper « abc » vite pousse « ab », que le
   * retour de l'URL remettrait dans le champ.
   */
  const [draft, setDraft] = useState(filters.q ?? '');
  const settled = useDebounce(draft, 350);
  const pushed = useRef<string | null>(filters.q ?? '');

  useEffect(() => {
    if (settled !== (filters.q ?? '')) {
      pushed.current = settled;
      patch({ q: settled === '' ? undefined : settled }, { replace: true });
    }
  }, [settled, filters.q, patch]);

  // Changement venu d'ailleurs : bouton « Effacer », retour arrière, lien reçu.
  useEffect(() => {
    const fromUrl = filters.q ?? '';
    if (fromUrl !== pushed.current) {
      pushed.current = fromUrl;
      setDraft(fromUrl);
    }
  }, [filters.q]);

  const [ingredientQuery, setIngredientQuery] = useState('');
  const ingredients = useIngredientSearch(ingredientQuery);
  // Périmètre restreint : une puce qui ne peut donner aucun résultat n'a rien
  // à faire dans un filtre.
  const tags = useTags({ mine: true });

  return (
    <section>
      <div className={styles.bar}>
        <div className={styles.search}>
          <Icon name="decouvrir" size={22} className={styles.searchIcon} />
          <Input
            className={styles.searchInput}
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Rechercher un titre, une description, un ingrédient"
            aria-label="Rechercher dans mes recettes"
          />
        </div>

        <Select
          className={styles.sort}
          value={filters.sort ?? ''}
          onChange={(event) =>
            patch({
              sort:
                event.target.value === ''
                  ? undefined
                  : (event.target.value as Criteria['sort']),
            })
          }
          aria-label="Ordre de tri"
        >
          {SORTS.map((sort) => (
            <option key={sort.value} value={sort.value}>
              {sort.label}
            </option>
          ))}
        </Select>

        <Button
          variant={open ? 'secondary' : 'outline'}
          onClick={() => setOpen((previous) => !previous)}
          aria-expanded={open}
        >
          <Icon name="filtres" size={20} />
          Filtres
          {activeCount > 0 && <span className={styles.count}>{activeCount}</span>}
        </Button>
      </div>

      {open && (
        <Card className={styles.panel}>
          <div className={styles.group}>
            <p className={styles.groupTitle}>Ingrédients</p>
            <TokenInput
              label="Filtrer par ingrédients"
              values={filters.ingredients}
              onChange={(values) => patch({ ingredients: values })}
              suggestions={(ingredients.data ?? []).map((item) => item.name)}
              onQueryChange={setIngredientQuery}
              loading={ingredients.isFetching}
              placeholder="tomate, basilic…"
              hint="Cumulés : une recette doit contenir tous les ingrédients listés."
              max={20}
            />
          </div>

          {tags.data !== undefined && tags.data.length > 0 && (
            <div className={styles.group}>
              <p className={styles.groupTitle}>Tags</p>
              <div className={styles.tagList}>
                <ChipList>
                  {tags.data.map((tag) => {
                    const selected = filters.tags.includes(tag.name);
                    return (
                      <ChipToggle
                        key={tag.id}
                        label={tag.name}
                        selected={selected}
                        onToggle={() =>
                          patch({
                            tags: selected
                              ? filters.tags.filter((name) => name !== tag.name)
                              : [...filters.tags, tag.name],
                          })
                        }
                      />
                    );
                  })}
                </ChipList>
              </div>
              <p className={styles.groupNote}>Cumulés également : les tags s'additionnent.</p>
            </div>
          )}

          <div className={styles.group}>
            <p className={styles.groupTitle}>Durées</p>
            <div className={styles.durations}>
              <DurationSelect
                label="Préparation"
                value={filters.maxPrep}
                onChange={(value) => patch({ maxPrep: value })}
              />
              <DurationSelect
                label="Cuisson"
                value={filters.maxCook}
                onChange={(value) => patch({ maxCook: value })}
              />
            </div>
            <p className={styles.groupNote}>
              Un filtre de durée écarte les recettes dont le temps n'est pas renseigné.
            </p>
          </div>

          <div className={styles.footer}>
            <ChipToggle
              label="Mes favoris seulement"
              selected={filters.favorite === true}
              onToggle={() => patch({ favorite: filters.favorite === true ? undefined : true })}
            />
            {activeCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft('');
                  clear();
                }}
              >
                Effacer les critères
              </Button>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}
