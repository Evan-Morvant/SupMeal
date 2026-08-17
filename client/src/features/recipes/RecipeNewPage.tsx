import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Recipe, RecipeInput } from '../../api/types';
import { useCreateRecipeInCookbook } from '../cookbooks/cookbooks.hooks';
import { RecipeForm } from './RecipeForm';
import { emptyRecipeForm } from './recipe-form';
import { useCreateRecipe, useUploadRecipeImage } from './recipes.hooks';

/**
 * La photo part **après** la recette : la route d'image a besoin d'un
 * identifiant, qui n'existe pas avant l'enregistrement.
 *
 * Avec `?cookbookId=`, la recette est créée directement dans le cookbook —
 * une seule requête, là où créer puis ranger en demanderait deux et laisserait
 * une recette orpheline si la seconde échouait.
 */
export function RecipeNewPage(): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const cookbookId = params.get('cookbookId');

  const createRecipe = useCreateRecipe();
  const createInCookbook = useCreateRecipeInCookbook(cookbookId ?? '');
  const uploadImage = useUploadRecipeImage();

  const creation = cookbookId === null ? createRecipe : createInCookbook;

  async function submit(input: RecipeInput, image: File | null): Promise<void> {
    const recipe = (await creation.mutateAsync(input)) as Recipe;
    if (image !== null) {
      // La recette est enregistrée : un échec de la photo ne doit pas
      // renvoyer l'utilisateur au formulaire et lui faire tout ressaisir.
      await uploadImage.mutateAsync({ id: recipe.id, file: image }).catch(() => undefined);
    }
    navigate(
      cookbookId === null
        ? '/recipes/' + recipe.id
        : '/cookbooks/' + cookbookId + '/recipes/' + recipe.id,
      { replace: true },
    );
  }

  return (
    <RecipeForm
      heading="Nouvelle recette"
      initial={emptyRecipeForm(null)}
      submitLabel="Enregistrer la recette"
      onSubmit={submit}
      error={creation.error}
    />
  );
}
