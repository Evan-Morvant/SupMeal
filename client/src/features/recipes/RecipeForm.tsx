import { useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../api/errors';
import type { Recipe, RecipeInput } from '../../api/types';
import { Button, buttonClass } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Field, Input, Select, Textarea } from '../../ui/Field';
import { Alert } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { Logo } from '../../ui/Logo';
import { TokenInput } from '../../ui/TokenInput';
import { useTags } from '../catalog/catalog.hooks';
import { IMAGE_MAX_BYTES, IMAGE_TYPES } from './recipes.api';
import { formToInput, recipeFormSchema, type RecipeFormValues } from './recipe-form';
import styles from './RecipeForm.module.css';

interface RecipeFormProps {
  heading: string;
  initial: RecipeFormValues;
  /** En modification : sert à montrer l'image déjà en place. */
  recipe?: Recipe;
  submitLabel: string;
  onSubmit: (input: RecipeInput, image: File | null) => Promise<void>;
  error?: unknown;
}

const MEGABYTE = 1024 * 1024;

export function RecipeForm({
  heading,
  initial,
  recipe,
  submitLabel,
  onSubmit,
  error,
}: RecipeFormProps): JSX.Element {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormValues>({ resolver: zodResolver(recipeFormSchema), defaultValues: initial });

  const ingredients = useFieldArray({ control, name: 'ingredients' });
  const steps = useFieldArray({ control, name: 'steps' });

  const tags = watch('tags');
  const visibility = watch('visibility');

  const [tagQuery, setTagQuery] = useState('');
  const allTags = useTags();
  /*
   * `/tags` rend le vocabulaire entier : le filtrage se fait ici, sans
   * réinterroger le réseau à chaque frappe.
   */
  const tagSuggestions = useMemo(() => {
    const needle = tagQuery.trim().toLowerCase();
    const names = (allTags.data ?? []).map((tag) => tag.name);
    if (needle === '') {
      return names.slice(0, 12);
    }
    return names.filter((name) => name.toLowerCase().includes(needle)).slice(0, 20);
  }, [allTags.data, tagQuery]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // L'URL d'aperçu retient le fichier en mémoire : la révoquer est le seul
  // moyen de le relâcher quand on change de photo ou qu'on quitte l'écran.
  useEffect(() => {
    if (image === null) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function pickImage(file: File | undefined): void {
    setImageError(null);
    if (file === undefined) {
      return;
    }
    // Le serveur refuserait le fichier : autant le dire avant l'envoi.
    if (!IMAGE_TYPES.includes(file.type)) {
      setImageError('Formats acceptés : JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setImageError('Image trop lourde : ' + IMAGE_MAX_BYTES / MEGABYTE + ' Mo au maximum.');
      return;
    }
    setImage(file);
  }

  const submit = handleSubmit(async (values) => {
    await onSubmit(formToInput(values), image);
  });

  const shownImage = preview ?? recipe?.imageUrl ?? null;

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <header className={styles.head}>
        <Link to={recipe === undefined ? '/recipes' : '/recipes/' + recipe.id} className={styles.back}>
          <Icon name="chevronGauche" size={16} />
          {recipe === undefined ? 'Mes recettes' : recipe.title}
        </Link>
        <h1>{heading}</h1>
      </header>

      {error !== undefined && error !== null && <Alert>{errorMessage(error)}</Alert>}

      <Card className={styles.block}>
        <Field label="Titre" error={errors.title?.message}>
          {(field) => (
            <Input
              {...field}
              {...register('title')}
              placeholder="Tarte aux pommes de ma grand-mère"
              invalid={errors.title !== undefined}
            />
          )}
        </Field>

        <Field
          label="Description"
          optional
          hint="Un résumé de quelques lignes. Il alimente aussi la recherche plein texte."
          error={errors.description?.message}
        >
          {(field) => (
            <Textarea
              {...field}
              {...register('description')}
              rows={3}
              invalid={errors.description !== undefined}
            />
          )}
        </Field>

        <div className={styles.measures}>
          <Field label="Préparation (min)" optional error={errors.prepTimeMin?.message}>
            {(field) => (
              <Input
                {...field}
                {...register('prepTimeMin')}
                type="number"
                min={0}
                inputMode="numeric"
                invalid={errors.prepTimeMin !== undefined}
              />
            )}
          </Field>
          <Field label="Cuisson (min)" optional error={errors.cookTimeMin?.message}>
            {(field) => (
              <Input
                {...field}
                {...register('cookTimeMin')}
                type="number"
                min={0}
                inputMode="numeric"
                invalid={errors.cookTimeMin !== undefined}
              />
            )}
          </Field>
          <Field label="Portions" optional error={errors.servings?.message}>
            {(field) => (
              <Input
                {...field}
                {...register('servings')}
                type="number"
                min={1}
                inputMode="numeric"
                invalid={errors.servings !== undefined}
              />
            )}
          </Field>
        </div>
      </Card>

      <Card className={styles.block}>
        <h2 className={styles.blockTitle}>Ingrédients</h2>
        <p className={styles.blockNote}>
          La quantité peut rester vide : le sel et le poivre n'en ont pas.
        </p>

        <div className={styles.rows}>
          {ingredients.fields.map((row, index) => {
            const rowError = errors.ingredients?.[index];
            return (
            <div className={styles.ingredientRow} key={row.id}>
              {/*
               * Les exemples ne figurent que sur la première ligne : répétés,
               * ils se lisent comme des valeurs déjà saisies — « 250 g » en
               * gris sur une ligne vide trompe au premier coup d'œil.
               */}
              <Input
                {...register(`ingredients.${index}.quantity`)}
                placeholder={index === 0 ? '250' : undefined}
                aria-label={'Quantité de l’ingrédient ' + (index + 1)}
                invalid={rowError?.quantity !== undefined}
              />
              <Input
                {...register(`ingredients.${index}.unit`)}
                placeholder={index === 0 ? 'g' : undefined}
                aria-label={'Unité de l’ingrédient ' + (index + 1)}
                invalid={rowError?.unit !== undefined}
              />
              <Input
                {...register(`ingredients.${index}.name`)}
                placeholder={index === 0 ? 'farine' : undefined}
                aria-label={'Nom de l’ingrédient ' + (index + 1)}
                invalid={rowError?.name !== undefined}
              />
              <div className={styles.rowActions}>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  disabled={index === 0}
                  onClick={() => ingredients.move(index, index - 1)}
                  aria-label={'Remonter l’ingrédient ' + (index + 1)}
                >
                  <Icon name="chevronBas" size={16} className={styles.flip} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  disabled={index === ingredients.fields.length - 1}
                  onClick={() => ingredients.move(index, index + 1)}
                  aria-label={'Descendre l’ingrédient ' + (index + 1)}
                >
                  <Icon name="chevronBas" size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => ingredients.remove(index)}
                  aria-label={'Retirer l’ingrédient ' + (index + 1)}
                >
                  <Icon name="fermer" size={16} />
                </Button>
              </div>

              <Input
                className={styles.ingredientNote}
                {...register(`ingredients.${index}.note`)}
                placeholder={index === 0 ? 'précision : tamisée, à température ambiante…' : undefined}
                aria-label={'Précision sur l’ingrédient ' + (index + 1)}
                invalid={rowError?.note !== undefined}
              />

              {rowError !== undefined && (
                <p className={styles.rowError}>
                  {rowError.name?.message ??
                    rowError.quantity?.message ??
                    rowError.unit?.message ??
                    rowError.note?.message}
                </p>
              )}
            </div>
            );
          })}
        </div>

        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => ingredients.append({ name: '', quantity: '', unit: '', note: '' })}
          >
            <Icon name="ajouter" size={18} />
            Ajouter un ingrédient
          </Button>
        </div>
      </Card>

      <Card className={styles.block}>
        <h2 className={styles.blockTitle}>Préparation</h2>
        <p className={styles.blockNote}>
          Une étape par ligne, dans l'ordre où on les suit. Les étapes vides sont ignorées.
        </p>

        <div className={styles.rows}>
          {steps.fields.map((row, index) => {
            const stepError = errors.steps?.[index]?.instruction;
            return (
            <div className={styles.stepRow} key={row.id}>
              <span className={styles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <Textarea
                {...register(`steps.${index}.instruction`)}
                rows={2}
                placeholder={index === 0 ? 'Préchauffer le four à 180 °C.' : undefined}
                aria-label={'Étape ' + (index + 1)}
                invalid={stepError !== undefined}
              />
              <div className={styles.rowActions}>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  disabled={index === 0}
                  onClick={() => steps.move(index, index - 1)}
                  aria-label={'Remonter l’étape ' + (index + 1)}
                >
                  <Icon name="chevronBas" size={16} className={styles.flip} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  disabled={index === steps.fields.length - 1}
                  onClick={() => steps.move(index, index + 1)}
                  aria-label={'Descendre l’étape ' + (index + 1)}
                >
                  <Icon name="chevronBas" size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={() => steps.remove(index)}
                  aria-label={'Retirer l’étape ' + (index + 1)}
                >
                  <Icon name="fermer" size={16} />
                </Button>
              </div>
              {stepError !== undefined && (
                <p className={styles.rowError}>{stepError.message}</p>
              )}
            </div>
            );
          })}
        </div>

        <div>
          <Button variant="outline" size="sm" onClick={() => steps.append({ instruction: '' })}>
            <Icon name="ajouter" size={18} />
            Ajouter une étape
          </Button>
        </div>
      </Card>

      <Card className={styles.block}>
        <h2 className={styles.blockTitle}>Classement et partage</h2>

        <TokenInput
          label="Tags"
          values={tags}
          onChange={(values) => setValue('tags', values, { shouldDirty: true })}
          suggestions={tagSuggestions}
          onQueryChange={setTagQuery}
          placeholder="végétarien, dessert…"
          hint="Choisissez dans les tags existants, ou tapez le vôtre puis Entrée."
          max={30}
        />

        <Field label="Source" optional hint="Une adresse web, un livre, une personne." error={errors.source?.message}>
          {(field) => (
            <Input
              {...field}
              {...register('source')}
              placeholder="https://…"
              invalid={errors.source !== undefined}
            />
          )}
        </Field>

        <Field label="Visibilité">
          {(field) => (
            <Select {...field} {...register('visibility')}>
              <option value="private">Privée — vous et vos cookbooks</option>
              <option value="public">Publique — visible dans la découverte</option>
            </Select>
          )}
        </Field>

        {/*
         * Mention exigée par la conception : rendre une recette publique
         * expose aussi ses tags, et un tag libre peut contenir un prénom.
         */}
        {visibility === 'public' && (
          <Alert tone="warning">
            Une recette publique rend ses tags visibles de tous, y compris ceux que vous avez
            écrits vous-même. Vérifiez qu'aucun ne contient un nom ou une information privée.
          </Alert>
        )}
      </Card>

      <Card className={styles.block}>
        <h2 className={styles.blockTitle}>Photo</h2>
        <div className={styles.imageBlock}>
          {shownImage === null ? (
            <div className={styles.previewEmpty}>
              <Logo size={56} decorative mono />
            </div>
          ) : (
            <img className={styles.preview} src={shownImage} alt="" />
          )}

          <div>
            <input
              ref={fileRef}
              className={styles.file}
              type="file"
              accept={IMAGE_TYPES.join(',')}
              onChange={(event) => pickImage(event.target.files?.[0])}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Icon name="image" size={18} />
              {shownImage === null ? 'Choisir une photo' : 'Remplacer la photo'}
            </Button>
            <p className={styles.fileHint}>JPEG, PNG ou WebP, {IMAGE_MAX_BYTES / MEGABYTE} Mo au maximum.</p>
            {imageError !== null && <Alert>{imageError}</Alert>}
          </div>
        </div>
      </Card>

      <div className={styles.actions}>
        <Link
          to={recipe === undefined ? '/recipes' : '/recipes/' + recipe.id}
          className={buttonClass({ variant: 'ghost' })}
        >
          Annuler
        </Link>
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
