import { EmptyState } from '../ui/Feedback';

/*
 * Échafaudage temporaire : chaque lot remplace l'une de ces pages par la vraie,
 * et ce fichier disparaît avec la dernière. Un rail dont la moitié des entrées
 * rend un 404 ne se laisse ni parcourir ni montrer.
 */
export function PlaceholderPage({ title }: { title: string }): JSX.Element {
  return (
    <EmptyState title={title}>
      <p>Cet écran arrive dans un prochain lot.</p>
    </EmptyState>
  );
}
