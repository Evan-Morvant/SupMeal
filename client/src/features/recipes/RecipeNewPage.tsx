import { useNavigate } from 'react-router-dom';
import type { RecipeInput } from '../../api/types';
import { RecipeForm } from './RecipeForm';
import { emptyRecipeForm } from './recipe-form';
import { useCreateRecipe, useUploadRecipeImage } from './recipes.hooks';

/**
 * La photo part **après** la recette : la route d'image a besoin d'un
 * identifiant, qui n'existe pas avant l'enregistrement.
 */
export function RecipeNewPage(): JSX.Element {
  const navigate = useNavigate();
  const createRecipe = useCreateRecipe();
  const uploadImage = useUploadRecipeImage();

  async function submit(input: RecipeInput, image: File | null): Promise<void> {
    const recipe = await createRecipe.mutateAsync(input);
    if (image !== null) {
      // La recette est enregistrée : un échec de la photo ne doit pas
      // renvoyer l'utilisateur au formulaire et lui faire tout ressaisir.
      await uploadImage.mutateAsync({ id: recipe.id, file: image }).catch(() => undefined);
    }
    navigate('/recipes/' + recipe.id, { replace: true });
  }

  return (
    <RecipeForm
      heading="Nouvelle recette"
      initial={emptyRecipeForm(null)}
      submitLabel="Enregistrer la recette"
      onSubmit={submit}
      error={createRecipe.error}
    />
  );
}
