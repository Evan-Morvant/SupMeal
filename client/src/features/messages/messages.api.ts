import { api } from '../../api/client';
import type { Message } from '../../api/types';

/** Une page d'historique. Cinquante messages tiennent largement un écran. */
export const MESSAGES_PAGE_SIZE = 50;

/**
 * Historique du salon, lu à rebours : la page 1 porte les messages les plus
 * récents, la suivante remonte la conversation. Chaque page est rendue dans
 * l'ordre de lecture, du plus ancien au plus récent.
 */
export async function listMessages(cookbookId: string, page: number): Promise<Message[]> {
  const { data } = await api.get<Message[]>('/cookbooks/' + cookbookId + '/messages', {
    params: { page, pageSize: MESSAGES_PAGE_SIZE },
  });
  return data;
}

/**
 * Repli quand le WebSocket est coupé. Le serveur diffuse quand même dans le
 * salon, si bien que les autres clients voient le message sans recharger.
 */
export async function postMessage(cookbookId: string, content: string): Promise<Message> {
  const { data } = await api.post<Message>('/cookbooks/' + cookbookId + '/messages', {
    content,
  });
  return data;
}
