import { createContext, useContext, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/errors';
import type { Cookbook } from '../../api/types';
import { Button, buttonClass } from '../../ui/Button';
import { ConfirmDialog, Dialog } from '../../ui/Dialog';
import { Field, Input, Textarea } from '../../ui/Field';
import { Alert, ErrorState, PageLoader } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { ChatProvider } from '../messages/ChatProvider';
import { useChat } from '../messages/chat-context';
import { RoleBadge } from './RoleBadge';
import {
  useCookbook,
  useDeleteCookbook,
  useLeaveCookbook,
  useUpdateCookbook,
} from './cookbooks.hooks';
import { atLeast } from './roles';
import styles from './CookbookLayout.module.css';

/**
 * Le cookbook chargé une fois pour tous ses onglets. Le recharger dans chacun
 * ferait clignoter l'en-tête à chaque changement d'onglet.
 */
const CookbookContext = createContext<Cookbook | null>(null);

export function useCurrentCookbook(): Cookbook {
  const cookbook = useContext(CookbookContext);
  if (cookbook === null) {
    throw new Error('useCurrentCookbook doit être utilisé dans CookbookLayout');
  }
  return cookbook;
}

function EditDialog({
  cookbook,
  open,
  onClose,
}: {
  cookbook: Cookbook;
  open: boolean;
  onClose: () => void;
}): JSX.Element {
  const updateCookbook = useUpdateCookbook(cookbook.id);
  const [name, setName] = useState(cookbook.name);
  const [description, setDescription] = useState(cookbook.description ?? '');

  return (
    <Dialog
      open={open}
      title="Modifier le cookbook"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={updateCookbook.isPending}>
            Annuler
          </Button>
          <Button
            disabled={name.trim() === ''}
            loading={updateCookbook.isPending}
            onClick={() =>
              updateCookbook.mutate(
                {
                  name: name.trim(),
                  description: description.trim() === '' ? null : description.trim(),
                },
                { onSuccess: onClose },
              )
            }
          >
            Enregistrer
          </Button>
        </>
      }
    >
      {updateCookbook.isError && <Alert>{errorMessage(updateCookbook.error)}</Alert>}
      <Field label="Nom">
        {(field) => (
          <Input {...field} value={name} onChange={(event) => setName(event.target.value)} />
        )}
      </Field>
      <Field label="Description" optional>
        {(field) => (
          <Textarea
            {...field}
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        )}
      </Field>
    </Dialog>
  );
}

/** Onglets du cookbook. Rendu dans le fournisseur, pour lire le compteur. */
function CookbookTabs({
  cookbook,
  canChat,
}: {
  cookbook: Cookbook;
  canChat: boolean;
}): JSX.Element {
  const { unread } = useChat();

  return (
    <nav className={styles.tabs} aria-label="Sections du cookbook">
      <NavLink to={'/cookbooks/' + cookbook.id} end className={styles.tab}>
        Recettes<span className={styles.tabCount}>{cookbook.recipeCount}</span>
      </NavLink>
      <NavLink to={'/cookbooks/' + cookbook.id + '/membres'} className={styles.tab}>
        Membres<span className={styles.tabCount}>{cookbook.memberCount}</span>
      </NavLink>
      {/* Le salon s'ouvre à partir de Commentateur, comme côté serveur. */}
      {canChat && (
        <NavLink to={'/cookbooks/' + cookbook.id + '/discussion'} className={styles.tab}>
          Discussion
          {unread > 0 && (
            <span className={styles.badge} aria-label={unread + ' nouveaux messages'}>
              {unread}
            </span>
          )}
        </NavLink>
      )}
    </nav>
  );
}

export function CookbookLayout(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cookbookQuery = useCookbook(id);
  const deleteCookbook = useDeleteCookbook(id ?? '');
  const leaveCookbook = useLeaveCookbook(id ?? '');
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<'delete' | 'leave' | null>(null);

  if (cookbookQuery.isPending) {
    return <PageLoader label="Chargement du cookbook…" />;
  }
  if (cookbookQuery.isError) {
    return (
      <ErrorState
        error={cookbookQuery.error}
        title="Cookbook introuvable"
        action={
          <Link to="/cookbooks" className={buttonClass({ variant: 'outline' })}>
            Retour aux cookbooks
          </Link>
        }
      />
    );
  }

  const cookbook = cookbookQuery.data;
  const isOwner = atLeast(cookbook.myRole, 'OWNER');
  const canChat = atLeast(cookbook.myRole, 'COMMENTER');
  const pending = deleteCookbook.isPending || leaveCookbook.isPending;
  const failure = deleteCookbook.error ?? leaveCookbook.error;

  return (
    <CookbookContext.Provider value={cookbook}>
      <header className={styles.head}>
        <div className={styles.heading}>
          <Link to="/cookbooks" className={styles.back}>
            <Icon name="chevronGauche" size={16} />
            Cookbooks
          </Link>
          <div className={styles.titleRow}>
            <h1>{cookbook.name}</h1>
            <RoleBadge role={cookbook.myRole} />
          </div>
          {cookbook.description !== null && (
            <p className={styles.description}>{cookbook.description}</p>
          )}
        </div>

        <div className={styles.actions}>
          {isOwner && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Icon name="modifier" size={20} />
              Modifier
            </Button>
          )}
          {isOwner ? (
            <Button variant="danger" onClick={() => setConfirming('delete')}>
              Supprimer
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setConfirming('leave')}>
              Quitter
            </Button>
          )}
        </div>
      </header>

      {/* Le 409 LAST_OWNER arrive ici : son message dit quoi faire. */}
      {failure !== null && <Alert>{errorMessage(failure)}</Alert>}

      {/*
        * Le salon est branché autour des onglets, non dedans : il reste ouvert
        * quel que soit l'onglet affiché, ce qui permet d'annoncer les messages
        * reçus pendant qu'on regarde ailleurs.
        */}
      <ChatProvider cookbookId={cookbook.id} enabled={canChat}>
        <CookbookTabs cookbook={cookbook} canChat={canChat} />
        <Outlet />
      </ChatProvider>

      <EditDialog cookbook={cookbook} open={editing} onClose={() => setEditing(false)} />

      <ConfirmDialog
        open={confirming === 'delete'}
        title="Supprimer ce cookbook ?"
        confirmLabel="Supprimer"
        busy={pending}
        onCancel={() => setConfirming(null)}
        onConfirm={() =>
          deleteCookbook.mutate(undefined, {
            onSuccess: () => navigate('/cookbooks', { replace: true }),
            onError: () => setConfirming(null),
          })
        }
      >
        <p>
          Les recettes qu'il rassemble ne sont pas supprimées : elles restent à leurs créateurs.
          Les commentaires du groupe, eux, disparaissent avec lui.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirming === 'leave'}
        title="Quitter ce cookbook ?"
        confirmLabel="Quitter"
        busy={pending}
        onCancel={() => setConfirming(null)}
        onConfirm={() =>
          leaveCookbook.mutate(undefined, {
            onSuccess: () => navigate('/cookbooks', { replace: true }),
            onError: () => setConfirming(null),
          })
        }
      >
        <p>
          Les recettes que vous y avez rangées restent au groupe. Il faudra une nouvelle
          invitation pour revenir.
        </p>
      </ConfirmDialog>
    </CookbookContext.Provider>
  );
}
