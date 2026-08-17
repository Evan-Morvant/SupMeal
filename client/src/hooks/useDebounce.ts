import { useEffect, useState } from 'react';

/**
 * Retarde la propagation d'une valeur. Sur la recherche plein texte, frapper
 * « poulet » enverrait six requêtes dont cinq seraient déjà périmées à
 * l'arrivée.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
