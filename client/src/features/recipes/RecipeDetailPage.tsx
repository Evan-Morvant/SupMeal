import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/errors';
import { useAuth } from '../../auth/auth-context';
import { Button, buttonClass } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/Dialog';
import { Alert, ErrorState, PageLoader } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { AddToPlanDialog } from '../meal-plan/AddToPlanDialog';
import { ReviewsSection } from '../reviews/ReviewsSection';
import { RecipeBody } from './RecipeBody';
import { useDeleteRecipe, useRecipe, useToggleFavorite } from './recipes.hooks';
import styles from './recipe-page.module.css';

export function RecipeDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const recipeQuery = useRecipe(id);
  const toggleFavorite = useToggleFavorite();
  const deleteRecipe = useDeleteRecipe();
  const [confirming, setConfirming] = useState(false);
  const [planning, setPlanning] = useState(false);

  if (recipeQuery.isPending) {
    return <PageLoader label="Chargement de la recette…" />;
  }
  if (recipeQuery.isError) {
    return (
      <ErrorState
        error={recipeQuery.error}
        title="Recette introuvable"
        action={
          <Link to="/recipes" className={buttonClass({ variant: 'outline' })}>
            Retour à mes recettes
          </Link>
        }
      />
    );
  }

  const recipe = recipeQuery.data;
  const isOwner = user !== null && user.id === recipe.ownerId;

  return (
    <article>
      <header className={styles.head}>
        <div className={styles.heading}>
          <Link to="/recipes" className={styles.back}>
            <Icon name="chevronGauche" size={16} />
            Mes recettes
          </Link>
          <h1 className={styles.title}>{recipe.title}</h1>
        </div>

        <div className={styles.actions}>
          <Button variant="outline" onClick={() => setPlanning(true)}>
            <Icon name="planning" size={20} />
            Planifier
          </Button>
          <Button
            variant={recipe.isFavorite ? 'secondary' : 'outline'}
            onClick={() => toggleFavorite.mutate({ id: recipe.id, favorite: !recipe.isFavorite })}
            aria-pressed={recipe.isFavorite}
          >
            <Icon name="favori" size={20} filled={recipe.isFavorite} />
            {recipe.isFavorite ? 'En favori' : 'Ajouter aux favoris'}
          </Button>
          <Link
            to={'/recipes/' + recipe.id + '/edit'}
            className={buttonClass({ variant: 'outline' })}
          >
            <Icon name="modifier" size={20} />
            Modifier
          </Link>
          {/* Suppression réservée au créateur, comme du côté de l'API. */}
          {isOwner && (
            <Button
              variant="danger"
              iconOnly
              onClick={() => setConfirming(true)}
              aria-label="Supprimer la recette"
            >
              <Icon name="supprimer" size={20} />
            </Button>
          )}
        </div>
      </header>

      <RecipeBody recipe={recipe} />

      <ReviewsSection recipe={recipe} />

      {deleteRecipe.isError && <Alert>{errorMessage(deleteRecipe.error)}</Alert>}

      <AddToPlanDialog
        recipe={recipe}
        open={planning}
        onClose={() => setPlanning(false)}
      />

      <ConfirmDialog
        open={confirming}
        title="Supprimer cette recette ?"
        confirmLabel="Supprimer"
        busy={deleteRecipe.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          deleteRecipe.mutate(recipe.id, {
            onSuccess: () => navigate('/recipes', { replace: true }),
            onError: () => setConfirming(false),
          })
        }
      >
        <p>
          « {recipe.title} » sera retirée de tous les cookbooks où elle figure, avec ses
          commentaires et ses avis. Cette action est définitive.
        </p>
      </ConfirmDialog>
    </article>
  );
}
