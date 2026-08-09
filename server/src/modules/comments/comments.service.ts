import { Comment, CookbookMembership, CookbookRecipe, User } from '../../models';
import { AppError } from '../../common/app-error';

/** Commentaire accompagné de son auteur, pour l'affichage du fil. */
const AUTHOR_INCLUDE = [{ model: User, as: 'author' }];

function findWithAuthor(commentId: string): Promise<Comment | null> {
  return Comment.findByPk(commentId, { include: AUTHOR_INCLUDE });
}

/**
 * Un fil n'existe que là où la recette est effectivement rattachée au
 * cookbook. Sans ce contrôle, un membre pourrait ouvrir un fil sous une
 * recette absente du cookbook, et l'y voir apparaître si elle y était liée
 * plus tard.
 */
async function assertRecipeInCookbook(cookbookId: string, recipeId: string): Promise<void> {
  const linked = await CookbookRecipe.count({ where: { cookbookId, recipeId } });
  if (linked === 0) {
    throw new AppError(
      404,
      'RECIPE_NOT_IN_COOKBOOK',
      "Cette recette n'appartient pas à ce cookbook",
    );
  }
}

/** Fil du cookbook pour cette recette, dans l'ordre de la conversation. */
export async function listComments(cookbookId: string, recipeId: string): Promise<Comment[]> {
  await assertRecipeInCookbook(cookbookId, recipeId);
  return Comment.findAll({
    where: { cookbookId, recipeId },
    include: AUTHOR_INCLUDE,
    order: [['createdAt', 'ASC']],
  });
}

export async function addComment(
  userId: string,
  cookbookId: string,
  recipeId: string,
  content: string,
): Promise<Comment> {
  await assertRecipeInCookbook(cookbookId, recipeId);
  const comment = await Comment.create({ cookbookId, recipeId, userId, content });
  return (await findWithAuthor(comment.id))!;
}

async function findCommentOrFail(commentId: string): Promise<Comment> {
  const comment = await Comment.findByPk(commentId);
  if (!comment) {
    throw new AppError(404, 'COMMENT_NOT_FOUND', 'Commentaire introuvable');
  }
  return comment;
}

/** Modification : réservée à l'auteur. */
export async function updateComment(
  commentId: string,
  userId: string,
  content: string,
): Promise<Comment> {
  const comment = await findCommentOrFail(commentId);
  if (comment.userId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Seul l auteur peut modifier son commentaire');
  }

  comment.content = content;
  await comment.save();
  return (await findWithAuthor(comment.id))!;
}

/** Suppression : l'auteur, ou le créateur du cookbook. */
export async function deleteComment(commentId: string, userId: string): Promise<void> {
  const comment = await findCommentOrFail(commentId);

  if (comment.userId !== userId) {
    const membership = await CookbookMembership.findOne({
      where: { cookbookId: comment.cookbookId, userId },
    });
    if (membership?.role !== 'OWNER') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Seul l auteur ou le créateur du cookbook peut supprimer ce commentaire',
      );
    }
  }

  await comment.destroy();
}
