/** Date lisible : « 17 août 2026 ». */
const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

/**
 * Première lettre en capitale. Les créneaux de repas arrivent en minuscules de
 * l'API (« petit-déjeuner ») ; `text-transform: capitalize` en mettrait une
 * après le trait d'union, et `::first-letter` reste sans effet sur un
 * conteneur flex.
 */
export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
