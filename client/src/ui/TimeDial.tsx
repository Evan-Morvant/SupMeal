import styles from './TimeDial.module.css';

/*
 * Cadran de temps : préparation et cuisson en deux arcs concentriques, repris
 * de l'assiette du logo. Deux lignes de texte diraient la même chose, mais un
 * arc se compare d'un coup d'œil d'une carte à l'autre.
 */

/** Tour complet du cadran. Au-delà, l'arc est plein et le chiffre tranche. */
const FULL_TURN_MIN = 90;

const VIEW = 48;
const CENTER = VIEW / 2;
const COOK_RADIUS = 20;
const PREP_RADIUS = 13.5;
const STROKE = 3.6;

interface TimeDialProps {
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  /** Diamètre rendu, en pixels. */
  size?: number;
  className?: string;
}

/** Longueur d'arc à tracer pour `minutes`, sur un cercle de rayon `radius`. */
function arcLength(minutes: number | null, radius: number): number {
  const circumference = 2 * Math.PI * radius;
  if (minutes === null || minutes <= 0) {
    return 0;
  }
  return circumference * Math.min(minutes / FULL_TURN_MIN, 1);
}

/** « 25 min », « 1 h 15 » : au-delà de l'heure, on ne compte plus en minutes. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return minutes + ' min';
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? hours + ' h' : hours + ' h ' + String(rest).padStart(2, '0');
}

/** Énoncé pour un lecteur d'écran, et infobulle à la souris. */
function describe(prepTimeMin: number | null, cookTimeMin: number | null): string {
  const parts: string[] = [];
  if (prepTimeMin !== null) {
    parts.push('préparation ' + formatDuration(prepTimeMin));
  }
  if (cookTimeMin !== null) {
    parts.push('cuisson ' + formatDuration(cookTimeMin));
  }
  return parts.length === 0 ? 'Durées non renseignées' : parts.join(', ');
}

export function TimeDial({
  prepTimeMin,
  cookTimeMin,
  size = 52,
  className,
}: TimeDialProps): JSX.Element | null {
  if (prepTimeMin === null && cookTimeMin === null) {
    return null;
  }

  const cookCircumference = 2 * Math.PI * COOK_RADIUS;
  const prepCircumference = 2 * Math.PI * PREP_RADIUS;
  const total = (prepTimeMin ?? 0) + (cookTimeMin ?? 0);
  const description = describe(prepTimeMin, cookTimeMin);

  return (
    <svg
      className={[styles.dial, className ?? ''].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      {/* Départ à midi : un cadran qui partirait de 3 h se lirait de travers. */}
      <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
        <circle
          className={styles.track}
          cx={CENTER}
          cy={CENTER}
          r={COOK_RADIUS}
          strokeWidth={STROKE}
        />
        <circle
          className={`${styles.arc} ${styles.cook}`}
          cx={CENTER}
          cy={CENTER}
          r={COOK_RADIUS}
          strokeWidth={STROKE}
          strokeDasharray={cookCircumference}
          strokeDashoffset={cookCircumference - arcLength(cookTimeMin, COOK_RADIUS)}
        />
        <circle
          className={styles.track}
          cx={CENTER}
          cy={CENTER}
          r={PREP_RADIUS}
          strokeWidth={STROKE}
        />
        <circle
          className={`${styles.arc} ${styles.prep}`}
          cx={CENTER}
          cy={CENTER}
          r={PREP_RADIUS}
          strokeWidth={STROKE}
          strokeDasharray={prepCircumference}
          strokeDashoffset={prepCircumference - arcLength(prepTimeMin, PREP_RADIUS)}
        />
      </g>
      <text className={styles.total} x={CENTER} y={CENTER + 1} fontSize="11">
        {total}
      </text>
      <text className={styles.unit} x={CENTER} y={CENTER + 9} fontSize="6">
        min
      </text>
    </svg>
  );
}

/** Légende du cadran, à poser une fois par écran et non par carte. */
export function TimeDialLegend(): JSX.Element {
  return (
    <p className={styles.legend}>
      <span className={styles.legendItem}>
        <span className={`${styles.swatch} ${styles.swatchPrep}`} aria-hidden="true" />
        Préparation
      </span>
      <span className={styles.legendItem}>
        <span className={`${styles.swatch} ${styles.swatchCook}`} aria-hidden="true" />
        Cuisson
      </span>
    </p>
  );
}
