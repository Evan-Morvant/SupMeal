import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();
const base = '/api/v1/swagger';

describe('Documentation de l API', () => {
  it('sert la spécification en JSON, sans authentification', async () => {
    const res = await request(app).get(base + '/openapi.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.info.title).toContain('SUPMEAL');
  });

  it('la spécification décrit bien les routes servies', async () => {
    const res = await request(app).get(base + '/openapi.json');

    // Un échantillon suffit : on se garde d'un fichier vide ou tronqué.
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(['/auth/login', '/recipes', '/recipes/{id}/reviews']),
    );
  });

  it('sert la page Swagger UI', async () => {
    const res = await request(app).get(base + '/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });

  it('assouplit la politique de sécurité pour cette page seulement', async () => {
    const docs = await request(app).get(base + '/');
    const api = await request(app).get('/api/v1/health');

    // Le script en ligne est la seule concession qui compte : Helmet tolère
    // déjà les styles en ligne par défaut, jamais les scripts.
    expect(docs.headers['content-security-policy']).toContain("script-src 'self' 'unsafe-inline'");
    expect(api.headers['content-security-policy']).toContain("script-src 'self';");
  });
});
