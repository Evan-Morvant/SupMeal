import { Link } from 'react-router-dom';
import type { RecipeSummary } from '../../api/types';
import { cardClass } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { Logo } from '../../ui/Logo';
import { Rating } from '../../ui/Rating';
import { TimeDial } from '../../ui/TimeDial';
import styles from './RecipeCard.module.css';

/** Trois tags suffisent en liste ; le détail les montre tous. */
const TAGS_SHOWN = 3;

interface RecipeCardProps {
  recipe: RecipeSummary;
  /** Chemin du détail : la découverte et la liste personnelle diffèrent. */
  to: string;
  /** Absent chez un visiteur : le favori suppose un compte. */
  onToggleFavorite?: (favorite: boolean) => void;
  /**
   * Signale les recettes publiques. Inutile là où elles le sont toutes — sur
   * la découverte, le badge n'apprendrait rien.
   */
  showVisibility?: boolean;
}

export function RecipeCard({
  recipe,
  to,
  onToggleFavorite,
  showVisibility = true,
}: RecipeCardProps): JSX.Element {
  const extraTags = recipe.tags.length - TAGS_SHOWN;

  return (
    <article className={cardClass({ flush: true, interactive: true, className: styles.card })}>
      <div className={styles.media}>
        {recipe.imageUrl === null ? (
          <div className={styles.placeholder}>
            <Logo size={72} decorative mono />
          </div>
        ) : (
          <img className={styles.image} src={recipe.imageUrl} alt="" loading="lazy" />
        )}

        {onToggleFavorite !== undefined && (
          <button
            type="button"
            className={[styles.favorite, recipe.isFavorite ? styles.favoriteOn : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => onToggleFavorite(!recipe.isFavorite)}
            aria-pressed={recipe.isFavorite}
            aria-label={
              recipe.isFavorite
                ? 'Retirer ' + recipe.title + ' des favoris'
                : 'Ajouter ' + recipe.title + ' aux favoris'
            }
          >
            <Icon name="favori" size={20} filled={recipe.isFavorite} />
          </button>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.text}>
          <h3 className={styles.title}>
            <Link to={to} className={styles.link}>
              {recipe.title}
            </Link>
          </h3>

          <p className={styles.meta}>
            <Rating avgRating={recipe.avgRating} reviewCount={recipe.reviewCount} />
            {recipe.servings !== null && (
              <span className={styles.servings}>
                <Icon name="parts" size={15} />
                <span className={styles.number}>{recipe.servings}</span> pers.
              </span>
            )}
            {showVisibility && recipe.visibility === 'public' && (
              <span className={styles.public}>
                <Icon name="monde" size={15} />
                Publique
              </span>
            )}
          </p>

          {recipe.tags.length > 0 && (
            <p className={styles.tags}>
              {recipe.tags.slice(0, TAGS_SHOWN).map((tag) => (
                <span key={tag.id} className={styles.tag}>
                  {tag.name}
                </span>
              ))}
              {extraTags > 0 && <span className={styles.tag}>+{extraTags}</span>}
            </p>
          )}
        </div>

        <TimeDial
          className={styles.dial}
          prepTimeMin={recipe.prepTimeMin}
          cookTimeMin={recipe.cookTimeMin}
          size={50}
        />
      </div>
    </article>
  );
}
