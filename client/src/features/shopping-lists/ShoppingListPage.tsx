import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/errors';
import type { ShoppingListItem } from '../../api/types';
import { formatDate } from '../../lib/format';
import { Button, buttonClass } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/Dialog';
import { Alert, EmptyState, ErrorState, PageLoader } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import {
  useDeleteShoppingList,
  useShoppingList,
  useToggleItem,
} from './shopping-lists.hooks';
import styles from './ShoppingLists.module.css';

/** Un ingrédient sans quantité — le sel, le poivre — le reste. */
function quantityOf(item: ShoppingListItem): string {
  if (item.quantity === null) {
    return item.unit ?? '';
  }
  const amount = String(item.quantity);
  return item.unit === null ? amount : amount + ' ' + item.unit;
}

export function ShoppingListPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const listQuery = useShoppingList(id);
  const toggleItem = useToggleItem(id ?? '');
  const deleteList = useDeleteShoppingList();
  const [confirming, setConfirming] = useState(false);

  if (listQuery.isPending) {
    return <PageLoader label="Chargement de la liste…" />;
  }
  if (listQuery.isError) {
    return (
      <ErrorState
        error={listQuery.error}
        title="Liste introuvable"
        action={
          <Link to="/shopping-lists" className={buttonClass({ variant: 'outline' })}>
            Retour aux listes
          </Link>
        }
      />
    );
  }

  const list = listQuery.data;
  const done = list.items.filter((item) => item.checked).length;

  return (
    <article>
      <Link to="/shopping-lists" className={styles.back}>
        <Icon name="chevronGauche" size={16} />
        Listes de courses
      </Link>

      <header className={styles.head}>
        <div className={styles.title}>
          <h1>{list.name}</h1>
          <p className={styles.lede}>
            Du {formatDate(list.fromDate)} au {formatDate(list.toDate)} — {done} sur{' '}
            {list.items.length} coché
          </p>
        </div>
        <Button variant="danger" onClick={() => setConfirming(true)}>
          <Icon name="supprimer" size={20} />
          Supprimer
        </Button>
      </header>

      {/*
       * La liste est un instantané : elle a été écrite à la génération, et
       * modifier une recette ensuite ne la réécrit pas.
       */}
      <p className={styles.snapshot}>
        Établie au moment de la génération : modifier une recette ensuite ne changera pas
        cette liste. Deux quantités ne se cumulent que dans la même unité — « 2 pommes » et
        « 200 g de pommes » restent deux lignes.
      </p>

      {deleteList.isError && <Alert>{errorMessage(deleteList.error)}</Alert>}

      {list.items.length === 0 ? (
        <EmptyState title="Cette liste est vide" />
      ) : (
        <div className={styles.items}>
          {list.items.map((item) => (
            <label
              className={[styles.item, item.checked ? styles.done : ''].filter(Boolean).join(' ')}
              key={item.id}
            >
              <input
                className={styles.checkbox}
                type="checkbox"
                checked={item.checked}
                onChange={(event) =>
                  toggleItem.mutate({ itemId: item.id, checked: event.target.checked })
                }
              />
              <span className={styles.quantity}>{quantityOf(item)}</span>
              <span className={styles.name}>{item.ingredient?.name}</span>
            </label>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Supprimer cette liste ?"
        confirmLabel="Supprimer"
        busy={deleteList.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          deleteList.mutate(list.id, {
            onSuccess: () => navigate('/shopping-lists', { replace: true }),
            onError: () => setConfirming(false),
          })
        }
      >
        <p>Le planning dont elle est issue n'est pas touché : elle se régénère à volonté.</p>
      </ConfirmDialog>
    </article>
  );
}
