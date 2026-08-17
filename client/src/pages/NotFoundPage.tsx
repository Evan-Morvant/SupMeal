import { Link } from 'react-router-dom';
import { buttonClass } from '../ui/Button';
import { EmptyState } from '../ui/Feedback';

export function NotFoundPage(): JSX.Element {
  return (
    <EmptyState
      title="Cette page n'existe pas"
      action={
        <Link to="/" className={buttonClass()}>
          Retour à l'accueil
        </Link>
      }
    >
      <p>Le lien est peut-être périmé, ou l'adresse a été saisie de travers.</p>
    </EmptyState>
  );
}
