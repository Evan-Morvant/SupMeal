import { useState } from 'react';
import { errorMessage } from '../../api/errors';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Input } from '../../ui/Field';
import { Alert } from '../../ui/Feedback';
import { useDebounce } from '../../hooks/useDebounce';
import { useRecipes } from '../recipes/recipes.hooks';
import { useLinkRecipe } from './cookbooks.hooks';
import styles from './LinkRecipeDialog.module.css';

/**
 * Range une recette existante dans le cookbook. La liste proposée est celle
 * que l'appelant peut lire ; celles déjà rangées ici en sont retirées, pour ne
 * pas proposer un geste sans effet.
 */
export function LinkRecipeDialog({
  cookbookId,
  alreadyLinked,
  open,
  onClose,
}: {
  cookbookId: string;
  alreadyLinked: string[];
  open: boolean;
  onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const settled = useDebounce(query.trim(), 300);
  const recipes = useRecipes({
    q: settled === '' ? undefined : settled,
    page: 1,
    pageSize: 20,
  });
  const linkRecipe = useLinkRecipe(cookbookId);

  const candidates = (recipes.data?.items ?? []).filter(
    (recipe) => !alreadyLinked.includes(recipe.id),
  );

  return (
    <Dialog
      open={open}
      title="Ranger une recette"
      onClose={onClose}
      actions={
        <Button variant="ghost" onClick={onClose}>
          Fermer
        </Button>
      }
    >
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Chercher parmi mes recettes"
        aria-label="Chercher une recette à ranger"
        autoFocus
      />

      {linkRecipe.isError && <Alert>{errorMessage(linkRecipe.error)}</Alert>}

      {candidates.length === 0 ? (
        <p className={styles.empty}>
          {settled === ''
            ? 'Toutes vos recettes sont déjà rangées ici.'
            : 'Aucune recette ne correspond.'}
        </p>
      ) : (
        <ul className={styles.list}>
          {candidates.map((recipe) => (
            <li className={styles.row} key={recipe.id}>
              <span className={styles.name}>{recipe.title}</span>
              <Button
                size="sm"
                variant="outline"
                loading={linkRecipe.isPending && linkRecipe.variables === recipe.id}
                onClick={() => linkRecipe.mutate(recipe.id)}
              >
                Ranger
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
