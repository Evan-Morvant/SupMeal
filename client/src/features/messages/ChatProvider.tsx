import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { API_ORIGIN, refreshSession } from '../../api/client';
import { keys } from '../../api/query-keys';
import type { Message } from '../../api/types';
import { useAuth } from '../../auth/auth-context';
import { getAccessToken } from '../../auth/token-store';
import { MESSAGES_PAGE_SIZE, listMessages, postMessage } from './messages.api';
import { ChatContext, type ChatError, type ChatStatus, type ChatValue } from './chat-context';

/*
 * Salon d'un cookbook : historique par REST, temps réel par Socket.io, les deux
 * voies portant la même forme de message. Le socket vit au niveau du cookbook
 * et non de l'onglet Discussion, pour rester ouvert — et donc compter — pendant
 * qu'on regarde les recettes ou les membres.
 */
export function ChatProvider({
  cookbookId,
  enabled,
  children,
}: {
  cookbookId: string;
  enabled: boolean;
  children: ReactNode;
}): JSX.Element {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [live, setLive] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatStatus>('connecting');
  const [failure, setFailure] = useState<ChatError | null>(null);
  const [unread, setUnread] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  // Une référence, non un état : réabonner le socket à chaque changement
  // d'onglet le déconnecterait, précisément ce qu'on veut éviter.
  const viewingRef = useRef(false);

  const history = useInfiniteQuery({
    queryKey: keys.messages(cookbookId),
    queryFn: ({ pageParam }) => listMessages(cookbookId, pageParam),
    initialPageParam: 1,
    // Une page incomplète est la dernière : la conversation est remontée.
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < MESSAGES_PAGE_SIZE ? undefined : allPages.length + 1,
    // Un salon vivant n'a pas d'historique « encore frais » : le servir depuis
    // le cache masquerait tout ce qui s'y est dit entre-temps.
    staleTime: 0,
    enabled,
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    /*
     * Le jeton est relu à chaque tentative de connexion — forme fonction de
     * `auth` — pour qu'une reconnexion après expiration reparte avec le jeton
     * rafraîchi plutôt qu'avec celui qui vient d'être refusé.
     */
    const socket = io(API_ORIGIN, {
      auth: (send) => send({ token: getAccessToken() ?? '' }),
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    setLive([]);
    setStatus('connecting');

    socket.on('connect', () => {
      setStatus('online');
      socket.emit('cookbook:join', { cookbookId });
      /*
       * Le salon ne livre que ce qui arrive pendant qu'on y est connecté. Toute
       * coupure laisse un trou que seule une relecture de l'historique comble.
       * C'est donc la connexion, et non le montage, qui la déclenche.
       */
      void queryClient.invalidateQueries({ queryKey: keys.messages(cookbookId) });
    });

    socket.on('disconnect', () => setStatus('offline'));

    socket.on('connect_error', (error: Error & { data?: { code?: string } }) => {
      setStatus('offline');
      // Handshake refusé : le jeton d'accès a probablement expiré pendant que
      // l'onglet dormait. On le renouvelle, la tentative suivante le reprendra.
      if (error.data?.code === 'UNAUTHORIZED') {
        void refreshSession().catch(() => undefined);
      }
    });

    socket.on('message:new', (message: Message) => {
      setLive((current) =>
        current.some((known) => known.id === message.id) ? current : [...current, message],
      );
      // On ne s'annonce pas ses propres messages, ni ceux qu'on est en train de lire.
      if (!viewingRef.current && message.author?.id !== user?.id) {
        setUnread((count) => count + 1);
      }
    });

    socket.on('app:error', (error: ChatError) => setFailure(error));

    return () => {
      socket.emit('cookbook:leave', { cookbookId });
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [cookbookId, enabled, queryClient, user?.id]);

  // Les pages remontent le temps : on les renverse pour l'ordre de lecture,
  // puis on ajoute le direct sans doublonner l'historique rechargé.
  const messages = useMemo(() => {
    const pages = history.data?.pages ?? [];
    const past = [...pages].reverse().flat();
    const known = new Set(past.map((message) => message.id));
    return [...past, ...live.filter((message) => !known.has(message.id))];
  }, [history.data, live]);

  const send = useCallback(
    async (content: string): Promise<void> => {
      setFailure(null);
      const socket = socketRef.current;
      if (socket !== null && socket.connected) {
        socket.emit('message:send', { cookbookId, content });
        return;
      }
      const message = await postMessage(cookbookId, content);
      setLive((current) => [...current, message]);
    },
    [cookbookId],
  );

  const setViewing = useCallback((viewing: boolean) => {
    viewingRef.current = viewing;
    if (viewing) {
      setUnread(0);
    }
  }, []);

  const value: ChatValue = useMemo(
    () => ({
      allowed: enabled,
      messages,
      status,
      failure,
      send,
      loadOlder: history.fetchNextPage,
      hasOlder: history.hasNextPage,
      loadingOlder: history.isFetchingNextPage,
      isPending: history.isPending,
      error: history.error,
      unread,
      setViewing,
    }),
    [
      enabled,
      failure,
      history.error,
      history.fetchNextPage,
      history.hasNextPage,
      history.isFetchingNextPage,
      history.isPending,
      messages,
      send,
      setViewing,
      status,
      unread,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
