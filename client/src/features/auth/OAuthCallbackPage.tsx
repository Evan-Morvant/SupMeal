import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { buttonClass } from '../../ui/Button';
import { ErrorState, PageLoader } from '../../ui/Feedback';

/*
 * Retour du fournisseur OAuth2. La réponse arrive dans le **fragment** de
 * l'URL, qui n'est pas transmis au serveur : les jetons ne finissent donc ni
 * dans les journaux d'accès ni dans un en-tête Referer. Trois formes possibles,
 * telles que les émet `oauth.controller.ts` :
 *   #accessToken=…&refreshToken=…  connexion réussie
 *   #linked=<provider>             compte lié depuis les paramètres
 *   #error=<code>                  échec
 */

const ERRORS: Record<string, string> = {
  UNKNOWN_PROVIDER: "Ce fournisseur n'est pas reconnu.",
  PROVIDER_NOT_CONFIGURED: "Ce fournisseur n'est pas configuré sur ce serveur.",
  EMAIL_ALREADY_LINKED: 'Cette adresse est déjà rattachée à un autre compte.',
  oauth_echec: "La connexion avec ce fournisseur n'a pas abouti.",
};

function describe(code: string): string {
  return ERRORS[code] ?? "La connexion avec ce fournisseur n'a pas abouti.";
}

export function OAuthCallbackPage(): JSX.Element {
  const { adoptSession } = useAuth();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);
  // Le fragment ne doit être consommé qu'une fois, même en mode strict.
  const consumed = useRef(false);

  useEffect(() => {
    if (consumed.current) {
      return;
    }
    consumed.current = true;

    const params = new URLSearchParams(window.location.hash.slice(1));
    // Les jetons quittent la barre d'adresse avant tout le reste.
    window.history.replaceState(null, '', window.location.pathname);

    const error = params.get('error');
    if (error !== null) {
      setFailure(describe(error));
      return;
    }

    const linked = params.get('linked');
    if (linked !== null) {
      navigate('/settings?linked=' + encodeURIComponent(linked), { replace: true });
      return;
    }

    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    if (accessToken === null || refreshToken === null) {
      setFailure("Cette page attend un retour de fournisseur ; elle n'a rien reçu.");
      return;
    }

    adoptSession({ accessToken, refreshToken })
      .then(() => navigate('/recipes', { replace: true }))
      .catch(() => setFailure('Session refusée. Reprenez la connexion depuis le début.'));
  }, [adoptSession, navigate]);

  if (failure !== null) {
    return (
      <ErrorState
        error={new Error(failure)}
        title="Connexion interrompue"
        action={
          <Link to="/login" className={buttonClass()}>
            Revenir à la connexion
          </Link>
        }
      />
    );
  }

  return <PageLoader label="Connexion en cours…" />;
}
