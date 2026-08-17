import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../api/errors';
import { useAuth } from '../../auth/auth-context';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Textarea } from '../../ui/Field';
import { Alert, EmptyState, ErrorState, PageLoader } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { useChat, type ChatStatus } from './chat-context';
import styles from './ChatTab.module.css';

const STATUS_LABEL: Record<ChatStatus, string> = {
  connecting: 'Connexion…',
  online: 'En direct',
  offline: 'Hors ligne',
};

/** Heure seule : la date figure déjà dans l'ordre du fil. */
const TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function ChatTab(): JSX.Element {
  const { user } = useAuth();
  const chat = useChat();
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const lastId = chat.messages[chat.messages.length - 1]?.id;
  const { setViewing } = chat;

  /*
   * Tant que le salon est à l'écran, rien ne s'accumule : le compteur des
   * autres onglets repart de zéro en entrant et reprend en sortant.
   */
  useEffect(() => {
    setViewing(true);
    return () => setViewing(false);
  }, [setViewing]);

  /*
   * On suit le bas du fil à l'arrivée d'un message. Remonter chercher
   * l'historique ne doit pas déclencher ce saut : seul le dernier identifiant
   * sert de signal.
   */
  useEffect(() => {
    const thread = threadRef.current;
    if (thread !== null) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [lastId]);

  async function submit(): Promise<void> {
    const content = draft.trim();
    if (content === '') {
      return;
    }
    setSendError(null);
    setDraft('');
    try {
      await chat.send(content);
    } catch (error) {
      setDraft(content);
      setSendError(errorMessage(error));
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    // Entrée envoie, Maj+Entrée passe à la ligne : l'usage d'une messagerie.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  if (!chat.allowed) {
    return (
      <EmptyState title="Salon fermé">
        <p>Votre rôle vous permet de consulter le cookbook, pas d'accéder à sa discussion.</p>
      </EmptyState>
    );
  }
  if (chat.isPending) {
    return <PageLoader label="Chargement de la discussion…" />;
  }
  if (chat.error !== null) {
    return <ErrorState error={chat.error} title="Discussion indisponible" />;
  }

  return (
    <div className={styles.chat}>
      <div className={styles.head}>
        <p className={styles.note}>
          Salon du cookbook, ouvert aux membres à partir du rôle Commentateur.
        </p>
        <p className={styles.status}>
          <span className={`${styles.dot} ${styles[chat.status]}`} aria-hidden="true" />
          {STATUS_LABEL[chat.status]}
        </p>
      </div>

      <div className={styles.thread} ref={threadRef}>
        {chat.hasOlder && (
          <Button
            className={styles.older}
            variant="ghost"
            size="sm"
            loading={chat.loadingOlder}
            onClick={() => void chat.loadOlder()}
          >
            Voir les messages précédents
          </Button>
        )}

        {chat.messages.length === 0 && (
          <p className={styles.empty}>
            Rien n'a encore été dit ici. Lancez la conversation.
          </p>
        )}

        {chat.messages.map((message) => (
          <article
            className={[styles.message, message.author?.id === user?.id ? styles.mine : '']
              .filter(Boolean)
              .join(' ')}
            key={message.id}
          >
            <div className={styles.messageHead}>
              <Avatar
                displayName={message.author?.displayName ?? ''}
                avatarUrl={message.author?.avatarUrl}
                size={28}
              />
              <span className={styles.author}>{message.author?.displayName}</span>
              <span className={styles.time}>
                {TIME_FORMAT.format(new Date(message.createdAt))}
              </span>
            </div>
            <p className={styles.content}>{message.content}</p>
          </article>
        ))}
      </div>

      {chat.failure !== null && <Alert>{chat.failure.message}</Alert>}
      {sendError !== null && <Alert>{sendError}</Alert>}

      <div className={styles.form}>
        <Textarea
          className={styles.input}
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Écrire au groupe. Entrée pour envoyer, Maj+Entrée pour aller à la ligne."
          aria-label="Écrire un message"
          maxLength={2000}
        />
        <Button disabled={draft.trim() === ''} onClick={() => void submit()}>
          <Icon name="envoyer" size={20} />
          Envoyer
        </Button>
      </div>
    </div>
  );
}
