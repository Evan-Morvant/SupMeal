import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MEAL_TYPES, type MealPlanEntry, type MealType } from '../../api/types';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Field';
import { ErrorState, PageLoader } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { useCookbooks } from '../cookbooks/cookbooks.hooks';
import { atLeast } from '../cookbooks/roles';
import { GenerateListDialog } from '../shopping-lists/GenerateListDialog';
import { AddToPlanDialog } from './AddToPlanDialog';
import { EditPlanEntryDialog } from './EditPlanEntryDialog';
import { useMealPlan } from './meal-plan.hooks';
import {
  formatDayLabel,
  formatWeekRange,
  isToday,
  shiftWeek,
  startOfWeekIso,
  toIso,
  weekDays,
} from './week';
import styles from './PlanningPage.module.css';

/**
 * Planning de la semaine. La semaine affichée et le planning consulté vivent
 * dans l'URL : un planning de groupe se transmet par son adresse.
 */
export function PlanningPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const monday = params.get('semaine') ?? startOfWeekIso();
  const cookbookId = params.get('cookbookId') ?? '';

  const days = weekDays(monday);
  const plan = useMealPlan({
    from: monday,
    to: toIso(days[6]),
    cookbookId: cookbookId === '' ? undefined : cookbookId,
  });
  const cookbooks = useCookbooks();

  const [adding, setAdding] = useState<{ date: string; meal: MealType } | null>(null);
  const [editing, setEditing] = useState<MealPlanEntry | null>(null);
  const [generating, setGenerating] = useState(false);

  function setParam(key: string, value: string): void {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      return next;
    });
  }

  /** Entrées d'un créneau : plusieurs repas peuvent partager la même case. */
  function entriesAt(date: string, meal: MealType): MealPlanEntry[] {
    return (plan.data ?? []).filter(
      (entry) => entry.date === date && entry.mealType === meal,
    );
  }

  const shared = cookbookId !== '';
  const targets = (cookbooks.data ?? []).filter((cookbook) =>
    atLeast(cookbook.myRole, 'EDITOR'),
  );

  return (
    <>
      <header className={styles.head}>
        <div className={styles.title}>
          <h1>Planning</h1>
          <p className={styles.lede}>
            {shared
              ? 'Ce que le groupe a prévu, toutes personnes confondues.'
              : 'Ce que vous avez prévu de cuisiner cette semaine.'}
          </p>
        </div>
      </header>

      <div className={styles.bar}>
        <Button
          variant="outline"
          size="sm"
          iconOnly
          aria-label="Semaine précédente"
          onClick={() => setParam('semaine', shiftWeek(monday, -1))}
        >
          <Icon name="chevronGauche" size={18} />
        </Button>
        <span className={styles.week}>{formatWeekRange(monday)}</span>
        <Button
          variant="outline"
          size="sm"
          iconOnly
          aria-label="Semaine suivante"
          onClick={() => setParam('semaine', shiftWeek(monday, 1))}
        >
          <Icon name="chevronDroite" size={18} />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setParam('semaine', startOfWeekIso())}>
          Cette semaine
        </Button>

        {targets.length > 0 && (
          <Select
            className={styles.scope}
            value={cookbookId}
            aria-label="Planning consulté"
            onChange={(event) => setParam('cookbookId', event.target.value)}
          >
            <option value="">Mon planning</option>
            {targets.map((cookbook) => (
              <option key={cookbook.id} value={cookbook.id}>
                {cookbook.name}
              </option>
            ))}
          </Select>
        )}

        <span className={styles.spacer} />

        <Button variant="outline" onClick={() => setGenerating(true)}>
          <Icon name="courses" size={20} />
          Liste de courses
        </Button>
        <Button onClick={() => setAdding({ date: monday, meal: 'dîner' })}>
          <Icon name="ajouter" size={20} />
          Ajouter un repas
        </Button>
      </div>

      {plan.isPending && <PageLoader label="Chargement du planning…" />}
      {plan.isError && <ErrorState error={plan.error} />}

      {plan.data !== undefined && (
        <div className={styles.grid}>
          <div className={styles.corner} />
          {days.map((day) => (
            <div
              className={[styles.dayHead, isToday(day) ? styles.today : '']
                .filter(Boolean)
                .join(' ')}
              key={toIso(day)}
            >
              {formatDayLabel(day)}
            </div>
          ))}

          {MEAL_TYPES.map((meal) => (
            <Fragment key={meal}>
              <div className={styles.mealHead}>{meal}</div>
              {days.map((day) => {
                const date = toIso(day);
                const entries = entriesAt(date, meal);
                return (
                  <div
                    className={styles.cell}
                    key={date + meal}
                    data-empty={entries.length === 0}
                  >
                    <span className={styles.cellDay}>{formatDayLabel(day)}</span>
                    {entries.map((entry) => (
                      <button
                        type="button"
                        className={styles.entry}
                        key={entry.id}
                        onClick={() => setEditing(entry)}
                      >
                        <span className={styles.entryTitle}>{entry.recipe?.title}</span>
                        {entry.servings !== null && (
                          <span className={styles.entryMeta}>{entry.servings} pers.</span>
                        )}
                        {/* Sur un planning partagé, savoir qui a prévu quoi. */}
                        {shared && entry.author !== null && (
                          <span className={styles.entryAuthor}>{entry.author.displayName}</span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      )}

      {plan.data !== undefined && plan.data.length === 0 && (
        <p className={styles.empty}>
          Rien de prévu cette semaine. Ajoutez un repas, ou planifiez une recette depuis sa fiche.
        </p>
      )}

      <AddToPlanDialog
        open={adding !== null}
        onClose={() => setAdding(null)}
        defaultDate={adding?.date}
        defaultMeal={adding?.meal}
        defaultCookbookId={cookbookId === '' ? undefined : cookbookId}
      />

      <EditPlanEntryDialog entry={editing} onClose={() => setEditing(null)} />

      <GenerateListDialog
        open={generating}
        onClose={() => setGenerating(false)}
        defaultFrom={monday}
        defaultTo={toIso(days[6])}
        defaultCookbookId={cookbookId === '' ? undefined : cookbookId}
      />
    </>
  );
}
