import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { findOrCreateOAuthUser } from '../src/modules/auth/auth.service';
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
