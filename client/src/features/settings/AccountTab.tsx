import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../api/errors';
import type { OAuthProvider } from '../../api/types';
import { useAuth } from '../../auth/auth-context';
import { formatDate } from '../../lib/format';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/Dialog';
import { Field, Input } from '../../ui/Field';
import { Alert, ErrorState } from '../../ui/Feedback';
import { startOAuthLink } from './settings.api';
import {
  useChangePassword,
  useOAuthAccounts,
  useUnlinkOAuthAccount,
  useUpdateProfile,
} from './settings.hooks';
import styles from './Settings.module.css';

const PROVIDERS: OAuthProvider[] = ['google', 'github'];

function ProfileSection(): JSX.Element {
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Profil</h2>

      {updateProfile.isError && <Alert>{errorMessage(updateProfile.error)}</Alert>}
      {updateProfile.isSuccess && <Alert tone="success">Profil enregistré.</Alert>}

      <Field label="Nom affiché" hint="Il apparaît sur vos messages et dans vos cookbooks.">
        {(field) => (
          <Input
            {...field}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        )}
      </Field>

      <Field label="Adresse e-mail">
        {(field) => <Input {...field} value={user?.email ?? ''} disabled />}
      </Field>
      <p className={styles.note}>
        L'adresse sert d'identifiant et à recevoir les invitations : elle ne se change pas ici.
      </p>

      <div className={styles.actions}>
        <Button
          disabled={displayName.trim() === '' || displayName === user?.displayName}
          loading={updateProfile.isPending}
          onClick={() => updateProfile.mutate({ displayName: displayName.trim() })}
        >
          Enregistrer
        </Button>
      </div>
    </section>
  );
}

function PasswordSection(): JSX.Element {
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Mot de passe</h2>
      {/*
       * Le serveur révoque tous les refresh tokens : les autres appareils sont
       * déconnectés. Mieux vaut le savoir avant de valider.
       */}
      <p className={styles.note}>
        En changer déconnecte vos autres appareils : toutes les sessions ouvertes sont révoquées.
      </p>

      {changePassword.isError && <Alert>{errorMessage(changePassword.error)}</Alert>}
      {changePassword.isSuccess && (
        <Alert tone="success">Mot de passe changé. Vos autres sessions sont fermées.</Alert>
      )}

      <Field
        label="Mot de passe actuel"
        optional
        hint="À laisser vide si votre compte n'en a jamais eu (connexion par Google ou GitHub)."
      >
        {(field) => (
          <Input
            {...field}
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        )}
      </Field>

      <Field label="Nouveau mot de passe" hint="Huit caractères au minimum.">
        {(field) => (
          <Input
            {...field}
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
        )}
      </Field>

      <div className={styles.actions}>
        <Button
          disabled={next.length < 8}
          loading={changePassword.isPending}
          onClick={() =>
            changePassword.mutate(
              {
                currentPassword: current === '' ? undefined : current,
                newPassword: next,
              },
              {
                onSuccess: () => {
                  setCurrent('');
                  setNext('');
                },
              },
            )
          }
        >
          Changer le mot de passe
        </Button>
      </div>
    </section>
  );
}

function OAuthSection(): JSX.Element {
  const [params] = useSearchParams();
  const accounts = useOAuthAccounts();
  const unlink = useUnlinkOAuthAccount();
  const [linking, setLinking] = useState<OAuthProvider | null>(null);
  const [unlinking, setUnlinking] = useState<OAuthProvider | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const justLinked = params.get('linked');

  async function link(provider: OAuthProvider): Promise<void> {
    setLinking(provider);
    setFailure(null);
    try {
      // Navigation complète : le fournisseur doit afficher son consentement.
      window.location.href = await startOAuthLink(provider);
    } catch (error) {
      setFailure(errorMessage(error));
      setLinking(null);
    }
  }

  if (accounts.isError) {
    return <ErrorState error={accounts.error} title="Comptes liés indisponibles" />;
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Connexion par un autre service</h2>
      <p className={styles.note}>
        Un compte lié permet de se connecter sans mot de passe. La liaison se fait par adresse
        e-mail vérifiée.
      </p>

      {justLinked !== null && (
        <Alert tone="success">Compte {justLinked} lié à votre profil.</Alert>
      )}
      {failure !== null && <Alert>{failure}</Alert>}
      {unlink.isError && <Alert>{errorMessage(unlink.error)}</Alert>}

      <div className={styles.accounts}>
        {PROVIDERS.map((provider) => {
          const linked = (accounts.data ?? []).find((account) => account.provider === provider);
          return (
            <div className={styles.account} key={provider}>
              <span className={styles.provider}>{provider}</span>
              {linked !== undefined && (
                <span className={styles.since}>lié le {formatDate(linked.createdAt)}</span>
              )}
              <span className={styles.spacer} />
              {linked === undefined ? (
                <Button
                  variant="outline"
                  size="sm"
                  loading={linking === provider}
                  onClick={() => void link(provider)}
                >
                  Lier
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setUnlinking(provider)}>
                  Délier
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={unlinking !== null}
        title="Délier ce compte ?"
        confirmLabel="Délier"
        busy={unlink.isPending}
        onCancel={() => setUnlinking(null)}
        onConfirm={() =>
          unlinking !== null &&
          unlink.mutate(unlinking, { onSettled: () => setUnlinking(null) })
        }
      >
        <p>
          Vous ne pourrez plus vous connecter par ce service. Assurez-vous d'avoir un mot de
          passe, sans quoi l'accès au compte serait perdu.
        </p>
      </ConfirmDialog>
    </section>
  );
}

export function AccountTab(): JSX.Element {
  return (
    <>
      <ProfileSection />
      <PasswordSection />
      <OAuthSection />
      {/* Les conditions doivent rester atteignables après l'inscription. */}
      <p className={styles.note}>
        <Link to="/cgu">Conditions générales d'utilisation</Link>
      </p>
    </>
  );
}
