import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toApiError } from '../../api/errors';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Field, Input, Select } from '../../ui/Field';
import { Alert } from '../../ui/Feedback';
import { useCookbooks } from '../cookbooks/cookbooks.hooks';
import { atLeast } from '../cookbooks/roles';
import { useGenerateShoppingList } from './shopping-lists.hooks';

/**
 * Génère une liste depuis une fenêtre du planning. Une période sans repas
 * n'est pas une erreur du serveur mais une information à donner : on la
 * traite à part plutôt que d'afficher « entité non traitable ».
 */
export function GenerateListDialog({
  open,
  onClose,
  defaultFrom,
  defaultTo,
  defaultCookbookId,
}: {
  open: boolean;
  onClose: () => void;
  defaultFrom: string;
  defaultTo: string;
  defaultCookbookId?: string;
}): JSX.Element {
  const navigate = useNavigate();
  const generate = useGenerateShoppingList();
  const cookbooks = useCookbooks();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [cookbookId, setCookbookId] = useState(defaultCookbookId ?? '');

  useEffect(() => {
    if (open) {
      setFrom(defaultFrom);
      setTo(defaultTo);
      setCookbookId(defaultCookbookId ?? '');
      generate.reset();
    }
    // `generate` change à chaque rendu : seule l'ouverture doit réarmer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultFrom, defaultTo, defaultCookbookId]);

  const failure = generate.error === null ? null : toApiError(generate.error);
  const emptyWindow = failure?.status === 422;
  const targets = (cookbooks.data ?? []).filter((cookbook) =>
    atLeast(cookbook.myRole, 'EDITOR'),
  );

  return (
    <Dialog
      open={open}
      title="Générer une liste de courses"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={generate.isPending}>
            Annuler
          </Button>
          <Button
            disabled={from > to}
            loading={generate.isPending}
            onClick={() =>
              generate.mutate(
                {
                  fromDate: from,
                  toDate: to,
                  cookbookId: cookbookId === '' ? null : cookbookId,
                },
                {
                  onSuccess: (list) => {
                    onClose();
                    navigate('/shopping-lists/' + list.id);
                  },
                },
              )
            }
          >
            Générer
          </Button>
        </>
      }
    >
      {emptyWindow && (
        <Alert tone="warning">
          Aucun repas n'est prévu sur cette période : il n'y a rien à acheter. Planifiez des
          recettes, ou élargissez la fenêtre.
        </Alert>
      )}
      {failure !== null && !emptyWindow && <Alert>{failure.message}</Alert>}

      <p>
        Les ingrédients des repas planifiés sont regroupés et mis à l'échelle des portions
        prévues.
      </p>

      <Field label="Du">
        {(field) => (
          <Input
            {...field}
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        )}
      </Field>
      <Field label="Au">
        {(field) => (
          <Input
            {...field}
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        )}
      </Field>

      {targets.length > 0 && (
        <Field label="Planning">
          {(field) => (
            <Select
              {...field}
              value={cookbookId}
              onChange={(event) => setCookbookId(event.target.value)}
            >
              <option value="">Mon planning</option>
              {targets.map((cookbook) => (
                <option key={cookbook.id} value={cookbook.id}>
                  {cookbook.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
    </Dialog>
  );
}
