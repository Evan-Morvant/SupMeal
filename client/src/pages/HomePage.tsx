import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { DiscoverFilters } from '../api/types';
import { useAuth } from '../auth/auth-context';
import { useDiscoverRecipes } from '../features/discover/discover.hooks';
import { RecipeCard } from '../features/recipes/RecipeCard';
import { useToggleFavorite } from '../features/recipes/recipes.hooks';
import { useSuggestions } from '../features/suggestions/suggestions.hooks';
import { buttonClass } from '../ui/Button';
import { PageLoader } from '../ui/Feedback';
import { TimeDialLegend } from '../ui/TimeDial';
import styles from './HomePage.module.css';

/** Vitrine : les recettes publiques les mieux notées. */
const SHOWCASE: DiscoverFilters = { sort: 'rating', pageSize: 6, page: 1 };

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2>{title}</h2>
        <TimeDialLegend />
      </div>
      <p className={styles.sectionNote}>{note}</p>
      <div className={styles.grid}>{children}</div>
    </section>
  );
}

/** Vitrine publique, montrée au visiteur comme au compte encore vide. */
function Showcase({ title, note }: { title: string; note: string }): JSX.Element | null {
  const showcase = useDiscoverRecipes(SHOWCASE);
  const toggleFavorite = useToggleFavorite();
  const { status } = useAuth();

  if (showcase.data === undefined || showcase.data.items.length === 0) {
    return null;
  }
  return (
    <Section title={title} note={note}>
      {showcase.data.items.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          to={'/discover/' + recipe.id}
          showVisibility={false}
          onToggleFavorite={
            status === 'authenticated'
              ? (favorite) => toggleFavorite.mutate({ id: recipe.id, favorite })
              : undefined
          }
        />
      ))}
    </Section>
  );
}

function Visitor(): JSX.Element {
  return (
    <>
      <section className={styles.hero}>
        <h1 className={styles.title}>
          Vos recettes, <span className={styles.accent}>rassemblées</span>.
        </h1>
        <p className={styles.lede}>
          Gardez vos recettes au même endroit, partagez-les dans un cookbook et planifiez la
          semaine sans y repenser trois fois.
        </p>
        <div className={styles.actions}>
          <Link to="/register" className={buttonClass()}>
            Créer un compte
          </Link>
          <Link to="/discover" className={buttonClass({ variant: 'outline' })}>
            Parcourir les recettes publiques
          </Link>
        </div>
      </section>

      <Showcase
        title="Les mieux notées"
        note="Ce que la communauté a publié de meilleur."
      />
    </>
  );
}

function Suggestions(): JSX.Element {
  const suggestions = useSuggestions(true);
  const toggleFavorite = useToggleFavorite();

  if (suggestions.isPending) {
    return <PageLoader label="Préparation de vos suggestions…" />;
  }

  /*
   * Repli sur la vitrine quand le classement revient vide — compte neuf, sans
   * recette ni cookbook. Choisir laquelle montrer relève de l'affichage, pas
   * de la logique métier.
   */
  if (suggestions.data === undefined || suggestions.data.length === 0) {
    return (
      <Showcase
        title="Pour commencer"
        note="Vos suggestions apparaîtront ici dès que vous aurez quelques recettes. En attendant, voici ce que la communauté a publié de meilleur."
      />
    );
  }

  return (
    <Section
      title="À cuisiner cette semaine"
      note="Choisies dans vos recettes et celles de vos cookbooks, en écartant vos allergies, vos favoris et ce qui est déjà au planning."
    >
      {suggestions.data.map((suggestion) => (
        <div className={styles.suggestion} key={suggestion.recipe.id}>
          <RecipeCard
            recipe={suggestion.recipe}
            to={'/recipes/' + suggestion.recipe.id}
            onToggleFavorite={(favorite) =>
              toggleFavorite.mutate({ id: suggestion.recipe.id, favorite })
            }
          />
          {/* Les motifs font tout l'intérêt d'une suggestion. */}
          {suggestion.reasons.length > 0 && (
            <p className={styles.reasons}>
              {suggestion.reasons.map((reason) => (
                <span className={styles.reason} key={reason}>
                  {reason}
                </span>
              ))}
            </p>
          )}
        </div>
      ))}
    </Section>
  );
}

export function HomePage(): JSX.Element {
  const { status, user } = useAuth();

  if (status !== 'authenticated' || user === null) {
    return <Visitor />;
  }
  return (
    <>
      <header className={styles.greeting}>
        <h1>Bonjour {user.displayName}</h1>
      </header>
      <Suggestions />
    </>
  );
}
