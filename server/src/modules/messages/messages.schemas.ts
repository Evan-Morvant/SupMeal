import { z } from 'zod';

/** Le contenu est le seul champ libre : auteur et cookbook viennent du contexte. */
export const messageSchema = z.object({
  content: z.string().min(1).max(2000),
});

/**
 * Historique paginé. Le salon se lit à rebours : la page 1 porte les messages
 * les plus récents, la suivante remonte la conversation.
 */
export const listMessagesSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

/** Événements WebSocket ciblant un salon (`cookbook:join`, `cookbook:leave`). */
export const cookbookEventSchema = z.object({ cookbookId: z.string().uuid() });

/** `message:send` : le salon visé, plus le contenu déjà décrit ci-dessus. */
export const sendMessageEventSchema = cookbookEventSchema.merge(messageSchema);

export type MessageInput = z.infer<typeof messageSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesSchema>;
