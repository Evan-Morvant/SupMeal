import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/errors';
import { Button, buttonClass } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/Dialog';
import { Alert, ErrorState, PageLoader } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { CommentsSection } from '../comments/CommentsSection';
import { RecipeBody } from '../recipes/RecipeBody';
import { useRecipe, useToggleFavorite } from '../recipes/recipes.hooks';
import { useCookbook, useUnlinkRecipe } from './cookbooks.hooks';
import { atLeast } from './roles';
import styles from '../recipes/recipe-page.module.css';

/**
 * Recette lue depuis un cookbook. Même contenu que le détail personnel, mais
 * le fil de commentaires du groupe s'y attache, et « retirer » défait la
 * liaison sans toucher à la recette.
 */
export function CookbookRecipePage(): JSX.Element {
  const { id, recipeId } = useParams<{ id: string; recipeId: string }>();
  const navigate = useNavigate();
  const cookbookQuery = useCookbook(id);
  const recipeQuery = useRecipe(recipeId);
  const unlinkRecipe = useUnlinkRecipe(id ?? '');
  const toggleFavorite = useToggleFavorite();
  const [confirming, setConfirming] = useState(false);

  if (cookbookQuery.isPending || recipeQuery.isPending) {
    return <PageLoader label="Chargement de la recette…" />;
  }
  if (cookbookQuery.isError || recipeQuery.isError) {
    return (
      <ErrorState
        error={cookbookQuery.error ?? recipeQuery.error}
        title="Recette introuvable"
        action={
          <Link to="/cookbooks" className={buttonClass({ variant: 'outline' })}>
            Retour aux cookbooks
          </Link>
        }
      />
    );
  }

  const cookbook = cookbookQuery.data;
  const recipe = recipeQuery.data;
  const canEdit = atLeast(cookbook.myRole, 'EDITOR');

  return (
    <article>
      <header className={styles.head}>
        <div className={styles.heading}>
          <Link to={'/cookbooks/' + cookbook.id} className={styles.back}>
            <Icon name="chevronGauche" size={16} />
            {cookbook.name}
          </Link>
          <h1 className={styles.title}>{recipe.title}</h1>
        </div>

        <div className={styles.actions}>
          <Button
            variant={recipe.isFavorite ? 'secondary' : 'outline'}
            onClick={() => toggleFavorite.mutate({ id: recipe.id, favorite: !recipe.isFavorite })}
            aria-pressed={recipe.isFavorite}
          >
            <Icon name="favori" size={20} filled={recipe.isFavorite} />
            {recipe.isFavorite ? 'En favori' : 'Ajouter aux favoris'}
          </Button>
          {canEdit && (
            <>
              <Link
                to={'/recipes/' + recipe.id + '/edit'}
                className={buttonClass({ variant: 'outline' })}
              >
                <Icon name="modifier" size={20} />
                Modifier
              </Link>
              <Button variant="outline" onClick={() => setConfirming(true)}>
                Retirer du cookbook
              </Button>
            </>
          )}
        </div>
      </header>

      {unlinkRecipe.isError && <Alert>{errorMessage(unlinkRecipe.error)}</Alert>}

      <RecipeBody recipe={recipe} />

      <CommentsSection
        cookbookId={cookbook.id}
        recipeId={recipe.id}
        myRole={cookbook.myRole}
      />

      <ConfirmDialog
        open={confirming}
        title="Retirer cette recette du cookbook ?"
        confirmLabel="Retirer"
        tone="outline"
        busy={unlinkRecipe.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          unlinkRecipe.mutate(recipe.id, {
            onSuccess: () => navigate('/cookbooks/' + cookbook.id, { replace: true }),
            onError: () => setConfirming(false),
          })
        }
      >
        <p>
          Seule la liaison disparaît : la recette reste à son créateur et dans les autres
          cookbooks où elle figure. Les commentaires de ce groupe, eux, partent avec elle.
        </p>
      </ConfirmDialog>
    </article>
  );
}
