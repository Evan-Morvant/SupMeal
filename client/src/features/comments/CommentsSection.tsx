import { useState } from 'react';
import { errorMessage } from '../../api/errors';
import type { Comment, Role } from '../../api/types';
import { useAuth } from '../../auth/auth-context';
import { formatDate } from '../../lib/format';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/Dialog';
import { Textarea } from '../../ui/Field';
import { Alert, ErrorState } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { atLeast } from '../cookbooks/roles';
import {
  useAddComment,
  useComments,
  useDeleteComment,
  useUpdateComment,
} from './comments.hooks';
import styles from './CommentsSection.module.css';

/**
 * Fil de discussion d'une recette **dans un cookbook**. Le Lecteur le lit sans
 * pouvoir y écrire : c'est ce qui le distingue du Commentateur.
 */
export function CommentsSection({
  cookbookId,
  recipeId,
  myRole,
}: {
  cookbookId: string;
  recipeId: string;
  myRole: Role;
}): JSX.Element {
  const { user } = useAuth();
  const comments = useComments(cookbookId, recipeId);
  const addComment = useAddComment(cookbookId, recipeId);
  const updateComment = useUpdateComment(cookbookId, recipeId);
  const deleteComment = useDeleteComment(cookbookId, recipeId);

  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [removing, setRemoving] = useState<Comment | null>(null);

  const canWrite = atLeast(myRole, 'COMMENTER');

  if (comments.isError) {
    return (
      <section className={styles.section}>
        <ErrorState error={comments.error} title="Discussion indisponible" />
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Commentaires</h2>
      <p className={styles.note}>
        Visibles des seuls membres de ce cookbook. Une recette rangée ailleurs y garde une
        conversation distincte.
      </p>

      {canWrite ? (
        <div className={styles.form}>
          <Textarea
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Un conseil, une variante, un rappel pour le groupe…"
            aria-label="Écrire un commentaire"
            maxLength={2000}
          />
          {addComment.isError && <Alert>{errorMessage(addComment.error)}</Alert>}
          <div className={styles.formActions}>
            <Button
              disabled={draft.trim() === ''}
              loading={addComment.isPending}
              onClick={() =>
                addComment.mutate(draft.trim(), { onSuccess: () => setDraft('') })
              }
            >
              Commenter
            </Button>
          </div>
        </div>
      ) : (
        <p className={styles.note}>
          Votre rôle vous permet de lire la discussion, pas d'y écrire.
        </p>
      )}

      {comments.data !== undefined && comments.data.length === 0 && (
        <p className={styles.empty}>Aucun commentaire sur cette recette.</p>
      )}

      <div className={styles.list}>
        {(comments.data ?? []).map((comment) => {
          const isAuthor = comment.author?.id === user?.id;
          // Le créateur du cookbook modère : il supprime sans pouvoir réécrire.
          const canDelete = isAuthor || atLeast(myRole, 'OWNER');

          return (
            <article className={styles.comment} key={comment.id}>
              <div className={styles.head}>
                <Avatar
                  displayName={comment.author?.displayName ?? ''}
                  avatarUrl={comment.author?.avatarUrl}
                  size={28}
                />
                <span className={styles.author}>{comment.author?.displayName}</span>
                <span className={styles.date}>{formatDate(comment.createdAt)}</span>
                {comment.updatedAt !== comment.createdAt && (
                  <span className={styles.edited}>modifié</span>
                )}
                <span className={styles.actions}>
                  {isAuthor && (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      aria-label="Modifier mon commentaire"
                      onClick={() => {
                        setEditing(comment.id);
                        setEditDraft(comment.content);
                      }}
                    >
                      <Icon name="modifier" size={16} />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      aria-label="Supprimer le commentaire"
                      onClick={() => setRemoving(comment)}
                    >
                      <Icon name="supprimer" size={16} />
                    </Button>
                  )}
                </span>
              </div>

              {editing === comment.id ? (
                <div className={styles.form}>
                  <Textarea
                    rows={2}
                    value={editDraft}
                    onChange={(event) => setEditDraft(event.target.value)}
                    aria-label="Modifier le commentaire"
                    maxLength={2000}
                  />
                  <div className={styles.formActions}>
                    <Button variant="ghost" onClick={() => setEditing(null)}>
                      Annuler
                    </Button>
                    <Button
                      disabled={editDraft.trim() === ''}
                      loading={updateComment.isPending}
                      onClick={() =>
                        updateComment.mutate(
                          { commentId: comment.id, content: editDraft.trim() },
                          { onSuccess: () => setEditing(null) },
                        )
                      }
                    >
                      Enregistrer
                    </Button>
                  </div>
                </div>
              ) : (
                <p className={styles.body}>{comment.content}</p>
              )}
            </article>
          );
        })}
      </div>

      <ConfirmDialog
        open={removing !== null}
        title="Supprimer ce commentaire ?"
        confirmLabel="Supprimer"
        busy={deleteComment.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() =>
          removing !== null &&
          deleteComment.mutate(removing.id, { onSettled: () => setRemoving(null) })
        }
      >
        <p>Le commentaire disparaîtra pour tous les membres du cookbook.</p>
      </ConfirmDialog>
    </section>
  );
}
