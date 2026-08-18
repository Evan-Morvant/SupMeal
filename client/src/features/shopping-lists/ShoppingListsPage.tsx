import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ShoppingList } from '../../api/types';
import { formatDate } from '../../lib/format';
import { Button } from '../../ui/Button';
import { cardClass } from '../../ui/Card';
import { EmptyState, ErrorState, PageLoader } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { startOfWeekIso, toIso, weekDays } from '../meal-plan/week';
import { GenerateListDialog } from './GenerateListDialog';
import { useShoppingLists } from './shopping-lists.hooks';
import styles from './ShoppingLists.module.css';

/** « 3 sur 12 » : ce qui reste à prendre se lit mieux que ce qui est fait. */
function progressOf(list: ShoppingList): string {
  const done = list.items.filter((item) => item.checked).length;
  return done + ' / ' + list.items.length;
}

export function ShoppingListsPage(): JSX.Element {
  const lists = useShoppingLists();
  const [generating, setGenerating] = useState(false);
  const monday = startOfWeekIso();

  return (
    <>
      <header className={styles.head}>
        <div className={styles.title}>
          <h1>Listes de courses</h1>
          <p className={styles.lede}>
            Générées depuis votre planning, personnelles ou partagées avec un groupe.
          </p>
        </div>
        <Button onClick={() => setGenerating(true)}>
          <Icon name="ajouter" size={20} />
          Générer une liste
        </Button>
      </header>

      {lists.isPending && <PageLoader label="Chargement de vos listes…" />}
      {lists.isError && <ErrorState error={lists.error} />}

      {lists.data !== undefined && lists.data.length === 0 && (
        <EmptyState
          title="Aucune liste pour l'instant"
          action={<Button onClick={() => setGenerating(true)}>Générer ma première liste</Button>}
        >
          <p>
            Planifiez quelques repas, puis générez la liste : les ingrédients sont regroupés et
            mis à l'échelle des portions prévues.
          </p>
        </EmptyState>
      )}

      {lists.data !== undefined && lists.data.length > 0 && (
        <div className={styles.grid}>
          {lists.data.map((list) => (
            <article className={cardClass({ className: styles.card })} key={list.id}>
              <h2 className={styles.cardTitle}>
                <Link to={'/shopping-lists/' + list.id} className={styles.link}>
                  {list.name}
                </Link>
              </h2>
              <p className={styles.meta}>
                Du {formatDate(list.fromDate)} au {formatDate(list.toDate)}
              </p>
              <p className={styles.progress}>{progressOf(list)} coché</p>
            </article>
          ))}
        </div>
      )}

      <GenerateListDialog
        open={generating}
        onClose={() => setGenerating(false)}
        defaultFrom={monday}
        defaultTo={toIso(weekDays(monday)[6])}
      />
    </>
  );
}
