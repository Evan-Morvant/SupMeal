import { Link } from 'react-router-dom';
import { Button, buttonClass } from '../../ui/Button';
import { EmptyState, ErrorState, PageLoader } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { Pagination } from '../../ui/Pagination';
import { TimeDialLegend } from '../../ui/TimeDial';
import { RecipeCard } from './RecipeCard';
import { RecipeFilters } from './RecipeFilters';
import { useRecipes, useToggleFavorite } from './recipes.hooks';
import { useRecipeFilters } from './useRecipeFilters';
import styles from './RecipesPage.module.css';

/**
 * Liste personnelle : ses recettes et celles de ses cookbooks, avec la
 * recherche plein texte et tous les filtres. Les critères vivent dans l'URL,
 * la recherche se partage donc par son adresse.
 */
export function RecipesPage(): JSX.Element {
  const state = useRecipeFilters();
  const { filters, goToPage, activeCount, clear } = state;
  const recipes = useRecipes(filters);
  const toggleFavorite = useToggleFavorite();

  const searching = filters.q !== undefined || activeCount > 0;

  return (
    <>
      <header className={styles.head}>
        <div className={styles.title}>
          <h1>Mes recettes</h1>
          <p className={styles.lede}>
            Vos recettes et celles des cookbooks dont vous êtes membre.
          </p>
        </div>
        <Link to="/recipes/new" className={buttonClass()}>
          <Icon name="ajouter" size={20} />
          Nouvelle recette
        </Link>
      </header>

      <div className={styles.filters}>
        <RecipeFilters state={state} />
      </div>

      {recipes.isPending && <PageLoader label="Chargement de vos recettes…" />}

      {recipes.isError && <ErrorState error={recipes.error} />}

      {recipes.data !== undefined && recipes.data.items.length === 0 && (
        <>
          {searching ? (
            <EmptyState
              title="Aucune recette ne correspond"
              action={
                <Button variant="outline" onClick={clear}>
                  Effacer les critères
                </Button>
              }
            >
              <p>
                Essayez avec moins de critères : les tags et les ingrédients se cumulent, et un
                filtre de durée écarte les recettes sans temps renseigné.
              </p>
            </EmptyState>
          ) : (
            <EmptyState
              title="Votre carnet est vide"
              action={
                <Link to="/recipes/new" className={buttonClass()}>
                  Ajouter ma première recette
                </Link>
              }
            >
              <p>
                Ajoutez une recette, ou importez un fichier existant depuis vos paramètres.
              </p>
            </EmptyState>
          )}
        </>
      )}

      {recipes.data !== undefined && recipes.data.items.length > 0 && (
        <>
          <div className={styles.legend}>
            <TimeDialLegend />
          </div>
          <div
            className={[styles.grid, recipes.isFetching ? styles.stale : ''].filter(Boolean).join(' ')}
          >
            {recipes.data.items.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                to={'/recipes/' + recipe.id}
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
    </>
  );
}
