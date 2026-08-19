import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { signAccessToken } from '../src/common/tokens';
import { OAuthAccount, User } from '../src/models';

const app = createApp();
const authBase = '/api/v1/auth';
const base = '/api/v1/users';
const creds = { email: 'bob@test.fr', password: 'Motdepasse123!', displayName: 'Bob' };

/** Inscrit un utilisateur et renvoie ses tokens. */
async function registerUser(): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await request(app).post(authBase + '/register').send(creds);
  return res.body;
}

const bearer = (token: string) => 'Bearer ' + token;

/** Token d'accès pour un utilisateur créé directement en base (comptes OAuth). */
const tokenFor = (user: User) => signAccessToken({ id: user.id, email: user.email });

describe('Profil', () => {
  it('GET /users/me -> 200 sans le hash du mot de passe', async () => {
    const { accessToken } = await registerUser();
    const res = await request(app).get(base + '/me').set('Authorization', bearer(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(creds.email);
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('GET /users/me sans token -> 401', async () => {
    const res = await request(app).get(base + '/me');
    expect(res.status).toBe(401);
  });

  it('PATCH /users/me ne touche pas aux champs absents', async () => {
    const { accessToken } = await registerUser();
    await request(app)
      .patch(base + '/me')
      .set('Authorization', bearer(accessToken))
      .send({ avatarUrl: 'https://example.com/a.png' });

    const res = await request(app)
      .patch(base + '/me')
      .set('Authorization', bearer(accessToken))
      .send({ displayName: 'Bobby' });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Bobby');
    expect(res.body.avatarUrl).toBe('https://example.com/a.png');
  });

  it('PATCH /users/me avec un corps vide -> 400', async () => {
    const { accessToken } = await registerUser();
    const res = await request(app)
      .patch(base + '/me')
      .set('Authorization', bearer(accessToken))
      .send({});
    expect(res.status).toBe(400);
  });

  it("PATCH /users/me avec une URL d'avatar invalide -> 400", async () => {
    const { accessToken } = await registerUser();
    const res = await request(app)
      .patch(base + '/me')
      .set('Authorization', bearer(accessToken))
      .send({ avatarUrl: 'pas-une-url' });
    expect(res.status).toBe(400);
  });
});

describe('Changement de mot de passe', () => {
  it('mot de passe actuel correct -> 204, ancien refusé et nouveau accepté', async () => {
    const { accessToken } = await registerUser();
    const res = await request(app)
      .put(base + '/me/password')
      .set('Authorization', bearer(accessToken))
      .send({ currentPassword: creds.password, newPassword: 'Nouveaumotdepasse1!' });
    expect(res.status).toBe(204);

    const ancien = await request(app)
      .post(authBase + '/login')
      .send({ email: creds.email, password: creds.password });
    expect(ancien.status).toBe(401);

    const nouveau = await request(app)
      .post(authBase + '/login')
      .send({ email: creds.email, password: 'Nouveaumotdepasse1!' });
    expect(nouveau.status).toBe(200);
  });

  it('mot de passe actuel faux -> 401', async () => {
    const { accessToken } = await registerUser();
    const res = await request(app)
      .put(base + '/me/password')
      .set('Authorization', bearer(accessToken))
      .send({ currentPassword: 'faux', newPassword: 'Nouveaumotdepasse1!' });
    expect(res.status).toBe(401);
  });

  it('mot de passe actuel omis alors qu il en existe un -> 400', async () => {
    const { accessToken } = await registerUser();
    const res = await request(app)
      .put(base + '/me/password')
      .set('Authorization', bearer(accessToken))
      .send({ newPassword: 'Nouveaumotdepasse1!' });
    expect(res.status).toBe(400);
  });

  // La même politique qu'à l'inscription : le changement ne doit pas l'affaiblir.
  it.each([
    ['trop court', 'Court1!'],
    ['sans majuscule', 'motdepasse123!'],
    ['sans minuscule', 'MOTDEPASSE123!'],
    ['sans chiffre', 'Motdepasseabc!'],
    ['sans caractère spécial', 'Motdepasse1234'],
  ])('nouveau mot de passe %s -> 400', async (_cas, newPassword) => {
    const { accessToken } = await registerUser();
    const res = await request(app)
      .put(base + '/me/password')
      .set('Authorization', bearer(accessToken))
      .send({ currentPassword: creds.password, newPassword });
    expect(res.status).toBe(400);
  });

  it('révoque les sessions ouvertes', async () => {
    const { accessToken, refreshToken } = await registerUser();
    await request(app)
      .put(base + '/me/password')
      .set('Authorization', bearer(accessToken))
      .send({ currentPassword: creds.password, newPassword: 'Nouveaumotdepasse1!' });

    const res = await request(app).post(authBase + '/refresh').send({ refreshToken });
    expect(res.status).toBe(401);
  });

  it('compte OAuth sans mot de passe : en définit un sans en fournir un actuel', async () => {
    const user = await User.create({
      email: 'oauth-only@test.fr',
      passwordHash: null,
      displayName: 'OAuth',
      avatarUrl: null,
    });
    const login = await request(app)
      .post(authBase + '/login')
      .send({ email: user.email, password: 'peuimporte' });
    expect(login.status).toBe(401);

    const accessToken = tokenFor(user);
    const res = await request(app)
      .put(base + '/me/password')
      .set('Authorization', bearer(accessToken))
      .send({ newPassword: 'Premiermotdepasse1!' });
    expect(res.status).toBe(204);

    const apres = await request(app)
      .post(authBase + '/login')
      .send({ email: user.email, password: 'Premiermotdepasse1!' });
    expect(apres.status).toBe(200);
  });
});

describe('Préférences culinaires', () => {
  it('GET renvoie des préférences vides par défaut', async () => {
    const { accessToken } = await registerUser();
    const res = await request(app)
      .get(base + '/me/preferences')
      .set('Authorization', bearer(accessToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      diets: [],
      allergies: [],
      preferredCuisines: [],
      defaultServings: 2,
    });
  });

  it('PUT remplace intégralement : un champ omis reprend sa valeur par défaut', async () => {
    const { accessToken } = await registerUser();
    await request(app)
      .put(base + '/me/preferences')
      .set('Authorization', bearer(accessToken))
      .send({
        diets: ['végétarien'],
        allergies: ['arachide'],
        preferredCuisines: ['italienne'],
        defaultServings: 4,
      });

    const res = await request(app)
      .put(base + '/me/preferences')
      .set('Authorization', bearer(accessToken))
      .send({ diets: ['vegan'] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      diets: ['vegan'],
      allergies: [],
      preferredCuisines: [],
      defaultServings: 2,
    });
  });

  it('nombre de portions hors bornes -> 400', async () => {
    const { accessToken } = await registerUser();
    const res = await request(app)
      .put(base + '/me/preferences')
      .set('Authorization', bearer(accessToken))
      .send({ defaultServings: 0 });
    expect(res.status).toBe(400);
  });
});

describe('Comptes OAuth2 liés', () => {
  it('GET liste les comptes liés sans exposer l identifiant provider', async () => {
    const { accessToken } = await registerUser();
    const user = await User.findOne({ where: { email: creds.email } });
    await OAuthAccount.create({ userId: user!.id, provider: 'github', providerUserId: 'gh-42' });

    const res = await request(app)
      .get(base + '/me/oauth')
      .set('Authorization', bearer(accessToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].provider).toBe('github');
    expect(res.body[0].providerUserId).toBeUndefined();
  });

  it('DELETE délie un compte quand un mot de passe existe -> 204', async () => {
    const { accessToken } = await registerUser();
    const user = await User.findOne({ where: { email: creds.email } });
    await OAuthAccount.create({ userId: user!.id, provider: 'github', providerUserId: 'gh-43' });

    const res = await request(app)
      .delete(base + '/me/oauth/github')
      .set('Authorization', bearer(accessToken));
    expect(res.status).toBe(204);
    expect(await OAuthAccount.count({ where: { userId: user!.id } })).toBe(0);
  });

  it('DELETE sur un provider non lié -> 404', async () => {
    const { accessToken } = await registerUser();
    const res = await request(app)
      .delete(base + '/me/oauth/github')
      .set('Authorization', bearer(accessToken));
    expect(res.status).toBe(404);
  });

  it('DELETE sur un provider inconnu -> 404', async () => {
    const { accessToken } = await registerUser();
    const res = await request(app)
      .delete(base + '/me/oauth/facebook')
      .set('Authorization', bearer(accessToken));
    expect(res.status).toBe(404);
  });

  it('DELETE du dernier moyen de connexion -> 409', async () => {
    const user = await User.create({
      email: 'seul@test.fr',
      passwordHash: null,
      displayName: 'Seul',
      avatarUrl: null,
    });
    await OAuthAccount.create({ userId: user.id, provider: 'github', providerUserId: 'gh-44' });
    const accessToken = tokenFor(user);

    const res = await request(app)
      .delete(base + '/me/oauth/github')
      .set('Authorization', bearer(accessToken));
    expect(res.status).toBe(409);
    expect(await OAuthAccount.count({ where: { userId: user.id } })).toBe(1);
  });

  it("POST renvoie l'URL d'autorisation portant un state", async () => {
    const { accessToken } = await registerUser();
    const res = await request(app)
      .post(base + '/me/oauth/github')
      .set('Authorization', bearer(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.authorizationUrl).toContain('/api/v1/auth/oauth/github?state=');
  });
});
