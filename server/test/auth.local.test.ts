import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();
const base = '/api/v1/auth';
const creds = { email: 'alice@test.fr', password: 'Motdepasse123!', displayName: 'Alice' };

function register() {
  return request(app).post(base + '/register').send(creds);
}

describe('Auth local', () => {
  it("inscription -> 201 avec une paire de tokens", async () => {
    const res = await register();
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('inscription en doublon -> 409', async () => {
    await register();
    const res = await register();
    expect(res.status).toBe(409);
  });

  // Un cas par famille de caractères exigée, plus la longueur.
  const faibles: Array<[string, string]> = [
    ['trop court', 'Court1!'],
    ['sans majuscule', 'motdepasse123!'],
    ['sans minuscule', 'MOTDEPASSE123!'],
    ['sans chiffre', 'Motdepasseabc!'],
    ['sans caractère spécial', 'Motdepasse1234'],
  ];

  it.each(faibles)('inscription avec un mot de passe %s -> 400', async (_cas, password) => {
    const res = await request(app)
      .post(base + '/register')
      .send({ ...creds, password });
    expect(res.status).toBe(400);
  });

  it('le détail du 400 nomme la famille manquante', async () => {
    const res = await request(app)
      .post(base + '/register')
      .send({ ...creds, password: 'motdepasse123!' });
    expect(res.status).toBe(400);
    const messages = (res.body.error.details as Array<{ message: string }>).map((d) => d.message);
    expect(messages).toContain('Le mot de passe doit contenir une majuscule');
  });

  it('connexion avec bon mot de passe -> 200', async () => {
    await register();
    const res = await request(app)
      .post(base + '/login')
      .send({ email: creds.email, password: creds.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it('connexion avec mauvais mot de passe -> 401', async () => {
    await register();
    const res = await request(app)
      .post(base + '/login')
      .send({ email: creds.email, password: 'faux' });
    expect(res.status).toBe(401);
  });

  it('/me avec token -> 200 et jamais le hash du mot de passe', async () => {
    const reg = await register();
    const res = await request(app)
      .get(base + '/me')
      .set('Authorization', 'Bearer ' + reg.body.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(creds.email);
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('/me sans token -> 401', async () => {
    const res = await request(app).get(base + '/me');
    expect(res.status).toBe(401);
  });

  it('refresh fait tourner le token et rejette l ancien', async () => {
    const reg = await register();
    const first = reg.body.refreshToken;

    const rotated = await request(app).post(base + '/refresh').send({ refreshToken: first });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(first);

    const reuse = await request(app).post(base + '/refresh').send({ refreshToken: first });
    expect(reuse.status).toBe(401);
  });

  it('logout révoque le refresh token', async () => {
    const reg = await register();
    const { accessToken, refreshToken } = reg.body;

    const out = await request(app)
      .post(base + '/logout')
      .set('Authorization', 'Bearer ' + accessToken)
      .send({ refreshToken });
    expect(out.status).toBe(204);

    const after = await request(app).post(base + '/refresh').send({ refreshToken });
    expect(after.status).toBe(401);
  });
});
