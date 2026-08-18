import { useEffect, useState } from 'react';
import { errorMessage } from '../../api/errors';
import type { MealPlanEntry } from '../../api/types';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Alert } from '../../ui/Feedback';
import { MealSlotFields, type MealSlot } from './MealSlotFields';
import { useDeleteMealPlanEntry, useUpdateMealPlanEntry } from './meal-plan.hooks';
import styles from './PlanningDialogs.module.css';

/** Déplacer un repas, changer ses portions, ou le retirer du planning. */
export function EditPlanEntryDialog({
  entry,
  onClose,
}: {
  entry: MealPlanEntry | null;
  onClose: () => void;
}): JSX.Element {
  const updateEntry = useUpdateMealPlanEntry();
  const deleteEntry = useDeleteMealPlanEntry();
  const [slot, setSlot] = useState<MealSlot>({
    date: '',
    mealType: 'dîner',
    servings: '',
  });

  useEffect(() => {
    if (entry !== null) {
      setSlot({
        date: entry.date,
        mealType: entry.mealType,
        servings: entry.servings === null ? '' : String(entry.servings),
      });
    }
  }, [entry]);

  const failure = updateEntry.error ?? deleteEntry.error;

  return (
    <Dialog
      open={entry !== null}
      title="Modifier ce repas"
      onClose={onClose}
      actions={
        <>
          <Button
            variant="danger"
            loading={deleteEntry.isPending}
            onClick={() =>
              entry !== null &&
              deleteEntry.mutate(entry.id, { onSuccess: onClose })
            }
          >
            Retirer
          </Button>
          <Button
            loading={updateEntry.isPending}
            onClick={() =>
              entry !== null &&
              updateEntry.mutate(
                {
                  entryId: entry.id,
                  patch: {
                    date: slot.date,
                    mealType: slot.mealType,
                    servings: slot.servings === '' ? null : Number(slot.servings),
                  },
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
      {failure !== null && <Alert>{errorMessage(failure)}</Alert>}

      <p className={styles.recipeName}>{entry?.recipe?.title}</p>

      <MealSlotFields value={slot} onChange={setSlot} />

      <p className={styles.notice}>
        Un repas ne passe pas d'un planning à l'autre : les droits qui l'encadrent
        changeraient en route. Retirez-le et replanifiez-le sur l'autre planning.
      </p>
    </Dialog>
  );
}
