import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, buttonClass } from '../../ui/Button';
import { EmptyState, ErrorState, PageLoader } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { Pagination } from '../../ui/Pagination';
import { TimeDialLegend } from '../../ui/TimeDial';
import { RecipeCard } from '../recipes/RecipeCard';
import { useToggleFavorite } from '../recipes/recipes.hooks';
import { useRecipeFilters } from '../recipes/useRecipeFilters';
import { SearchField } from '../search/SearchField';
import { searchStyles } from '../search/filter-parts';
import { LinkRecipeDialog } from './LinkRecipeDialog';
import { useCookbookRecipes } from './cookbooks.hooks';
import { useCurrentCookbook } from './CookbookLayout';
import { atLeast } from './roles';
import styles from '../recipes/RecipesPage.module.css';

/**
 * Recettes rangées dans le cookbook. La recherche interne exigée au cahier des
 * charges reprend le champ de la liste personnelle — mêmes critères, autre
 * périmètre.
 */
export function CookbookRecipesTab(): JSX.Element {
  const cookbook = useCurrentCookbook();
  const { filters, patch, goToPage } = useRecipeFilters();
  const recipes = useCookbookRecipes(cookbook.id, filters);
  const toggleFavorite = useToggleFavorite();
  const [linking, setLinking] = useState(false);

  const canEdit = atLeast(cookbook.myRole, 'EDITOR');
  const linkedIds = (recipes.data?.items ?? []).map((recipe) => recipe.id);

  return (
    <>
      <div className={searchStyles.bar}>
        <SearchField
          value={filters.q}
          onChange={(value) => patch({ q: value }, { replace: true })}
          label="Rechercher dans ce cookbook"
          placeholder="Rechercher une recette du cookbook"
        />
        {canEdit && (
          <>
            <Button variant="outline" onClick={() => setLinking(true)}>
              <Icon name="ajouter" size={20} />
              Ranger une recette
            </Button>
            <Link
              to={'/recipes/new?cookbookId=' + cookbook.id}
              className={buttonClass()}
            >
              Nouvelle recette
            </Link>
          </>
        )}
      </div>

      {recipes.isPending && <PageLoader label="Chargement des recettes…" />}
      {recipes.isError && <ErrorState error={recipes.error} />}

      {recipes.data !== undefined && recipes.data.items.length === 0 && (
        <EmptyState
          title={filters.q === undefined ? 'Ce cookbook est vide' : 'Aucune recette ne correspond'}
          action={
            canEdit && filters.q === undefined ? (
              <Button onClick={() => setLinking(true)}>Ranger une recette</Button>
            ) : undefined
          }
        >
          <p>
            {canEdit
              ? 'Rangez-y une recette existante, ou créez-en une directement dans le cookbook.'
              : 'Les éditeurs du groupe peuvent y ranger des recettes.'}
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
                to={'/cookbooks/' + cookbook.id + '/recipes/' + recipe.id}
                onToggleFavorite={(favorite) =>
                  toggleFavorite.mutate({ id: recipe.id, favorite })
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

      <LinkRecipeDialog
        cookbookId={cookbook.id}
        alreadyLinked={linkedIds}
        open={linking}
        onClose={() => setLinking(false)}
      />
    </>
  );
}
