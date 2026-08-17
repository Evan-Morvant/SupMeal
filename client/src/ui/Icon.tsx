/*
 * Jeu d'icônes maison : un tracé par nom, même grille, même graisse. Une
 * bibliothèque externe apporterait mille symboles pour la quinzaine utile, dans
 * un style étranger à la charte.
 */

const PATHS = {
  accueil: 'M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1Z',
  recettes: 'M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6.5A2.5 2.5 0 0 1 4 17.5ZM8 4v16M11 9h6M11 13h4',
  decouvrir: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM16 16l4 4',
  cookbooks: 'M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5Zm16 0c0-.8-.7-1.5-1.5-1.5H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5Z',
  planning: 'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2ZM4 10h16M8 4v4M16 4v4',
  courses: 'M3 5h2.2l2 10.2a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.5L20 8H6M10 21h.01M17 21h.01',
  reglages:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 3a8 8 0 0 0-.2-1.7l2-1.5-2-3.4-2.3 1a8 8 0 0 0-2.9-1.7L14.2 2H9.8l-.4 2.7a8 8 0 0 0-2.9 1.7l-2.3-1-2 3.4 2 1.5a8 8 0 0 0 0 3.4l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 2.9 1.7l.4 2.7h4.4l.4-2.7a8 8 0 0 0 2.9-1.7l2.3 1 2-3.4-2-1.5c.13-.55.2-1.12.2-1.7Z',
  ajouter: 'M12 5v14M5 12h14',
  fermer: 'M6 6l12 12M18 6 6 18',
  filtres: 'M4 6h16M7 12h10M10 18h4',
  favori: 'M12 20.2 4.8 13a4.4 4.4 0 0 1 0-6.3 4.4 4.4 0 0 1 6.3 0l.9.9.9-.9a4.4 4.4 0 0 1 6.3 0 4.4 4.4 0 0 1 0 6.3Z',
  membres: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-6 6-6s6 2.7 6 6M17 4.5a3.5 3.5 0 0 1 0 7M21 20a5.5 5.5 0 0 0-3.5-5.1',
  discussion: 'M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9l-5 4Z',
  envoyer: 'M4 12 20 4l-4 16-4.5-6.5L4 12Zm7.5 1.5L20 4',
  modifier: 'M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17Zm11-13 3 3',
  supprimer: 'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12',
  chevronBas: 'M6 9.5 12 15l6-5.5',
  chevronGauche: 'M14.5 5.5 8.5 12l6 6.5',
  chevronDroite: 'M9.5 5.5 15.5 12l-6 6.5',
  deconnexion: 'M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h11',
  image: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Zm2 9 4.5-5 3 3.5L16 12l4 4M9 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  telecharger: 'M12 4v11m0 0 4-4m-4 4-4-4M4 19h16',
  importer: 'M12 15V4m0 0L8 8m4-4 4 4M4 19h16',
  horloge: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 3.5V12l3 2',
  etoile: 'M12 3.6 14.6 9.1 20.6 9.9 16.2 14.1 17.3 20 12 17.1 6.7 20 7.8 14.1 3.4 9.9 9.4 9.1Z',
  parts: 'M4 18a8 8 0 0 1 16 0ZM12 4v3M3 18h18',
  lien: 'M9 15 15 9M10.5 6.5 12 5a4.2 4.2 0 0 1 6 6l-1.5 1.5M13.5 17.5 12 19a4.2 4.2 0 0 1-6-6l1.5-1.5',
  cadenas: 'M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z',
  monde: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM4 12h16M12 4c2.2 2.2 3.2 5 3.2 8s-1 5.8-3.2 8c-2.2-2.2-3.2-5-3.2-8s1-5.8 3.2-8Z',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  /** Rempli plutôt que tracé : réservé au favori actif. */
  filled?: boolean;
  className?: string;
  /** Nomme l'icône quand elle porte seule le sens (bouton sans libellé). */
  label?: string;
}

export function Icon({ name, size = 22, filled = false, className, label }: IconProps): JSX.Element {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label === undefined ? 'presentation' : 'img'}
      aria-hidden={label === undefined || undefined}
      aria-label={label}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
