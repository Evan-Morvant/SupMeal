import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../../api/errors';
import { useAuth } from '../../auth/auth-context';
import { Button, buttonClass } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Alert } from '../../ui/Feedback';
import { useAcceptInvitation, useDeclineInvitation } from './cookbooks.hooks';
import styles from './InvitationPage.module.css';

/**
 * Acceptation d'une invitation reçue par lien. Le jeton ne dit rien du
 * cookbook visé : l'API ne le révèle qu'une fois l'invitation acceptée, pour
 * qu'un lien intercepté n'apprenne rien à qui n'y a pas droit.
 */
export function InvitationPage(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const [declined, setDeclined] = useState(false);

  if (declined) {
    return (
      <Card className={styles.panel}>
        <h1 className={styles.title}>Invitation refusée</h1>
        <p>Elle ne pourra plus être acceptée. Le créateur du cookbook peut en envoyer une autre.</p>
        <Link to="/cookbooks" className={buttonClass({ variant: 'outline' })}>
          Voir mes cookbooks
        </Link>
      </Card>
    );
  }

  return (
    <Card className={styles.panel}>
      <h1 className={styles.title}>Rejoindre un cookbook</h1>
      <p>
        Vous êtes connecté en tant que <strong>{user?.email}</strong>. L'invitation ne vaut que
        pour l'adresse à laquelle elle a été envoyée.
      </p>

      {accept.isError && <Alert>{errorMessage(accept.error)}</Alert>}
      {decline.isError && <Alert>{errorMessage(decline.error)}</Alert>}

      <div className={styles.actions}>
        <Button
          variant="ghost"
          loading={decline.isPending}
          onClick={() =>
            decline.mutate(token as string, { onSuccess: () => setDeclined(true) })
          }
        >
          Refuser
        </Button>
        <Button
          loading={accept.isPending}
          onClick={() =>
            accept.mutate(token as string, {
              onSuccess: () => navigate('/cookbooks', { replace: true }),
            })
          }
        >
          Accepter l'invitation
        </Button>
      </div>
    </Card>
  );
}
