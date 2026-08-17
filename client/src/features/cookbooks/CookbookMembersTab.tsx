import { useState } from 'react';
import { errorMessage } from '../../api/errors';
import type { Membership, Role } from '../../api/types';
import { useAuth } from '../../auth/auth-context';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/Dialog';
import { Select } from '../../ui/Field';
import { Alert, ErrorState, PageLoader } from '../../ui/Feedback';
import { InvitePanel } from './InvitePanel';
import { RoleBadge } from './RoleBadge';
import { useCurrentCookbook } from './CookbookLayout';
import { useMembers, useRemoveMember, useSetMemberRole } from './cookbooks.hooks';
import { ROLE_HELP, ROLE_LABEL, ROLES_ASCENDING, atLeast } from './roles';
import styles from './CookbookMembersTab.module.css';

export function CookbookMembersTab(): JSX.Element {
  const cookbook = useCurrentCookbook();
  const { user } = useAuth();
  const members = useMembers(cookbook.id);
  const setMemberRole = useSetMemberRole(cookbook.id);
  const removeMember = useRemoveMember(cookbook.id);
  const [removing, setRemoving] = useState<Membership | null>(null);

  const isOwner = atLeast(cookbook.myRole, 'OWNER');
  const failure = setMemberRole.error ?? removeMember.error;

  if (members.isPending) {
    return <PageLoader label="Chargement des membres…" />;
  }
  if (members.isError) {
    return <ErrorState error={members.error} title="Membres indisponibles" />;
  }

  return (
    <>
      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle}>Membres</h2>
        </div>
        <p className={styles.note}>Chaque membre a exactement un rôle.</p>
        <dl className={styles.legend}>
          {ROLES_ASCENDING.map((role) => (
            <div className={styles.legendRow} key={role}>
              <dt className={styles.legendRole}>{ROLE_LABEL[role]}</dt>
              <dd className={styles.legendHelp}>{ROLE_HELP[role]}</dd>
            </div>
          ))}
        </dl>

        {/*
         * Le 409 LAST_OWNER tombe ici : rétrograder ou exclure le dernier
         * créateur laisserait le cookbook sans personne pour l'administrer.
         */}
        {failure !== null && <Alert>{errorMessage(failure)}</Alert>}

        <div className={styles.rows}>
          {members.data.map((member) => {
            const isMe = member.user?.id === user?.id;
            return (
              <div className={styles.row} key={member.id}>
                <Avatar
                  displayName={member.user?.displayName ?? ''}
                  avatarUrl={member.user?.avatarUrl}
                  size={36}
                />
                <span className={styles.identity}>
                  <span className={styles.name}>
                    {member.user?.displayName}
                    {isMe && <span className={styles.you}> — vous</span>}
                  </span>
                  <span className={styles.email}>{member.user?.email}</span>
                </span>
                <span className={styles.spacer} />

                {isOwner ? (
                  <Select
                    className={styles.roleSelect}
                    value={member.role}
                    aria-label={'Rôle de ' + (member.user?.displayName ?? '')}
                    onChange={(event) =>
                      setMemberRole.mutate({
                        userId: member.user?.id ?? '',
                        role: event.target.value as Role,
                      })
                    }
                  >
                    {ROLES_ASCENDING.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <RoleBadge role={member.role} />
                )}

                {isOwner && !isMe && (
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(member)}>
                    Retirer
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {isOwner && <InvitePanel cookbookId={cookbook.id} />}

      <ConfirmDialog
        open={removing !== null}
        title="Retirer ce membre ?"
        confirmLabel="Retirer"
        busy={removeMember.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() =>
          removing !== null &&
          removeMember.mutate(removing.user?.id ?? '', { onSettled: () => setRemoving(null) })
        }
      >
        <p>
          {removing?.user?.displayName} perdra l'accès au cookbook. Les recettes qu'il y avait
          rangées y restent : elles ont été partagées avec le groupe.
        </p>
      </ConfirmDialog>
    </>
  );
}
