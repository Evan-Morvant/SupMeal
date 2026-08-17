import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../api/errors';
import { Button } from '../../ui/Button';
import { cardClass } from '../../ui/Card';
import { Dialog } from '../../ui/Dialog';
import { Field, Input, Textarea } from '../../ui/Field';
import { Alert, EmptyState, ErrorState, PageLoader } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { RoleBadge } from './RoleBadge';
import { useCookbooks, useCreateCookbook } from './cookbooks.hooks';
import styles from './CookbooksPage.module.css';

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element {
  const createCookbook = useCreateCookbook();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  function submit(): void {
    createCookbook.mutate(
      { name: name.trim(), description: description.trim() === '' ? null : description.trim() },
      {
        onSuccess: () => {
          setName('');
          setDescription('');
          onClose();
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      title="Nouveau cookbook"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={createCookbook.isPending}>
            Annuler
          </Button>
          <Button
            onClick={submit}
            disabled={name.trim() === ''}
            loading={createCookbook.isPending}
          >
            Créer
          </Button>
        </>
      }
    >
      {createCookbook.isError && <Alert>{errorMessage(createCookbook.error)}</Alert>}
      <Field label="Nom">
        {(field) => (
          <Input
            {...field}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Recettes de famille"
            autoFocus
          />
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

/**
 * Cookbooks dont on est membre — créés ou rejoints, la liste ne les distingue
 * pas : c'est le rôle qui compte, et il est affiché.
 */
export function CookbooksPage(): JSX.Element {
  const cookbooks = useCookbooks();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <header className={styles.head}>
        <div className={styles.title}>
          <h1>Cookbooks</h1>
          <p className={styles.lede}>Vos carnets partagés, et ceux où l'on vous a invité.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Icon name="ajouter" size={20} />
          Nouveau cookbook
        </Button>
      </header>

      {cookbooks.isPending && <PageLoader label="Chargement de vos cookbooks…" />}
      {cookbooks.isError && <ErrorState error={cookbooks.error} />}

      {cookbooks.data !== undefined && cookbooks.data.length === 0 && (
        <EmptyState
          title="Aucun cookbook pour l'instant"
          action={<Button onClick={() => setCreating(true)}>Créer mon premier cookbook</Button>}
        >
          <p>
            Un cookbook rassemble des recettes et les partage avec d'autres, chacun avec son
            rôle.
          </p>
        </EmptyState>
      )}

      {cookbooks.data !== undefined && cookbooks.data.length > 0 && (
        <div className={styles.grid}>
          {cookbooks.data.map((cookbook) => (
            <article className={cardClass({ className: styles.card })} key={cookbook.id}>
              <h2 className={styles.cardTitle}>
                <Link to={'/cookbooks/' + cookbook.id} className={styles.link}>
                  {cookbook.name}
                </Link>
              </h2>
              {cookbook.description !== null && (
                <p className={styles.description}>{cookbook.description}</p>
              )}
              <p className={styles.counts}>
                <span className={styles.count}>
                  <Icon name="recettes" size={16} />
                  <span className={styles.number}>{cookbook.recipeCount}</span> recettes
                </span>
                <span className={styles.count}>
                  <Icon name="membres" size={16} />
                  <span className={styles.number}>{cookbook.memberCount}</span> membres
                </span>
              </p>
              <RoleBadge role={cookbook.myRole} />
            </article>
          ))}
        </div>
      )}

      <CreateDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
