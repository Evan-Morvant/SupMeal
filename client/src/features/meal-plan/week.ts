import { addDays, format, isSameDay, parseISO, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';

/*
 * Une semaine de planning. Les dates de l'API sont des dates de calendrier
 * (AAAA-MM-JJ), sans heure ni fuseau : un repas est prévu un jour, pas à un
 * instant. On garde donc ce format partout et on ne convertit qu'à l'affichage.
 */

/** Lundi comme premier jour, l'usage français. */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

export type IsoDate = string;

export function toIso(date: Date): IsoDate {
  return format(date, 'yyyy-MM-dd');
}

export function startOfWeekIso(date: Date = new Date()): IsoDate {
  return toIso(startOfWeek(date, WEEK_OPTIONS));
}

/** Les sept jours d'une semaine, à partir de son lundi. */
export function weekDays(mondayIso: IsoDate): Date[] {
  const monday = parseISO(mondayIso);
  return Array.from({ length: 7 }, (_unused, index) => addDays(monday, index));
}

export function shiftWeek(mondayIso: IsoDate, weeks: number): IsoDate {
  return toIso(addDays(parseISO(mondayIso), weeks * 7));
}

/** « lun. 18 » : le jour et son numéro suffisent en tête de colonne. */
export function formatDayLabel(date: Date): string {
  return format(date, 'EEE d', { locale: fr });
}

/** « 18 août 2026 » pour les libellés qui doivent lever toute ambiguïté. */
export function formatDayLong(date: Date): string {
  return format(date, 'd MMMM yyyy', { locale: fr });
}

/** « Semaine du 17 au 23 août 2026 ». */
export function formatWeekRange(mondayIso: IsoDate): string {
  const days = weekDays(mondayIso);
  const first = days[0];
  const last = days[6];
  const sameMonth = format(first, 'MM') === format(last, 'MM');
  return (
    'Semaine du ' +
    format(first, sameMonth ? 'd' : 'd MMMM', { locale: fr }) +
    ' au ' +
    format(last, 'd MMMM yyyy', { locale: fr })
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}
