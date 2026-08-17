import { Link, useNavigate, useParams } from 'react-router-dom';
import type { RecipeInput } from '../../api/types';
import { buttonClass } from '../../ui/Button';
import { ErrorState, PageLoader } from '../../ui/Feedback';
import { RecipeForm } from './RecipeForm';
import { recipeToForm } from './recipe-form';
import { useRecipe, useUpdateRecipe, useUploadRecipeImage } from './recipes.hooks';

export function RecipeEditPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const recipeQuery = useRecipe(id);
  const updateRecipe = useUpdateRecipe(id ?? '');
  const uploadImage = useUploadRecipeImage();

  if (recipeQuery.isPending) {
    return <PageLoader label="Chargement de la recette…" />;
  }
  if (recipeQuery.isError) {
    return (
      <ErrorState
        error={recipeQuery.error}
        title="Recette introuvable"
        action={
          <Link to="/recipes" className={buttonClass({ variant: 'outline' })}>
            Retour à mes recettes
          </Link>
        }
      />
    );
  }

  const recipe = recipeQuery.data;

  async function submit(input: RecipeInput, image: File | null): Promise<void> {
    await updateRecipe.mutateAsync(input);
    if (image !== null) {
      await uploadImage.mutateAsync({ id: recipe.id, file: image }).catch(() => undefined);
    }
    navigate('/recipes/' + recipe.id, { replace: true });
  }

  return (
    <RecipeForm
      heading="Modifier la recette"
      initial={recipeToForm(recipe)}
      recipe={recipe}
      submitLabel="Enregistrer les modifications"
      onSubmit={submit}
      error={updateRecipe.error}
    />
  );
}
