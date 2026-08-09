import { Request, Response } from 'express';
import { serializeComment } from '../../common/serialize';
import * as commentsService from './comments.service';

export async function list(req: Request, res: Response): Promise<void> {
  const comments = await commentsService.listComments(
    req.membership!.cookbookId,
    req.params.recipeId,
  );
  res.json(comments.map(serializeComment));
}

export async function create(req: Request, res: Response): Promise<void> {
  const comment = await commentsService.addComment(
    req.user!.id,
    req.membership!.cookbookId,
    req.params.recipeId,
    req.body.content,
  );
  res.status(201).json(serializeComment(comment));
}

export async function update(req: Request, res: Response): Promise<void> {
  const comment = await commentsService.updateComment(
    req.params.commentId,
    req.user!.id,
    req.body.content,
  );
  res.json(serializeComment(comment));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await commentsService.deleteComment(req.params.commentId, req.user!.id);
  res.status(204).send();
}
