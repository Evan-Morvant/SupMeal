import { Op } from 'sequelize';
import { OAuthAccount, RefreshToken, User } from '../../models';
import type { OAuthProvider } from '../../models/oauth-account.model';
import { AppError } from '../../common/app-error';
import { hashPassword, verifyPassword } from '../../common/password';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../common/tokens';
import { getUserOrFail } from '../users/users.service';
import type { LoginInput, RegisterInput } from './auth.schemas';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Émet un couple access + refresh et persiste l'empreinte du refresh. */
export async function issueTokens(user: User): Promise<AuthTokens> {
  const accessToken = signAccessToken(user);
  const refresh = signRefreshToken(user);
  await RefreshToken.create({
    userId: user.id,
    tokenHash: refresh.hash,
    expiresAt: refresh.expiresAt,
  });
  return { accessToken, refreshToken: refresh.token };
}

/** Inscription par compte local. */
export async function register(input: RegisterInput): Promise<AuthTokens> {
  const existing = await User.findOne({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', 'Un compte existe déjà avec cet email');
  }
  const user = await User.create({
    email: input.email,
    passwordHash: await hashPassword(input.password),
    displayName: input.displayName,
    avatarUrl: null,
  });
  return issueTokens(user);
}

/** Connexion locale. Message générique pour ne pas révéler l'existence du compte. */
export async function login(input: LoginInput): Promise<AuthTokens> {
  const user = await User.findOne({ where: { email: input.email } });
  if (!user || !user.passwordHash) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email ou mot de passe incorrect');
  }
  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email ou mot de passe incorrect');
  }
  return issueTokens(user);
}

/** Renouvelle l'access token et fait tourner le refresh (rotation). */
export async function refresh(rawToken: string): Promise<AuthTokens> {
  let payload: { id: string };
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token invalide ou expiré');
  }

  const stored = await RefreshToken.findOne({
    where: { tokenHash: hashToken(rawToken), revokedAt: { [Op.is]: null } },
  });
  if (!stored) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token révoqué ou inconnu');
  }

  stored.revokedAt = new Date();
  await stored.save();

  const user = await User.findByPk(payload.id);
  if (!user) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Utilisateur introuvable');
  }
  return issueTokens(user);
}

/** Révoque un refresh token (déconnexion). Idempotent. */
export async function logout(rawToken: string): Promise<void> {
  const stored = await RefreshToken.findOne({
    where: { tokenHash: hashToken(rawToken), revokedAt: { [Op.is]: null } },
  });
  if (stored) {
    stored.revokedAt = new Date();
    await stored.save();
  }
}

export interface OAuthProfileData {
  provider: OAuthProvider;
  providerUserId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

/**
 * Résout l'utilisateur d'une connexion OAuth2 :
 * 1. compte OAuth déjà lié -> on le renvoie ;
 * 2. sinon, un compte existe avec le même email (vérifié par le provider) -> on lie ;
 * 3. sinon, on crée un compte sans mot de passe.
 * L'email de secours garantit la contrainte NOT NULL si le provider n'en fournit pas.
 */
export async function findOrCreateOAuthUser(data: OAuthProfileData): Promise<User> {
  const linked = await OAuthAccount.findOne({
    where: { provider: data.provider, providerUserId: data.providerUserId },
  });
  if (linked) {
    const user = await User.findByPk(linked.userId);
    if (user) {
      return user;
    }
  }

  let user = data.email ? await User.findOne({ where: { email: data.email } }) : null;
  if (!user) {
    user = await User.create({
      email: data.email ?? data.provider + '_' + data.providerUserId + '@oauth.local',
      passwordHash: null,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
    });
  }

  await OAuthAccount.findOrCreate({
    where: { provider: data.provider, providerUserId: data.providerUserId },
    defaults: {
      userId: user.id,
      provider: data.provider,
      providerUserId: data.providerUserId,
    },
  });

  return user;
}

/**
 * Rattache un compte provider à un utilisateur déjà connecté (flux de liaison
 * lancé depuis les paramètres du profil). Ne crée jamais d'utilisateur.
 */
export async function linkOAuthAccount(userId: string, data: OAuthProfileData): Promise<User> {
  const user = await getUserOrFail(userId);

  const existing = await OAuthAccount.findOne({
    where: { provider: data.provider, providerUserId: data.providerUserId },
  });
  if (existing) {
    if (existing.userId !== userId) {
      throw new AppError(
        409,
        'OAUTH_ACCOUNT_TAKEN',
        'Ce compte ' + data.provider + ' est déjà lié à un autre utilisateur',
      );
    }
    return user;
  }

  await OAuthAccount.create({
    userId,
    provider: data.provider,
    providerUserId: data.providerUserId,
  });
  return user;
}
