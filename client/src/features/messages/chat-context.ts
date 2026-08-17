import { createContext, useContext } from 'react';
import type { Message } from '../../api/types';

export type ChatStatus = 'connecting' | 'online' | 'offline';

export interface ChatError {
  code: string;
  message: string;
}

export interface ChatValue {
  /** Faux quand le rôle n'ouvre pas le salon : rien n'est connecté. */
  allowed: boolean;
  messages: Message[];
  status: ChatStatus;
  failure: ChatError | null;
  send: (content: string) => Promise<void>;
  loadOlder: () => Promise<unknown>;
  hasOlder: boolean;
  loadingOlder: boolean;
  isPending: boolean;
  error: unknown;
  /** Messages reçus des autres pendant que le salon n'était pas affiché. */
  unread: number;
  /** Signale que le salon est à l'écran, ce qui arrête le comptage. */
  setViewing: (viewing: boolean) => void;
}

export const ChatContext = createContext<ChatValue | null>(null);

export function useChat(): ChatValue {
  const value = useContext(ChatContext);
  if (value === null) {
    throw new Error('useChat doit être utilisé dans un ChatProvider');
  }
  return value;
}
