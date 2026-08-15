import { Request, Response } from 'express';
import { serializeReview } from '../../common/serialize';
import * as reviewsService from './reviews.service';

export async function list(req: Request, res: Response): Promise<void> {
  const { avgRating, reviewCount, items } = await reviewsService.listReviews(req.recipe!);
  res.json({ avgRating, reviewCount, items: items.map(serializeReview) });
}

export async function upsert(req: Request, res: Response): Promise<void> {
  const review = await reviewsService.upsertReview(req.recipe!, req.user!.id, req.body);
  res.json(serializeReview(review));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await reviewsService.deleteReview(req.params.id, req.user!.id);
  res.status(204).send();
}
