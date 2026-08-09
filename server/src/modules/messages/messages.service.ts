import { Message, User } from '../../models';
import { assertCookbookRole } from '../cookbooks/members.service';
import type { Role } from '../../middlewares/require-role';
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

/** Contrôle d'accès du salon, appliqué hors de la pile Express. */
export function assertChatAccess(userId: string, cookbookId: string): Promise<void> {
  return assertCookbookRole(userId, cookbookId, CHAT_MIN_ROLE);
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
