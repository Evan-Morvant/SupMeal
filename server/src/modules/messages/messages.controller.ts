import { Request, Response } from 'express';
import { serializeMessage } from '../../common/serialize';
import { broadcastMessage } from '../../realtime/bus';
import * as messagesService from './messages.service';
import type { ListMessagesQuery } from './messages.schemas';

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListMessagesQuery;
  const messages = await messagesService.listMessages(req.membership!.cookbookId, query);
  res.json(messages.map(serializeMessage));
}

/**
 * Repli REST pour les clients sans WebSocket. Le message est malgré tout
 * diffusé dans le salon, faute de quoi les clients connectés ne le verraient
 * qu'au prochain rechargement de l'historique.
 */
export async function create(req: Request, res: Response): Promise<void> {
  const message = await messagesService.postMessage(
    req.user!.id,
    req.membership!.cookbookId,
    req.body.content,
  );

  const payload = serializeMessage(message);
  broadcastMessage(message.cookbookId, payload);
  res.status(201).json(payload);
}
