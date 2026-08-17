import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { Button, buttonClass } from '../../ui/Button';
import { ErrorState, PageLoader } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { RecipeBody } from '../recipes/RecipeBody';
import { useToggleFavorite } from '../recipes/recipes.hooks';
import { ReviewsSection } from '../reviews/ReviewsSection';
import { useDiscoverRecipe } from './discover.hooks';
import styles from '../recipes/recipe-page.module.css';

/**
 * Détail public. L'API répond 404 sur une recette non publique plutôt que 403 :
 * un 403 confirmerait son existence à qui cherche un identifiant au hasard.
 */
export function DiscoverRecipePage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { status } = useAuth();
  const recipeQuery = useDiscoverRecipe(id);
  const toggleFavorite = useToggleFavorite();

  if (recipeQuery.isPending) {
    return <PageLoader label="Chargement de la recette…" />;
  }
  if (recipeQuery.isError) {
    return (
      <ErrorState
        error={recipeQuery.error}
        title="Recette introuvable"
        action={
          <Link to="/discover" className={buttonClass({ variant: 'outline' })}>
            Retour à la découverte
          </Link>
        }
      />
    );
  }

  const recipe = recipeQuery.data;

  return (
    <article>
      <header className={styles.head}>
        <div className={styles.heading}>
          <Link to="/discover" className={styles.back}>
            <Icon name="chevronGauche" size={16} />
            Découvrir
          </Link>
          <h1 className={styles.title}>{recipe.title}</h1>
        </div>

        <div className={styles.actions}>
          {status === 'authenticated' ? (
            <Button
              variant={recipe.isFavorite ? 'secondary' : 'outline'}
              onClick={() =>
                toggleFavorite.mutate({ id: recipe.id, favorite: !recipe.isFavorite })
              }
              aria-pressed={recipe.isFavorite}
            >
              <Icon name="favori" size={20} filled={recipe.isFavorite} />
              {recipe.isFavorite ? 'En favori' : 'Ajouter aux favoris'}
            </Button>
          ) : (
            <Link to="/register" className={buttonClass()}>
              Créer un compte pour la garder
            </Link>
          )}
        </div>
      </header>

      <RecipeBody recipe={recipe} />

      <ReviewsSection recipe={recipe} />
    </article>
  );
}
