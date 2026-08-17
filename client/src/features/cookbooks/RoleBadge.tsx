import type { Role } from '../../api/types';
import { Chip } from '../../ui/Chip';
import { ROLE_HELP, ROLE_LABEL } from './roles';

/** Rôle d'un membre, avec ce qu'il permet en infobulle. */
export function RoleBadge({ role }: { role: Role }): JSX.Element {
  return (
    <span title={ROLE_HELP[role]}>
      <Chip>{ROLE_LABEL[role]}</Chip>
    </span>
  );
}
