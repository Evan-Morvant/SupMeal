import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { IngredientLine } from '../../api/types';
import { useAuth } from '../../auth/auth-context';
import { Button, buttonClass } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Chip, ChipList } from '../../ui/Chip';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Alert, ErrorState, PageLoader } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { Rating } from '../../ui/Rating';
import { TimeDial, TimeDialLegend, formatDuration } from '../../ui/TimeDial';
import { errorMessage } from '../../api/errors';
import { useDeleteRecipe, useRecipe, useToggleFavorite } from './recipes.hooks';
import styles from './RecipeDetailPage.module.css';

/**
 * Quantité d'une ligne d'ingrédient. Sans quantité — le sel, le poivre — la
 * colonne reste vide : inventer « 1 » serait faux.
 */
function quantityOf(line: IngredientLine): string {
  if (line.quantity === null) {
    return line.unit ?? '';
  }
  // `String` écrit déjà 2 et non 2.0 : rien à arrondir ni à tronquer.
  const amount = String(line.quantity);
  return line.unit === null ? amount : amount + ' ' + line.unit;
}

export function RecipeDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const recipeQuery = useRecipe(id);
  const toggleFavorite = useToggleFavorite();
  const deleteRecipe = useDeleteRecipe();
  const [confirming, setConfirming] = useState(false);

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
  const total = (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0);

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
            <Button variant="danger" iconOnly onClick={() => setConfirming(true)} aria-label="Supprimer la recette">
              <Icon name="supprimer" size={20} />
            </Button>
          )}
        </div>
      </header>

      {recipe.description !== null && <p className={styles.description}>{recipe.description}</p>}

      <Card className={styles.facts}>
        {total > 0 && (
          <div className={styles.dialBlock}>
            <TimeDial
              prepTimeMin={recipe.prepTimeMin}
              cookTimeMin={recipe.cookTimeMin}
              size={72}
            />
            <div>
              <p className={styles.factLabel}>Temps total</p>
              <p className={styles.factValue}>{formatDuration(total)}</p>
              <TimeDialLegend />
            </div>
          </div>
        )}

        {recipe.servings !== null && (
          <div className={styles.fact}>
            <span className={styles.factLabel}>Portions</span>
            <span className={styles.factValue}>{recipe.servings}</span>
          </div>
        )}

        <div className={styles.fact}>
          <span className={styles.factLabel}>Avis</span>
          <Rating avgRating={recipe.avgRating} reviewCount={recipe.reviewCount} />
        </div>

        <div className={styles.fact}>
          <span className={styles.factLabel}>Visibilité</span>
          <span className={styles.inline}>
            <Icon name={recipe.visibility === 'public' ? 'monde' : 'cadenas'} size={15} />
            {recipe.visibility === 'public' ? 'Publique' : 'Privée'}
          </span>
        </div>
      </Card>

      {recipe.imageUrl !== null && (
        <img className={styles.image} src={recipe.imageUrl} alt={'Photo de ' + recipe.title} />
      )}

      <div className={styles.columns}>
        <section>
          <h2 className={styles.sectionTitle}>Ingrédients</h2>
          {recipe.ingredients.length === 0 ? (
            <p className={styles.note}>Aucun ingrédient renseigné.</p>
          ) : (
            <div className={styles.ingredients}>
              {recipe.ingredients.map((line) => (
                <p className={styles.ingredient} key={line.position}>
                  <span className={styles.quantity}>{quantityOf(line)}</span>
                  <span className={styles.ingredientName}>
                    {line.name}
                    {line.note !== null && <span className={styles.note}>{line.note}</span>}
                  </span>
                </p>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Préparation</h2>
          {recipe.steps.length === 0 ? (
            <p className={styles.note}>Aucune étape renseignée.</p>
          ) : (
            <ol className={styles.steps}>
              {recipe.steps.map((step, index) => (
                <li className={styles.step} key={step.position}>
                  <span className={styles.stepNumber} aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className={styles.stepText}>{step.instruction}</span>
                </li>
              ))}
            </ol>
          )}

          {recipe.tags.length > 0 && (
            <div className={styles.tags}>
              <ChipList>
                {recipe.tags.map((tag) => (
                  <Chip key={tag.id}>{tag.name}</Chip>
                ))}
              </ChipList>
            </div>
          )}

          {recipe.source !== null && (
            <p className={styles.source}>
              <Icon name="lien" size={16} />
              Source : {recipe.source}
            </p>
          )}
        </section>
      </div>

      {deleteRecipe.isError && <Alert>{errorMessage(deleteRecipe.error)}</Alert>}

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
