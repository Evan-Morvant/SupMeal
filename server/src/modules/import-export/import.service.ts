import { ZodError } from 'zod';
import { AppError } from '../../common/app-error';
import { createRecipeSchema } from '../recipes/recipes.schemas';
import { createRecipe, findOwnedTitles } from '../recipes/recipes.service';
import { malformedFile } from './formats/values';
import type { ParsedFile, RecipeView } from './import-export.types';

/**
 * Import des recettes lues dans un fichier.
 *
 * L'importeur devient créateur de tout ce qu'il importe, conformément au
 * cahier des charges : aucune recette n'est rattachée à son auteur d'origine,
 * qui n'existe d'ailleurs pas forcément sur cette instance.
 *
 * Une recette invalide n'interrompt pas l'import : elle est consignée dans le
 * rapport et les suivantes continuent. Un fichier de cent recettes dont une
 * seule est mal formée doit en importer quatre-vingt-dix-neuf.
 */

/** Garde-fou : au-delà, le fichier relève d'une restauration administrative. */
const MAX_RECIPES = 500;

/** Un rapport doit rester lisible : les erreurs au-delà sont dénombrées. */
const MAX_REPORTED_ERRORS = 50;

export interface ImportReport {
  created: number;
  skipped: number;
  errors: string[];
}

/** Message d'erreur nommant la recette fautive et les champs en cause. */
function describeFailure(index: number, title: string, error: ZodError): string {
  const fields = error.issues
    .map((issue) => (issue.path.length === 0 ? issue.message : issue.path.join('.')))
    .filter((field, position, all) => all.indexOf(field) === position)
    .join(', ');
  const name = title === '' ? 'sans titre' : '« ' + title + ' »';
  return 'Recette ' + (index + 1) + ' (' + name + ') : champs invalides - ' + fields;
}

/** Import du contenu d'un fichier. */
export function importFile(userId: string, file: ParsedFile): Promise<ImportReport> {
  return importRecipes(userId, file.recipes);
}

async function importRecipes(userId: string, recipes: RecipeView[]): Promise<ImportReport> {
  if (recipes.length === 0) {
    throw malformedFile('Aucune recette trouvée dans le fichier');
  }
  if (recipes.length > MAX_RECIPES) {
    throw new AppError(
      422,
      'TOO_MANY_RECIPES',
      'Fichier trop volumineux : ' + MAX_RECIPES + ' recettes au maximum par import',
    );
  }

  const report: ImportReport = { created: 0, skipped: 0, errors: [] };
  const addError = (message: string): void => {
    if (report.errors.length < MAX_REPORTED_ERRORS) {
      report.errors.push(message);
    }
  };

  // Titres déjà possédés, chargés une fois : réimporter le même fichier deux
  // fois ne doit pas dupliquer les recettes. L'ensemble s'enrichit au fil de
  // l'import, ce qui couvre aussi les doublons internes au fichier.
  const ownedTitles = await findOwnedTitles(userId);

  for (const [index, recipe] of recipes.entries()) {
    const parsed = createRecipeSchema.safeParse(recipe);
    if (!parsed.success) {
      addError(describeFailure(index, recipe.title, parsed.error));
      continue;
    }

    const key = parsed.data.title.trim().toLowerCase();
    if (ownedTitles.has(key)) {
      report.skipped += 1;
      continue;
    }

    try {
      await createRecipe(userId, parsed.data);
      ownedTitles.add(key);
      report.created += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'erreur inconnue';
      addError('Recette ' + (index + 1) + ' (« ' + parsed.data.title + ' ») : ' + reason);
    }
  }

  return report;
}
