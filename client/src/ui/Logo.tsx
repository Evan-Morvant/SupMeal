import styles from './Logo.module.css';

/*
 * Marque redessinée d'après `docs/chartes/logo Supmeal.jpg`, dont le cadre, le
 * fond opaque et le mot incrusté interdisent l'emploi. Deux écarts assumés :
 * l'épi, illisible sous 72 px, a disparu, et le corail est passé des feuilles
 * aux couverts.
 */

interface LogoProps {
  /** `mark` : l'assiette seule. `lockup` : l'assiette et le mot. */
  variant?: 'mark' | 'lockup';
  /** Hauteur de la marque, en pixels. */
  size?: number;
  /** Fait tourner la couronne : sert d'indicateur de chargement. */
  spinning?: boolean;
  /** Reagit au survol du logo lui-meme, hors d'un lien englobant. */
  hoverable?: boolean;
  /** Le nom est deja porte a cote : l'image ne le repete pas. */
  decorative?: boolean;
  /** Tout en couleur courante, pour une pose sur une surface deja coloree. */
  mono?: boolean;
  className?: string;
}

/** Abscisses des dents de la fourchette. */
const TINES = [-3.6, -1.2, 1.2, 3.6];

/*
 * Couronne graduée : seul élément dont la rotation se voie, un cercle plein qui
 * tourne ne montrant rien. Le pas se calcule sur la circonférence, sans quoi le
 * raccord passerait devant les yeux à chaque tour.
 */
const TICK_RADIUS = 23;
const TICK_COUNT = 16;
const TICK_STEP = (2 * Math.PI * TICK_RADIUS) / TICK_COUNT;
const TICK_DASH = `${(TICK_STEP * 0.34).toFixed(3)} ${(TICK_STEP * 0.66).toFixed(3)}`;

function Mark({
  size = 40,
  spinning = false,
  hoverable = false,
  decorative = false,
  mono = false,
  className,
}: LogoProps) {
  const classes = [
    styles.mark,
    spinning ? styles.spinning : '',
    hoverable ? styles.hoverable : '',
    mono ? styles.mono : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={decorative ? 'presentation' : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : 'SUPMEAL'}
    >
      <circle className={styles.plate} cx="32" cy="32" r="29" strokeWidth="2.6" />
      <g className={`${styles.plate} ${styles.crown}`}>
        <circle
          cx="32"
          cy="32"
          r={TICK_RADIUS}
          strokeWidth="2"
          strokeDasharray={TICK_DASH}
        />
      </g>
      <circle className={styles.plate} cx="32" cy="32" r="16" strokeWidth="1" />

      {/* Couteau : dos droit a droite, tranchant courbe a gauche. */}
      <g className={styles.cutlery} transform="translate(32 33) rotate(-28)">
        <line x1="0" y1="19" x2="0" y2="4" strokeWidth="3.6" />
        <path d="M-2.6 4C-3.5-1.2-3.4-9.2-1.6-14.6-1-16.5.5-17.6 1.5-16.7 2.5-15.8 2.8-11 2.8-6V2.6C2.8 3.5 2.1 4 1.2 4Z" />
      </g>

      {/* Fourchette : dents vers le haut a droite. */}
      <g className={styles.cutlery} transform="translate(32 33) rotate(28)">
        <line x1="0" y1="19" x2="0" y2="-1" strokeWidth="3.6" />
        <path d="M-4.2-7.5V-3.6C-4.2-1-2.3.6 0 .6S4.2-1 4.2-3.6V-7.5Z" />
        {TINES.map((x) => (
          <line key={x} x1={x} y1="-7" x2={x} y2="-16.8" strokeWidth="1.5" fill="none" />
        ))}
      </g>
    </svg>
  );
}

export function Logo({ variant = 'mark', size = 40, ...rest }: LogoProps): JSX.Element {
  if (variant === 'mark') {
    return <Mark size={size} {...rest} />;
  }
  return (
    <span className={styles.lockup}>
      <Mark size={size} {...rest} decorative />
      <span className={styles.word} style={{ fontSize: size * 0.54 }}>
        SUPMEAL
      </span>
    </span>
  );
}
