import { ReactNode } from 'react';
import { errorMessage } from '../api/errors';
import { Logo } from './Logo';
import styles from './Feedback.module.css';

/** Attente d'un écran entier : la marque sert d'indicateur, pas un spinner. */
export function PageLoader({ label = 'Chargement…' }: { label?: string }): JSX.Element {
  return (
    <div className={styles.pageLoader} role="status">
      <Logo size={56} spinning decorative />
      <p className={styles.pageLoaderText}>{label}</p>
    </div>
  );
}

interface StateProps {
  title: string;
  children?: ReactNode;
  /** Le geste suivant : un écran vide sans issue est une impasse. */
  action?: ReactNode;
}

export function EmptyState({ title, children, action }: StateProps): JSX.Element {
  return (
    <div className={styles.state}>
      <p className={styles.stateTitle}>{title}</p>
      {children !== undefined && <div className={styles.stateBody}>{children}</div>}
      {action !== undefined && <div className={styles.stateAction}>{action}</div>}
    </div>
  );
}

/** Échec de chargement : le message vient du serveur quand il est exploitable. */
export function ErrorState({
  error,
  title = 'Impossible de charger cette page',
  action,
}: {
  error: unknown;
  title?: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className={styles.state} role="alert">
      <p className={styles.stateTitle}>{title}</p>
      <p className={styles.stateBody}>{errorMessage(error)}</p>
      {action !== undefined && <div className={styles.stateAction}>{action}</div>}
    </div>
  );
}

export type AlertTone = 'error' | 'warning' | 'success' | 'info';

const ALERT_CLASS: Record<AlertTone, string> = {
  error: styles.alertError,
  warning: styles.alertWarning,
  success: styles.alertSuccess,
  info: styles.alertInfo,
};

/** Message posé au-dessus d'un formulaire ou d'une action. */
export function Alert({
  tone = 'error',
  children,
}: {
  tone?: AlertTone;
  children: ReactNode;
}): JSX.Element {
  return (
    <p className={`${styles.alert} ${ALERT_CLASS[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
