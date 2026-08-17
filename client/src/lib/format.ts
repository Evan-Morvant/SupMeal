/** Date lisible : « 17 août 2026 ». */
const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}
