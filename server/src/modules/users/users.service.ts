import { Op } from 'sequelize';
import { OAuthAccount, RefreshToken, User, UserPreferences } from '../../models';
import type { OAuthProvider } from '../../models/oauth-account.model';
import { AppError } from '../../common/app-error';
import { hashPassword, verifyPassword } from '../../common/password';
import type { ChangePasswordInput, PreferencesInput, UpdateProfileInput } from './users.schemas';

/**
 * Charge l'utilisateur d'un identifiant issu du JWT. Le token peut survivre à
 * la suppression du compte : on retombe alors sur un 401, pas un 404.
 */
export async function getUserOrFail(userId: string): Promise<User> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Utilisateur introuvable');
  }
  return user;
}

/** Modification partielle du profil : seuls les champs présents sont écrits. */
export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<User> {
  const user = await getUserOrFail(userId);
  if (input.displayName !== undefined) {
    user.displayName = input.displayName;
  }
  if (input.avatarUrl !== undefined) {
    user.avatarUrl = input.avatarUrl;
  }
  await user.save();
  return user;
}

/**
 * Remplace le mot de passe. Le mot de passe actuel est exigé lorsqu'il en
 * existe un ; un compte créé par OAuth2 s'en définit ainsi un premier et
 * débloque la connexion locale. Toutes les sessions ouvertes sont révoquées.
 */
export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await getUserOrFail(userId);

  if (user.passwordHash) {
    if (!input.currentPassword) {
      throw new AppError(400, 'CURRENT_PASSWORD_REQUIRED', 'Le mot de passe actuel est requis');
    }
    const valid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Mot de passe actuel incorrect');
    }
  }

  user.passwordHash = await hashPassword(input.newPassword);
  await user.save();

  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: { [Op.is]: null } } },
  );
}

/** Préférences culinaires, créées à la volée à la première consultation. */
export async function getPreferences(userId: string): Promise<UserPreferences> {
  const [preferences] = await UserPreferences.findOrCreate({
    where: { userId },
    defaults: {
      userId,
      diets: [],
      allergies: [],
      preferredCuisines: [],
      defaultServings: 2,
    },
  });
  return preferences;
}

/** PUT : la représentation reçue remplace intégralement les préférences stockées. */
export async function replacePreferences(
  userId: string,
  input: PreferencesInput,
): Promise<UserPreferences> {
  const preferences = await getPreferences(userId);
  preferences.set(input);
  await preferences.save();
  return preferences;
}

/** Comptes OAuth2 liés au profil, du plus ancien au plus récent. */
export function listOAuthAccounts(userId: string): Promise<OAuthAccount[]> {
  return OAuthAccount.findAll({ where: { userId }, order: [['createdAt', 'ASC']] });
}

/**
 * Délie un fournisseur. Refusé si c'est l'unique moyen de connexion restant,
 * sinon l'utilisateur perdrait tout accès à son compte.
 */
export async function unlinkOAuthAccount(userId: string, provider: OAuthProvider): Promise<void> {
  const account = await OAuthAccount.findOne({ where: { userId, provider } });
  if (!account) {
    throw new AppError(404, 'OAUTH_ACCOUNT_NOT_FOUND', 'Aucun compte lié pour ce fournisseur');
  }

  const user = await getUserOrFail(userId);
  const linkedCount = await OAuthAccount.count({ where: { userId } });
  if (!user.passwordHash && linkedCount <= 1) {
    throw new AppError(
      409,
      'LAST_LOGIN_METHOD',
      "Dernier moyen de connexion : définissez d'abord un mot de passe",
    );
  }

  await account.destroy();
}
