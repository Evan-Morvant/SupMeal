import { CookbookMembership, User } from '../../models';
import { AppError } from '../../common/app-error';
import { ROLE_LEVEL, type Role } from '../../middlewares/require-role';

/**
 * Exige un rôle sur un cookbook désigné ailleurs que dans l'URL : corps de
 * requête, chaîne de requête, ou événement WebSocket.
 * Comme lui, un non-membre reçoit « introuvable » plutôt qu'« interdit » :
 * l'existence du cookbook ne lui est pas confirmée.
 */
export async function assertCookbookRole(
  userId: string,
  cookbookId: string,
  min: Role,
): Promise<void> {
  const membership = await CookbookMembership.findOne({ where: { cookbookId, userId } });

  if (!membership) {
    throw new AppError(404, 'COOKBOOK_NOT_FOUND', 'Cookbook introuvable');
  }
  if (ROLE_LEVEL[membership.role] < ROLE_LEVEL[min]) {
    throw new AppError(403, 'FORBIDDEN', 'Rôle insuffisant');
  }
}

/** Appartenance accompagnée du profil du membre, pour l'affichage. */
function withUser(cookbookId: string, userId: string): Promise<CookbookMembership | null> {
  return CookbookMembership.findOne({
    where: { cookbookId, userId },
    include: [{ model: User, as: 'user' }],
  });
}

/** Membres du cookbook, du plus ancien au plus récent. */
export function listMembers(cookbookId: string): Promise<CookbookMembership[]> {
  return CookbookMembership.findAll({
    where: { cookbookId },
    include: [{ model: User, as: 'user' }],
    order: [['joinedAt', 'ASC']],
  });
}

async function findMembershipOrFail(
  cookbookId: string,
  userId: string,
): Promise<CookbookMembership> {
  const membership = await CookbookMembership.findOne({ where: { cookbookId, userId } });
  if (!membership) {
    throw new AppError(404, 'MEMBER_NOT_FOUND', 'Ce membre ne fait pas partie du cookbook');
  }
  return membership;
}

/** Interdit de priver le cookbook de son dernier créateur. */
async function assertNotLastOwner(membership: CookbookMembership): Promise<void> {
  if (membership.role !== 'OWNER') {
    return;
  }
  const owners = await CookbookMembership.count({
    where: { cookbookId: membership.cookbookId, role: 'OWNER' },
  });
  if (owners <= 1) {
    throw new AppError(
      409,
      'LAST_OWNER',
      'Dernier créateur du cookbook : promouvez un autre membre avant de partir',
    );
  }
}

/** Change le rôle d'un membre. Réattribuer le même rôle ne fait rien. */
export async function updateMemberRole(
  cookbookId: string,
  userId: string,
  role: Role,
): Promise<CookbookMembership> {
  const membership = await findMembershipOrFail(cookbookId, userId);

  if (membership.role !== role) {
    await assertNotLastOwner(membership);
    membership.role = role;
    await membership.save();
  }
  return (await withUser(cookbookId, userId))!;
}

/**
 * Retire un membre.
 * Les recettes que le partant avait liées restent dans le cookbook : elles ont
 * été partagées avec le groupe, et lui appartiennent toujours.
 */
export async function removeMember(cookbookId: string, userId: string): Promise<void> {
  const membership = await findMembershipOrFail(cookbookId, userId);
  await assertNotLastOwner(membership);
  await membership.destroy();
}
