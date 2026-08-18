import { useEffect, useState } from 'react';
import { errorMessage } from '../../api/errors';
import type { MealType, RecipeSummary } from '../../api/types';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Field, Input, Select } from '../../ui/Field';
import { Alert } from '../../ui/Feedback';
import { useDebounce } from '../../hooks/useDebounce';
import { useCookbooks } from '../cookbooks/cookbooks.hooks';
import { atLeast } from '../cookbooks/roles';
import { useRecipes } from '../recipes/recipes.hooks';
import { MealSlotFields, type MealSlot } from './MealSlotFields';
import { useAddMealPlanEntry } from './meal-plan.hooks';
import { toIso } from './week';
import styles from './PlanningDialogs.module.css';

/**
 * Ajout au planning. La recette est déjà connue quand on vient de sa fiche ;
 * depuis le planning, il faut la choisir.
 */
export function AddToPlanDialog({
  recipe,
  open,
  onClose,
  defaultDate,
  defaultMeal,
  defaultCookbookId,
}: {
  recipe?: RecipeSummary;
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
  defaultMeal?: MealType;
  defaultCookbookId?: string;
}): JSX.Element {
  const addEntry = useAddMealPlanEntry();
  const cookbooks = useCookbooks();
  const [slot, setSlot] = useState<MealSlot>({
    date: defaultDate ?? toIso(new Date()),
    mealType: defaultMeal ?? 'dîner',
    servings: '',
  });
  const [cookbookId, setCookbookId] = useState(defaultCookbookId ?? '');
  const [pickedId, setPickedId] = useState(recipe?.id ?? '');
  const [query, setQuery] = useState('');
  const settled = useDebounce(query.trim(), 300);
  const candidates = useRecipes({
    q: settled === '' ? undefined : settled,
    page: 1,
    pageSize: 20,
  });

  useEffect(() => {
    if (open) {
      setSlot({
        date: defaultDate ?? toIso(new Date()),
        mealType: defaultMeal ?? 'dîner',
        servings: '',
      });
      setCookbookId(defaultCookbookId ?? '');
      setPickedId(recipe?.id ?? '');
    }
  }, [open, defaultDate, defaultMeal, defaultCookbookId, recipe?.id]);

  // Seul un éditeur peut alimenter le planning d'un groupe.
  const targets = (cookbooks.data ?? []).filter((cookbook) =>
    atLeast(cookbook.myRole, 'EDITOR'),
  );

  return (
    <Dialog
      open={open}
      title={recipe === undefined ? 'Ajouter un repas' : 'Planifier ' + recipe.title}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={addEntry.isPending}>
            Annuler
          </Button>
          <Button
            disabled={pickedId === ''}
            loading={addEntry.isPending}
            onClick={() =>
              addEntry.mutate(
                {
                  recipeId: pickedId,
                  date: slot.date,
                  mealType: slot.mealType,
                  servings: slot.servings === '' ? null : Number(slot.servings),
                  cookbookId: cookbookId === '' ? null : cookbookId,
                },
                { onSuccess: onClose },
              )
            }
          >
            Planifier
          </Button>
        </>
      }
    >
      {addEntry.isError && <Alert>{errorMessage(addEntry.error)}</Alert>}

      {recipe === undefined && (
        <Field label="Recette">
          {(field) => (
            <div className={styles.picker}>
              <Input
                {...field}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Chercher parmi mes recettes"
              />
              <div className={styles.options}>
                {(candidates.data?.items ?? []).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={[styles.option, item.id === pickedId ? styles.picked : '']
                      .filter(Boolean)
                      .join(' ')}
                    aria-pressed={item.id === pickedId}
                    onClick={() => setPickedId(item.id)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Field>
      )}

      <MealSlotFields value={slot} onChange={setSlot} />

      {targets.length > 0 && (
        <Field label="Planning" hint="Un planning de groupe est visible de tous ses membres.">
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
