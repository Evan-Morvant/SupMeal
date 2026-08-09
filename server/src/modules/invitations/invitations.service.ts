import crypto from 'crypto';
import { col, fn, where as sqlWhere } from 'sequelize';
import { CookbookInvitation, CookbookMembership, User, sequelize } from '../../models';
import { AppError } from '../../common/app-error';
import { hashToken } from '../../common/tokens';
import { env } from '../../config/env';
import { getUserOrFail } from '../users/users.service';
import type { InviteMemberInput } from '../cookbooks/cookbooks.schemas';

/**
 * Invitation créée, accompagnée de son token en clair : c'est la seule
 * occasion de le lire, il n'est stocké que sous forme d'empreinte.
 */
export interface CreatedInvitation {
  invitation: CookbookInvitation;
  token: string;
  acceptUrl: string;
}

/** Les emails sont comparés en minuscules, l'inscription ne les normalisant pas. */
function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function findUserByEmail(email: string): Promise<User | null> {
  return User.findOne({ where: sqlWhere(fn('lower', col('email')), email) });
}

/**
 * Invite une adresse à rejoindre le cookbook.
 *
 * Le token est tiré au sort puis stocké haché (même empreinte HMAC que les
 * refresh tokens) : une fuite de la table ne donnerait alors accès à aucun
 * cookbook. Le lien complet n'existe donc que dans cette réponse, à charge du
 * créateur de le transmettre — le projet n'embarque pas d'envoi d'email.
 */
export async function inviteMember(
  cookbookId: string,
  input: InviteMemberInput,
): Promise<CreatedInvitation> {
  const invitedEmail = normalizeEmail(input.email);

  const user = await findUserByEmail(invitedEmail);
  if (user) {
    const already = await CookbookMembership.count({ where: { cookbookId, userId: user.id } });
    if (already > 0) {
      throw new AppError(409, 'ALREADY_MEMBER', 'Cette personne est déjà membre du cookbook');
    }
  }

  const pending = await CookbookInvitation.count({
    where: { cookbookId, invitedEmail, status: 'pending' },
  });
  if (pending > 0) {
    throw new AppError(409, 'INVITATION_PENDING', 'Une invitation est déjà en attente');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const invitation = await CookbookInvitation.create({
    cookbookId,
    invitedEmail,
    role: input.role,
    token: hashToken(token),
  });

  return { invitation, token, acceptUrl: env.CLIENT_ORIGIN + '/invitations/' + token };
}

/** Invitations du cookbook, les plus récentes d'abord. */
export function listInvitations(cookbookId: string): Promise<CookbookInvitation[]> {
  return CookbookInvitation.findAll({ where: { cookbookId }, order: [['createdAt', 'DESC']] });
}

/**
 * Révocation. La condition porte aussi sur le cookbook : un créateur ne peut
 * pas révoquer l'invitation d'un cookbook voisin en devinant un identifiant.
 */
export async function revokeInvitation(cookbookId: string, invitationId: string): Promise<void> {
  const removed = await CookbookInvitation.destroy({
    where: { id: invitationId, cookbookId },
  });
  if (removed === 0) {
    throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation introuvable');
  }
}

/**
 * Invitation en attente correspondant au token, à condition qu'elle vise bien
 * l'utilisateur connecté : sans ce contrôle, quiconque récupérerait le lien
 * pourrait entrer dans le cookbook.
 */
async function findPendingInvitationOrFail(
  token: string,
  user: User,
): Promise<CookbookInvitation> {
  const invitation = await CookbookInvitation.findOne({ where: { token: hashToken(token) } });
  if (!invitation) {
    throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation introuvable');
  }
  if (invitation.status !== 'pending') {
    throw new AppError(409, 'INVITATION_ALREADY_ANSWERED', 'Invitation déjà traitée');
  }
  if (invitation.invitedEmail !== normalizeEmail(user.email)) {
    throw new AppError(
      403,
      'INVITATION_EMAIL_MISMATCH',
      'Cette invitation est adressée à une autre adresse email',
    );
  }
  return invitation;
}

/**
 * Acceptation : l'appartenance et le changement de statut vont ensemble, sous
 * peine de laisser une invitation réutilisable ou un membre sans trace.
 */
export async function acceptInvitation(
  userId: string,
  token: string,
): Promise<CookbookMembership> {
  const user = await getUserOrFail(userId);
  const invitation = await findPendingInvitationOrFail(token, user);

  const existing = await CookbookMembership.count({
    where: { cookbookId: invitation.cookbookId, userId },
  });
  if (existing > 0) {
    throw new AppError(409, 'ALREADY_MEMBER', 'Vous êtes déjà membre de ce cookbook');
  }

  await sequelize.transaction(async (transaction) => {
    await CookbookMembership.create(
      { cookbookId: invitation.cookbookId, userId, role: invitation.role },
      { transaction },
    );
    invitation.status = 'accepted';
    await invitation.save({ transaction });
  });

  return (await CookbookMembership.findOne({
    where: { cookbookId: invitation.cookbookId, userId },
    include: [{ model: User, as: 'user' }],
  }))!;
}

export async function declineInvitation(userId: string, token: string): Promise<void> {
  const user = await getUserOrFail(userId);
  const invitation = await findPendingInvitationOrFail(token, user);

  invitation.status = 'declined';
  await invitation.save();
}
