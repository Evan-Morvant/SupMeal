import { ReactNode, useEffect, useId, useRef } from 'react';
import { Button, ButtonVariant } from './Button';
import styles from './ConfirmDialog.module.css';

/**
 * Confirmation d'une action irréversible. `<dialog>` fournit le piège de focus,
 * la fermeture par Échap et le fond inerte.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Annuler',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ButtonVariant;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      // Échap ferme la boîte : l'annulation doit être connue de l'appelant.
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 className={styles.title} id={titleId}>
        {title}
      </h2>
      {children !== undefined && <div className={styles.body}>{children}</div>}
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant={tone} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
