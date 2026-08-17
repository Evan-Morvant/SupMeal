import styles from './Avatar.module.css';

/**
 * Initiales d'un nom affiché. Les particules restent hors du compte, sinon
 * « Jean de la Tour » donnerait JDT au lieu de JT.
 */
function initials(displayName: string): string {
  const words = displayName
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 1);
  if (words.length === 0) {
    return displayName.trim().slice(0, 1).toUpperCase() || '?';
  }
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

interface AvatarProps {
  displayName: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({
  displayName,
  avatarUrl = null,
  size = 36,
  className,
}: AvatarProps): JSX.Element {
  return (
    <span
      className={[styles.avatar, className ?? ''].filter(Boolean).join(' ')}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      // Le nom est déjà lisible à côté : l'avatar ne le répète pas à voix haute.
      aria-hidden="true"
    >
      {avatarUrl === null ? (
        initials(displayName)
      ) : (
        <img className={styles.image} src={avatarUrl} alt="" />
      )}
    </span>
  );
}
