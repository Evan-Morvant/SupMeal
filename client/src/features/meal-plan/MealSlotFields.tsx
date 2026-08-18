import { MEAL_TYPES, type MealType } from '../../api/types';
import { Field, Input, Select } from '../../ui/Field';

export interface MealSlot {
  date: string;
  mealType: MealType;
  servings: string;
}

/**
 * Quand et pour combien : les trois champs communs à l'ajout et à la
 * modification d'une entrée de planning. Les portions restent une chaîne, comme
 * dans le formulaire de recette — vide doit rester distinct de zéro.
 */
export function MealSlotFields({
  value,
  onChange,
}: {
  value: MealSlot;
  onChange: (slot: MealSlot) => void;
}): JSX.Element {
  return (
    <>
      <Field label="Jour">
        {(field) => (
          <Input
            {...field}
            type="date"
            value={value.date}
            onChange={(event) => onChange({ ...value, date: event.target.value })}
          />
        )}
      </Field>

      <Field label="Repas">
        {(field) => (
          <Select
            {...field}
            value={value.mealType}
            onChange={(event) =>
              onChange({ ...value, mealType: event.target.value as MealType })
            }
          >
            {MEAL_TYPES.map((meal) => (
              <option key={meal} value={meal}>
                {meal}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Portions" optional hint="À défaut, celles de la recette.">
        {(field) => (
          <Input
            {...field}
            type="number"
            min={1}
            value={value.servings}
            onChange={(event) => onChange({ ...value, servings: event.target.value })}
          />
        )}
      </Field>
    </>
  );
}
