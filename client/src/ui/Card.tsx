import { HTMLAttributes } from 'react';
import styles from './Card.module.css';

interface CardOptions {
  /** Retire la marge intérieure, quand la carte porte une image à fond perdu. */
  flush?: boolean;
  /** Réagit au survol : réservé aux cartes qui mènent quelque part. */
  interactive?: boolean;
  className?: string;
}

/**
 * Classes de la surface. Exportées parce qu'une carte n'est pas toujours un
 * `div` : une carte cliquable est un article qui contient un lien étiré, et
 * redéfinir la même bordure à côté dédoublerait la feuille de style.
 */
export function cardClass({
  flush = false,
  interactive = false,
  className,
}: CardOptions = {}): string {
  return [
    styles.card,
    flush ? '' : styles.padded,
    interactive ? styles.interactive : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

type CardProps = HTMLAttributes<HTMLDivElement> & CardOptions;

export function Card({ flush, interactive, className, ...rest }: CardProps): JSX.Element {
  return <div className={cardClass({ flush, interactive, className })} {...rest} />;
}
