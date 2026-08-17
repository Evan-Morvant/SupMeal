import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Logo } from './Logo';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

interface StyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  iconOnly?: boolean;
  className?: string;
}

/**
 * Exportées pour qu'un `Link` de react-router porte exactement la même
 * apparence, sans dupliquer la moitié de la feuille de style.
 */
export function buttonClass({
  variant = 'primary',
  size = 'md',
  block = false,
  iconOnly = false,
  className,
}: StyleOptions = {}): string {
  return [
    styles.base,
    styles[variant],
    styles[size],
    block ? styles.block : '',
    iconOnly ? styles.iconOnly : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleOptions {
  /** Attente en cours : le bouton se verrouille et affiche la couronne. */
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant,
  size,
  block,
  iconOnly,
  className,
  loading = false,
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, block, iconOnly, className })}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <Logo
          className={styles.spinner}
          size={size === 'sm' ? 16 : 20}
          spinning
          decorative
          mono
        />
      )}
      {children}
    </button>
  );
}
