import type { IngredientLine, Recipe } from '../../api/types';
import { Card } from '../../ui/Card';
import { Chip, ChipList } from '../../ui/Chip';
import { Icon } from '../../ui/Icon';
import { Rating } from '../../ui/Rating';
import { TimeDial, TimeDialLegend, formatDuration } from '../../ui/TimeDial';
import styles from './RecipeBody.module.css';

/*
 * Contenu d'une recette, partagé par le détail personnel et le détail public :
 * seuls les en-têtes et les actions diffèrent entre les deux écrans.
 */

/** Sans quantité — le sel, le poivre — la colonne reste vide plutôt qu'inventée. */
function quantityOf(line: IngredientLine): string {
  if (line.quantity === null) {
    return line.unit ?? '';
  }
  const amount = String(line.quantity);
  return line.unit === null ? amount : amount + ' ' + line.unit;
}

export function RecipeBody({ recipe }: { recipe: Recipe }): JSX.Element {
  const total = (recipe.prepTimeMin ?? 0) + (recipe.cookTimeMin ?? 0);

  return (
    <>
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
    </>
  );
}
