import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../api/errors';
import type { Recipe } from '../../api/types';
import { useAuth } from '../../auth/auth-context';
import { formatDate } from '../../lib/format';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Textarea } from '../../ui/Field';
import { Alert, ErrorState } from '../../ui/Feedback';
import { StarDisplay, StarInput } from './StarRating';
import { useDeleteReview, useReviews, useSaveReview } from './reviews.hooks';
import styles from './ReviewsSection.module.css';

/**
 * Avis publics d'une recette. Le créateur n'y participe pas : sa voix pèserait
 * sur une moyenne qui sert précisément à départager les recettes.
 */
export function ReviewsSection({ recipe }: { recipe: Recipe }): JSX.Element {
  const { user, status } = useAuth();
  const reviews = useReviews(recipe.id);
  const saveReview = useSaveReview(recipe.id);
  const deleteReview = useDeleteReview(recipe.id);

  const mine = reviews.data?.items.find((review) => review.author?.id === user?.id);
  const others = reviews.data?.items.filter((review) => review.author?.id !== user?.id) ?? [];
  const isOwner = user !== null && user.id === recipe.ownerId;

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');

  // Recharge le formulaire quand l'avis arrive du réseau, ou change de recette.
  useEffect(() => {
    setRating(mine?.rating ?? 0);
    setBody(mine?.body ?? '');
  }, [mine?.rating, mine?.body, recipe.id]);

  if (reviews.isError) {
    return (
      <section className={styles.section}>
        <ErrorState error={reviews.error} title="Avis indisponibles" />
      </section>
    );
  }

  const count = reviews.data?.reviewCount ?? 0;
  const average = reviews.data?.avgRating ?? null;

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <h2 className={styles.title}>Avis</h2>
        {average !== null && (
          <p className={styles.average}>
            <StarDisplay rating={Math.round(average)} size={18} />
            <span className={styles.averageValue}>{average.toFixed(1)}</span>
            <span className={styles.averageCount}>
              sur {count} avis
            </span>
          </p>
        )}
      </header>

      {status === 'anonymous' && (
        <p className={styles.empty}>
          <Link to="/login">Connectez-vous</Link> pour donner votre avis.
        </p>
      )}

      {status === 'authenticated' && isOwner && (
        <p className={styles.empty}>
          Vous ne pouvez pas noter votre propre recette.
        </p>
      )}

      {status === 'authenticated' && !isOwner && (
        <Card className={styles.mine}>
          <div className={styles.mineHead}>
            <span className={styles.mineTitle}>
              {mine === undefined ? 'Donner mon avis' : 'Mon avis'}
            </span>
            <StarInput value={rating} onChange={setRating} />
          </div>

          <Textarea
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Ce que vous en avez pensé (facultatif)."
            aria-label="Votre commentaire"
            maxLength={2000}
          />

          {saveReview.isError && <Alert>{errorMessage(saveReview.error)}</Alert>}
          {deleteReview.isError && <Alert>{errorMessage(deleteReview.error)}</Alert>}

          <div className={styles.actions}>
            {mine !== undefined && (
              <Button
                variant="ghost"
                onClick={() => deleteReview.mutate(undefined)}
                loading={deleteReview.isPending}
              >
                Retirer mon avis
              </Button>
            )}
            <Button
              // La note est obligatoire, le texte non : noter sans écrire reste
              // un avis, écrire sans noter n'en est pas un.
              disabled={rating === 0}
              loading={saveReview.isPending}
              onClick={() =>
                saveReview.mutate({ rating, body: body.trim() === '' ? null : body.trim() })
              }
            >
              {mine === undefined ? 'Publier mon avis' : 'Mettre à jour'}
            </Button>
          </div>
        </Card>
      )}

      {count === 0 ? (
        <p className={styles.empty}>Personne n'a encore donné son avis sur cette recette.</p>
      ) : (
        <div className={styles.list}>
          {others.map((review) => (
            <article className={styles.review} key={review.id}>
              <div className={styles.reviewHead}>
                <Avatar
                  displayName={review.author?.displayName ?? ''}
                  avatarUrl={review.author?.avatarUrl}
                  size={28}
                />
                <span className={styles.author}>{review.author?.displayName}</span>
                <StarDisplay rating={review.rating} />
                <span className={styles.date}>{formatDate(review.createdAt)}</span>
              </div>
              {review.body !== null && <p className={styles.body}>{review.body}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
