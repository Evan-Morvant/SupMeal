import { CookbookMembership, Message, User } from '../../models';
import { AppError } from '../../common/app-error';
import { ROLE_LEVEL, type Role } from '../../middlewares/require-role';
import type { ListMessagesQuery } from './messages.schemas';

/** Message accompagné de son auteur, pour l'affichage du salon. */
const AUTHOR_INCLUDE = [{ model: User, as: 'author' }];

/**
 * Rôle minimal pour entrer dans le salon. Un lecteur consulte
 * les recettes du cookbook mais ne suit pas la conversation.
 * La constante est déclarée ici et consommée par les deux portes d'entrée —
 * la pile de middlewares côté REST, le contrôle direct côté WebSocket — pour
 * qu'elles ne puissent pas diverger.
 */
export const CHAT_MIN_ROLE: Role = 'COMMENTER';

/**
 * Comme côté REST, un non-membre reçoit
 * « introuvable » plutôt qu'« interdit », pour ne pas
 * confirmer l'existence du cookbook à qui n'a pas à la connaître.
 */
export async function assertChatAccess(userId: string, cookbookId: string): Promise<void> {
  const membership = await CookbookMembership.findOne({ where: { cookbookId, userId } });

  if (!membership) {
    throw new AppError(404, 'COOKBOOK_NOT_FOUND', 'Cookbook introuvable');
  }
  if (ROLE_LEVEL[membership.role] < ROLE_LEVEL[CHAT_MIN_ROLE]) {
    throw new AppError(403, 'FORBIDDEN', 'Rôle insuffisant');
  }
}

/**
 * Historique du salon. On pagine du plus récent au plus ancien — c'est la fin
 * de la conversation qui intéresse à l'ouverture — puis on remet la tranche
 * dans l'ordre de lecture. `id` départage les messages de même horodatage,
 * sans quoi deux envois simultanés s'ordonneraient au hasard d'une page à
 * l'autre.
 */
export async function listMessages(
  cookbookId: string,
  query: ListMessagesQuery,
): Promise<Message[]> {
  const messages = await Message.findAll({
    where: { cookbookId },
    include: AUTHOR_INCLUDE,
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });

  return messages.reverse();
}

/**
 * Enregistre un message et le relit avec son auteur, la diffusion devant
 * porter le même contenu que la réponse REST. L'autorisation relève de
 * l'appelant : `requireRole` côté REST, `assertChatAccess` côté WebSocket.
 */
export async function postMessage(
  userId: string,
  cookbookId: string,
  content: string,
): Promise<Message> {
  const message = await Message.create({ cookbookId, userId, content });
  return (await Message.findByPk(message.id, { include: AUTHOR_INCLUDE }))!;
}
