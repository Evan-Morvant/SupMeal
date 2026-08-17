import { useState } from 'react';
import { errorMessage } from '../../api/errors';
import type { CreatedInvitation, Role } from '../../api/types';
import { Button } from '../../ui/Button';
import { Field, Input, Select } from '../../ui/Field';
import { Alert, ErrorState } from '../../ui/Feedback';
import { formatDate } from '../../lib/format';
import { useInvitations, useInviteMember, useRevokeInvitation } from './cookbooks.hooks';
import { ROLE_LABEL, ROLES_ASCENDING } from './roles';
import styles from './CookbookMembersTab.module.css';

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  declined: 'Refusée',
};

/** Invitations, réservées au créateur. */
export function InvitePanel({ cookbookId }: { cookbookId: string }): JSX.Element {
  const invitations = useInvitations(cookbookId, true);
  const inviteMember = useInviteMember(cookbookId);
  const revokeInvitation = useRevokeInvitation(cookbookId);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('READER');
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyLink(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Presse-papiers refusé : le lien reste affiché, à sélectionner à la main.
      setCopied(false);
    }
  }

  return (
    <section className={styles.block}>
      <div className={styles.blockHead}>
        <h2 className={styles.blockTitle}>Invitations</h2>
      </div>
      <p className={styles.note}>
        L'invitation ne vaut que pour l'adresse indiquée : son titulaire devra être connecté
        avec ce compte pour l'accepter.
      </p>

      <div className={styles.inviteForm}>
        <div className={styles.inviteEmail}>
          <Field label="Adresse e-mail">
            {(field) => (
              <Input
                {...field}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="camille@exemple.fr"
              />
            )}
          </Field>
        </div>
        <Field label="Rôle">
          {(field) => (
            <Select
              {...field}
              className={styles.roleSelect}
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {ROLES_ASCENDING.map((option) => (
                <option key={option} value={option}>
                  {ROLE_LABEL[option]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button
          disabled={email.trim() === ''}
          loading={inviteMember.isPending}
          onClick={() =>
            inviteMember.mutate(
              { email: email.trim(), role },
              {
                onSuccess: (invitation) => {
                  setCreated(invitation);
                  setCopied(false);
                  setEmail('');
                },
              },
            )
          }
        >
          Inviter
        </Button>
      </div>

      {inviteMember.isError && <Alert>{errorMessage(inviteMember.error)}</Alert>}

      {created !== null && (
        <Alert tone="success">
          <span className={styles.token}>
            <span>
              Invitation créée pour {created.invitedEmail}. Ce lien n'apparaîtra plus : copiez-le
              maintenant.
            </span>
            <code className={styles.tokenLink}>{created.acceptUrl}</code>
            <span>
              <Button size="sm" variant="outline" onClick={() => copyLink(created.acceptUrl)}>
                {copied ? 'Lien copié' : 'Copier le lien'}
              </Button>
            </span>
          </span>
        </Alert>
      )}

      {invitations.isError && <ErrorState error={invitations.error} title="Invitations indisponibles" />}

      {invitations.data !== undefined && invitations.data.length === 0 && (
        <p className={styles.note}>Aucune invitation en cours.</p>
      )}

      <div className={styles.rows}>
        {(invitations.data ?? []).map((invitation) => (
          <div className={styles.row} key={invitation.id}>
            <span className={styles.identity}>
              <span className={styles.name}>{invitation.invitedEmail}</span>
              <span className={styles.email}>
                {ROLE_LABEL[invitation.role]} · envoyée le {formatDate(invitation.createdAt)}
              </span>
            </span>
            <span className={styles.spacer} />
            <span className={styles.status}>{STATUS_LABEL[invitation.status]}</span>
            {invitation.status === 'pending' && (
              <Button
                variant="ghost"
                size="sm"
                loading={revokeInvitation.isPending && revokeInvitation.variables === invitation.id}
                onClick={() => revokeInvitation.mutate(invitation.id)}
              >
                Révoquer
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
