import { useAuth } from '../../auth/auth-context';
import { Button } from '../../ui/Button';
import { EmptyState, ErrorState, PageLoader } from '../../ui/Feedback';
import { Pagination } from '../../ui/Pagination';
import { TimeDialLegend } from '../../ui/TimeDial';
import { RecipeCard } from '../recipes/RecipeCard';
import { useToggleFavorite } from '../recipes/recipes.hooks';
import { DiscoverFilters } from './DiscoverFilters';
import { useDiscoverRecipes } from './discover.hooks';
import { useDiscoverFilters } from './useDiscoverFilters';
import styles from '../recipes/RecipesPage.module.css';

/**
 * Recettes publiées par la communauté. Lecture ouverte aux visiteurs ; le
 * favori n'apparaît qu'avec un compte, puisqu'il en suppose un.
 */
export function DiscoverPage(): JSX.Element {
  const state = useDiscoverFilters();
  const { filters, goToPage, activeCount, clear } = state;
  const recipes = useDiscoverRecipes(filters);
  const toggleFavorite = useToggleFavorite();
  const { status } = useAuth();

  const searching = filters.q !== undefined || activeCount > 0;

  return (
    <>
      <header className={styles.head}>
        <div className={styles.title}>
          <h1>Découvrir</h1>
          <p className={styles.lede}>Les recettes que d'autres ont rendues publiques.</p>
        </div>
      </header>

      <div className={styles.filters}>
        <DiscoverFilters state={state} />
      </div>

      {recipes.isPending && <PageLoader label="Chargement des recettes…" />}

      {recipes.isError && <ErrorState error={recipes.error} />}

      {recipes.data !== undefined && recipes.data.items.length === 0 && (
        <EmptyState
          title={searching ? 'Aucune recette ne correspond' : 'Rien à découvrir pour le moment'}
          action={
            searching ? (
              <Button variant="outline" onClick={clear}>
                Effacer les critères
              </Button>
            ) : undefined
          }
        >
          <p>
            {searching
              ? "Essayez avec moins de critères : les tags se cumulent, et un filtre de durée écarte les recettes sans temps renseigné."
              : 'Les recettes publiées par la communauté apparaîtront ici.'}
          </p>
        </EmptyState>
      )}

      {recipes.data !== undefined && recipes.data.items.length > 0 && (
        <>
          <div className={styles.legend}>
            <TimeDialLegend />
          </div>
          <div
            className={[styles.grid, recipes.isFetching ? styles.stale : '']
              .filter(Boolean)
              .join(' ')}
          >
            {recipes.data.items.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                to={'/discover/' + recipe.id}
                showVisibility={false}
                onToggleFavorite={
                  status === 'authenticated'
                    ? (favorite) => toggleFavorite.mutate({ id: recipe.id, favorite })
                    : undefined
                }
              />
            ))}
          </div>
          <Pagination
            page={recipes.data.page}
            pageSize={recipes.data.pageSize}
            total={recipes.data.total}
            onChange={goToPage}
          />
        </>
      )}
    </>
  );
}
