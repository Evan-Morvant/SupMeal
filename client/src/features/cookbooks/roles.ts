import type { Role } from '../../api/types';

/*
 * Hiérarchie des rôles, telle que l'applique `requireRole` côté serveur.
 * Elle sert ici à **montrer ou cacher** des commandes : l'autorisation reste
 * celle de l'API, qui refusera de toute façon. Proposer un bouton qui mène
 * systématiquement à un 403 serait la seule façon de se tromper.
 */
const LEVEL: Record<Role, number> = {
  READER: 1,
  COMMENTER: 2,
  EDITOR: 3,
  OWNER: 4,
};

export function atLeast(role: Role | undefined, min: Role): boolean {
  return role !== undefined && LEVEL[role] >= LEVEL[min];
}

export const ROLE_LABEL: Record<Role, string> = {
  READER: 'Lecteur',
  COMMENTER: 'Commentateur',
  EDITOR: 'Éditeur',
  OWNER: 'Créateur',
};

/** Ce que chaque rôle permet, dit à qui doit choisir. */
export const ROLE_HELP: Record<Role, string> = {
  READER: 'Consulte les recettes et le planning.',
  COMMENTER: 'Consulte, commente et participe à la discussion.',
  EDITOR: 'Ajoute et modifie recettes, planning et liste de courses.',
  OWNER: 'Gère les membres, les rôles et le cookbook lui-même.',
};

/** Du plus faible au plus fort : l'ordre dans lequel on les propose. */
export const ROLES_ASCENDING: Role[] = ['READER', 'COMMENTER', 'EDITOR', 'OWNER'];
