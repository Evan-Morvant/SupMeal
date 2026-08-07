import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { findOrCreateOAuthUser, linkOAuthAccount } from '../src/modules/auth/auth.service';
import { signOAuthState } from '../src/common/tokens';
import { OAuthAccount, User } from '../src/models';

const app = createApp();
const base = '/api/v1/auth';

describe('Routes OAuth', () => {
  it('provider inconnu -> 404', async () => {
    const res = await request(app).get(base + '/oauth/facebook');
    expect(res.status).toBe(404);
  });

  it('démarrage GitHub -> 302 vers github avec un state', async () => {
    const res = await request(app).get(base + '/oauth/github');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('github.com/login/oauth/authorize');
    expect(res.headers.location).toContain('state=');
  });

  it('callback avec state invalide -> redirection erreur vers le front', async () => {
    const res = await request(app).get(base + '/oauth/github/callback?state=bidon&code=x');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/oauth/callback#error=state_invalide');
  });

  it('démarrage avec un state de liaison signé -> 302 en conservant ce state', async () => {
    const state = signOAuthState('github', 'e5b3c7de-0000-4000-8000-000000000000');
    const res = await request(app).get(base + '/oauth/github?state=' + state);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('state=' + state);
  });

  it('démarrage avec un state forgé -> 400', async () => {
    const res = await request(app).get(base + '/oauth/github?state=bidon');
    expect(res.status).toBe(400);
  });

  it("démarrage avec le state d'un autre provider -> 400", async () => {
    const res = await request(app).get(base + '/oauth/github?state=' + signOAuthState('google'));
    expect(res.status).toBe(400);
  });
});

describe('findOrCreateOAuthUser', () => {
  it('crée un nouveau compte si l email est inconnu', async () => {
    const user = await findOrCreateOAuthUser({
      provider: 'github',
      providerUserId: 'gh-1',
      email: 'new@test.fr',
      displayName: 'New',
      avatarUrl: null,
    });
    expect(user.email).toBe('new@test.fr');
    expect(user.passwordHash).toBeNull();

    const link = await OAuthAccount.findOne({
      where: { provider: 'github', providerUserId: 'gh-1' },
    });
    expect(link).not.toBeNull();
  });

  it('lie au compte existant ayant le même email', async () => {
    const existing = await User.create({
      email: 'link@test.fr',
      passwordHash: 'hash',
      displayName: 'Link',
      avatarUrl: null,
    });
    const user = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: 'go-1',
      email: 'link@test.fr',
      displayName: 'Link',
      avatarUrl: null,
    });
    expect(user.id).toBe(existing.id);
  });

  it('renvoie le compte déjà lié, même si l email diffère', async () => {
    const first = await findOrCreateOAuthUser({
      provider: 'github',
      providerUserId: 'gh-2',
      email: 'again@test.fr',
      displayName: 'A',
      avatarUrl: null,
    });
    const second = await findOrCreateOAuthUser({
      provider: 'github',
      providerUserId: 'gh-2',
      email: 'autre@test.fr',
      displayName: 'A2',
      avatarUrl: null,
    });
    expect(second.id).toBe(first.id);
  });
});

describe('linkOAuthAccount', () => {
  /** Compte local existant, sur lequel viendra se greffer le provider. */
  function createLocalUser(email: string) {
    return User.create({
      email,
      passwordHash: 'hash',
      displayName: 'Local',
      avatarUrl: null,
    });
  }

  const profile = (providerUserId: string) => ({
    provider: 'google' as const,
    providerUserId,
    email: 'peu-importe@test.fr',
    displayName: 'Peu importe',
    avatarUrl: null,
  });

  it('rattache le provider au compte courant sans en créer un autre', async () => {
    const user = await createLocalUser('lien@test.fr');
    const linked = await linkOAuthAccount(user.id, profile('go-10'));

    expect(linked.id).toBe(user.id);
    expect(await User.count()).toBe(1);
    expect(await OAuthAccount.count({ where: { userId: user.id } })).toBe(1);
  });

  it('est idempotent si le compte est déjà lié au même utilisateur', async () => {
    const user = await createLocalUser('idem@test.fr');
    await linkOAuthAccount(user.id, profile('go-11'));
    await linkOAuthAccount(user.id, profile('go-11'));

    expect(await OAuthAccount.count({ where: { userId: user.id } })).toBe(1);
  });

  it('refuse un compte provider déjà lié à un autre utilisateur -> 409', async () => {
    const premier = await createLocalUser('premier@test.fr');
    const second = await createLocalUser('second@test.fr');
    await linkOAuthAccount(premier.id, profile('go-12'));

    await expect(linkOAuthAccount(second.id, profile('go-12'))).rejects.toMatchObject({
      statusCode: 409,
      code: 'OAUTH_ACCOUNT_TAKEN',
    });
    expect(await OAuthAccount.count({ where: { userId: second.id } })).toBe(0);
  });

  it('ne conserve pas l email du provider sur le compte lié', async () => {
    const user = await createLocalUser('inchange@test.fr');
    const linked = await linkOAuthAccount(user.id, profile('go-13'));
    expect(linked.email).toBe('inchange@test.fr');
  });
});
