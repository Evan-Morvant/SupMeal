import { useEffect, useState } from 'react';
import { errorMessage } from '../../api/errors';
import type { UserPreferences } from '../../api/types';
import { Button } from '../../ui/Button';
import { Field, Input } from '../../ui/Field';
import { Alert, ErrorState, PageLoader } from '../../ui/Feedback';
import { TokenInput } from '../../ui/TokenInput';
import { useIngredientSearch, useTags } from '../catalog/catalog.hooks';
import { usePreferences, useReplacePreferences } from './settings.hooks';
import styles from './Settings.module.css';

const EMPTY: UserPreferences = {
  diets: [],
  allergies: [],
  preferredCuisines: [],
  defaultServings: 2,
};

/**
 * Préférences culinaires. Elles ne filtrent rien à l'affichage : elles
 * alimentent les suggestions, et les allergies en écartent des recettes.
 */
export function PreferencesTab(): JSX.Element {
  const preferences = usePreferences();
  const replace = useReplacePreferences();
  const [draft, setDraft] = useState<UserPreferences>(EMPTY);
  const [servings, setServings] = useState('2');
  const [allergyQuery, setAllergyQuery] = useState('');
  const allergyMatches = useIngredientSearch(allergyQuery);
  const tags = useTags();

  useEffect(() => {
    if (preferences.data !== undefined) {
      setDraft(preferences.data);
      setServings(
        preferences.data.defaultServings === null ? '' : String(preferences.data.defaultServings),
      );
    }
  }, [preferences.data]);

  if (preferences.isPending) {
    return <PageLoader label="Chargement de vos préférences…" />;
  }
  if (preferences.isError) {
    return <ErrorState error={preferences.error} title="Préférences indisponibles" />;
  }

  const tagNames = (tags.data ?? []).map((tag) => tag.name);

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Préférences culinaires</h2>
      <p className={styles.note}>
        Elles ne masquent aucune recette : elles servent à vous en proposer.
      </p>

      {replace.isError && <Alert>{errorMessage(replace.error)}</Alert>}
      {replace.isSuccess && <Alert tone="success">Préférences enregistrées.</Alert>}

      <Field label="Régime">
        {() => (
          <TokenInput
            label="Régimes suivis"
            values={draft.diets}
            onChange={(diets) => setDraft({ ...draft, diets })}
            suggestions={tagNames}
            placeholder="végétarien, sans gluten…"
            max={20}
          />
        )}
      </Field>

      <Field label="Allergies">
        {() => (
          <TokenInput
            label="Allergies déclarées"
            values={draft.allergies}
            onChange={(allergies) => setDraft({ ...draft, allergies })}
            suggestions={(allergyMatches.data ?? []).map((item) => item.name)}
            onQueryChange={setAllergyQuery}
            loading={allergyMatches.isFetching}
            placeholder="arachide, fruits de mer…"
            hint="La correspondance est volontairement large : « arachide » écarte aussi le beurre d'arachide."
            max={50}
          />
        )}
      </Field>

      <Field label="Cuisines préférées">
        {() => (
          <TokenInput
            label="Cuisines préférées"
            values={draft.preferredCuisines}
            onChange={(preferredCuisines) => setDraft({ ...draft, preferredCuisines })}
            suggestions={tagNames}
            placeholder="italienne, thaïe…"
            max={20}
          />
        )}
      </Field>

      <Field label="Portions par défaut" hint="Proposées à la création d'une recette.">
        {(field) => (
          <Input
            {...field}
            type="number"
            min={1}
            max={50}
            value={servings}
            onChange={(event) => setServings(event.target.value)}
          />
        )}
      </Field>

      <div className={styles.actions}>
        <Button
          loading={replace.isPending}
          onClick={() =>
            replace.mutate({
              ...draft,
              defaultServings: servings === '' ? 2 : Number(servings),
            })
          }
        >
          Enregistrer
        </Button>
      </div>
    </section>
  );
}
