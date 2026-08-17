import {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
  useId,
} from 'react';
import styles from './Field.module.css';

/*
 * `Field` relie libellé, aide, contrôle et message d'erreur : il fabrique les
 * identifiants et pose `aria-describedby` une fois pour toutes, ce câblage
 * recopié à chaque formulaire finissant par en oublier une moitié.
 */

interface FieldProps {
  label: string;
  /** Signale explicitement ce qui peut rester vide. */
  optional?: boolean;
  hint?: string;
  error?: string;
  children: (props: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': boolean | undefined;
  }) => ReactNode;
}

export function Field({ label, optional = false, hint, error, children }: FieldProps): JSX.Element {
  const id = useId();
  const hintId = hint === undefined ? undefined : id + '-hint';
  const errorId = error === undefined ? undefined : id + '-error';
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {optional && <span className={styles.optional}>facultatif</span>}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error === undefined ? undefined : true,
      })}
      {hint !== undefined && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Classes d'un contrôle de formulaire, partagées par les trois balises. */
export function controlClass(options: { invalid?: boolean; numeric?: boolean; className?: string } = {}): string {
  return [
    styles.control,
    options.invalid === true ? styles.invalid : '',
    options.numeric === true ? styles.numeric : '',
    options.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, type = 'text', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={controlClass({ invalid, numeric: type === 'number', className })}
      {...rest}
    />
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={controlClass({ invalid, className: [styles.textarea, className ?? ''].join(' ') })}
      {...rest}
    />
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={controlClass({ invalid, className: [styles.select, className ?? ''].join(' ') })}
      {...rest}
    />
  );
});
