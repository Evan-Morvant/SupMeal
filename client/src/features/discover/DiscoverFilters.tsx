import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DiscoverFilters as Criteria } from '../../api/types';
import { useAuth } from '../../auth/auth-context';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { useTags } from '../catalog/catalog.hooks';
import {
  DurationFilters,
  SortSelect,
  TagFilter,
  searchStyles as styles,
  type SortOption,
} from '../search/filter-parts';
import { SearchField } from '../search/SearchField';
import type { DiscoverFiltersState } from './useDiscoverFilters';

const SORTS: SortOption[] = [
  { value: '', label: 'Tri automatique' },
  { value: 'rating', label: 'Les mieux notées' },
  { value: 'recent', label: 'Plus récentes' },
  { value: 'relevance', label: 'Pertinence' },
];

export function DiscoverFilters({ state }: { state: DiscoverFiltersState }): JSX.Element {
  const { filters, patch, clear, activeCount } = state;
  const { status } = useAuth();
  const [open, setOpen] = useState(activeCount > 0);
  // Catalogue public : un visiteur ne reçoit que les tags portés par une
  // recette publique, ce qui est exactement le périmètre de cet écran.
  const tags = useTags();

  const setQuery = useCallback(
    (value: string | undefined) => patch({ q: value }, { replace: true }),
    [patch],
  );

  return (
    <section>
      <div className={styles.bar}>
        <SearchField
          value={filters.q}
          onChange={setQuery}
          label="Rechercher parmi les recettes publiques"
          placeholder="Rechercher un plat, un ingrédient"
        />

        <SortSelect
          options={SORTS}
          value={filters.sort}
          onChange={(value) => patch({ sort: value as Criteria['sort'] })}
        />

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
          <TagFilter
            tags={tags.data ?? []}
            selected={filters.tags}
            onChange={(values) => patch({ tags: values })}
          />

          <DurationFilters
            maxPrep={filters.maxPrep}
            maxCook={filters.maxCook}
            onChange={patch}
          />

          <div className={styles.footer}>
            {/*
             * Les filtres manquants sont annoncés plutôt que masqués : un
             * visiteur qui cherche par ingrédient doit comprendre où le
             * trouver, pas se demander si l'application sait le faire.
             */}
            {status !== 'authenticated' && (
              <p className={styles.groupNote}>
                Filtrer par ingrédient ou par favori demande un compte.{' '}
                <Link to="/register">Créer un compte</Link>
              </p>
            )}
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clear}>
                Effacer les critères
              </Button>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}
