import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { Favorite, User } from '../src/models';

const app = createApp();
const base = '/api/v1/recipes';

async function registerUser(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'motdepasse123', displayName: email.split('@')[0] });
  return res.body.accessToken;
}

const bearer = (token: string) => 'Bearer ' + token;

async function createRecipe(token: string, title = 'Tarte'): Promise<string> {
  const res = await request(app).post(base).set('Authorization', bearer(token)).send({ title });
  return res.body.id;
}

/** PNG 1x1 valide, suffisant pour un test d'upload. */
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function attachImage(token: string, recipeId: string, buffer: Buffer, filename: string, type: string) {
  return request(app)
    .post(base + '/' + recipeId + '/image')
    .set('Authorization', bearer(token))
    .attach('file', buffer, { filename, contentType: type });
}

describe('Favoris', () => {
  it('ajoute puis retire un favori', async () => {
    const token = await registerUser('fav1@test.fr');
    const recipeId = await createRecipe(token);

    const added = await request(app)
      .post(base + '/' + recipeId + '/favorite')
      .set('Authorization', bearer(token));
    expect(added.status).toBe(204);

    const detail = await request(app)
      .get(base + '/' + recipeId)
      .set('Authorization', bearer(token));
    expect(detail.body.isFavorite).toBe(true);

    const removed = await request(app)
      .delete(base + '/' + recipeId + '/favorite')
      .set('Authorization', bearer(token));
    expect(removed.status).toBe(204);

    const after = await request(app)
      .get(base + '/' + recipeId)
      .set('Authorization', bearer(token));
    expect(after.body.isFavorite).toBe(false);
  });

  it('ajouter deux fois ne crée qu une ligne', async () => {
    const token = await registerUser('fav2@test.fr');
    const recipeId = await createRecipe(token);

    await request(app).post(base + '/' + recipeId + '/favorite').set('Authorization', bearer(token));
    const second = await request(app)
      .post(base + '/' + recipeId + '/favorite')
      .set('Authorization', bearer(token));

    expect(second.status).toBe(204);
    expect(await Favorite.count({ where: { recipeId } })).toBe(1);
  });

  it('retirer un favori inexistant reste un 204', async () => {
    const token = await registerUser('fav3@test.fr');
    const recipeId = await createRecipe(token);

    const res = await request(app)
      .delete(base + '/' + recipeId + '/favorite')
      .set('Authorization', bearer(token));
    expect(res.status).toBe(204);
  });

  it('la liste indique le statut de favori', async () => {
    const token = await registerUser('fav4@test.fr');
    const garde = await createRecipe(token, 'Gardee');
    await createRecipe(token, 'Ordinaire');
    await request(app).post(base + '/' + garde + '/favorite').set('Authorization', bearer(token));

    const res = await request(app).get(base).set('Authorization', bearer(token));
    const parTitre = Object.fromEntries(
      res.body.items.map((item: { title: string; isFavorite: boolean }) => [
        item.title,
        item.isFavorite,
      ]),
    );
    expect(parTitre).toEqual({ Gardee: true, Ordinaire: false });
  });

  it('les favoris sont propres à chaque utilisateur', async () => {
    const proprietaire = await registerUser('fav5@test.fr');
    const autre = await registerUser('fav6@test.fr');
    const recipeId = await createRecipe(proprietaire, 'Publique');
    await request(app)
      .patch(base + '/' + recipeId)
      .set('Authorization', bearer(proprietaire))
      .send({ visibility: 'public' });

    await request(app)
      .post(base + '/' + recipeId + '/favorite')
      .set('Authorization', bearer(autre));

    const vueProprietaire = await request(app)
      .get(base + '/' + recipeId)
      .set('Authorization', bearer(proprietaire));
    expect(vueProprietaire.body.isFavorite).toBe(false);

    const vueAutre = await request(app)
      .get(base + '/' + recipeId)
      .set('Authorization', bearer(autre));
    expect(vueAutre.body.isFavorite).toBe(true);
  });

  it('mettre en favori une recette inaccessible -> 403', async () => {
    const proprietaire = await registerUser('fav7@test.fr');
    const intrus = await registerUser('fav8@test.fr');
    const recipeId = await createRecipe(proprietaire);

    const res = await request(app)
      .post(base + '/' + recipeId + '/favorite')
      .set('Authorization', bearer(intrus));
    expect(res.status).toBe(403);
  });

  it('retirer un favori reste possible après perte d accès', async () => {
    const proprietaire = await registerUser('fav9@test.fr');
    const autre = await registerUser('fav10@test.fr');
    const recipeId = await createRecipe(proprietaire, 'Ephemere');
    await request(app)
      .patch(base + '/' + recipeId)
      .set('Authorization', bearer(proprietaire))
      .send({ visibility: 'public' });

    await request(app)
      .post(base + '/' + recipeId + '/favorite')
      .set('Authorization', bearer(autre));

    // La recette redevient privée : l'autre utilisateur n'y a plus accès.
    await request(app)
      .patch(base + '/' + recipeId)
      .set('Authorization', bearer(proprietaire))
      .send({ visibility: 'private' });

    const res = await request(app)
      .delete(base + '/' + recipeId + '/favorite')
      .set('Authorization', bearer(autre));
    expect(res.status).toBe(204);

    const user = await User.findOne({ where: { email: 'fav10@test.fr' } });
    expect(await Favorite.count({ where: { userId: user!.id } })).toBe(0);
  });
});

describe('Image de recette', () => {
  it('accepte un PNG et renvoie une URL absolue', async () => {
    const token = await registerUser('img1@test.fr');
    const recipeId = await createRecipe(token);

    const res = await attachImage(token, recipeId, PNG_1x1, 'photo.png', 'image/png');
    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toMatch(/^http:\/\/localhost:4000\/uploads\/recipes\/.+\.png$/);
  });

  it('écrit le fichier sur le disque et le sert en statique', async () => {
    const token = await registerUser('img2@test.fr');
    const recipeId = await createRecipe(token);

    const res = await attachImage(token, recipeId, PNG_1x1, 'photo.png', 'image/png');
    const publicPath = res.body.imageUrl.replace('http://localhost:4000', '');
    const diskPath = path.join(env.UPLOAD_DIR, publicPath.replace('/uploads/', ''));
    expect(fs.existsSync(diskPath)).toBe(true);

    const served = await request(app).get(publicPath);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toContain('image/png');
  });

  it('ignore le nom de fichier fourni par le client', async () => {
    const token = await registerUser('img3@test.fr');
    const recipeId = await createRecipe(token);

    const res = await attachImage(token, recipeId, PNG_1x1, '../../evil.png', 'image/png');
    expect(res.status).toBe(200);
    expect(res.body.imageUrl).not.toContain('evil');
    expect(res.body.imageUrl).not.toContain('..');
  });

  it('remplace l image et supprime l ancien fichier', async () => {
    const token = await registerUser('img4@test.fr');
    const recipeId = await createRecipe(token);

    const first = await attachImage(token, recipeId, PNG_1x1, 'a.png', 'image/png');
    const firstDisk = path.join(
      env.UPLOAD_DIR,
      first.body.imageUrl.replace('http://localhost:4000/uploads/', ''),
    );

    const second = await attachImage(token, recipeId, PNG_1x1, 'b.png', 'image/png');
    expect(second.body.imageUrl).not.toBe(first.body.imageUrl);
    expect(fs.existsSync(firstDisk)).toBe(false);
  });

  it('refuse un type non image -> 400', async () => {
    const token = await registerUser('img5@test.fr');
    const recipeId = await createRecipe(token);

    const res = await attachImage(token, recipeId, Buffer.from('bonjour'), 'notes.txt', 'text/plain');
    expect(res.status).toBe(400);
  });

  it('refuse un fichier trop volumineux -> 413', async () => {
    const token = await registerUser('img6@test.fr');
    const recipeId = await createRecipe(token);

    const gros = Buffer.alloc(env.UPLOAD_MAX_BYTES + 1024, 1);
    const res = await attachImage(token, recipeId, gros, 'gros.png', 'image/png');
    expect(res.status).toBe(413);
  });

  it('sans fichier -> 400', async () => {
    const token = await registerUser('img7@test.fr');
    const recipeId = await createRecipe(token);

    const res = await request(app)
      .post(base + '/' + recipeId + '/image')
      .set('Authorization', bearer(token));
    expect(res.status).toBe(400);
  });

  it('un autre utilisateur ne peut pas changer l image -> 403', async () => {
    const proprietaire = await registerUser('img8@test.fr');
    const intrus = await registerUser('img9@test.fr');
    const recipeId = await createRecipe(proprietaire);

    const res = await attachImage(intrus, recipeId, PNG_1x1, 'photo.png', 'image/png');
    expect(res.status).toBe(403);
  });

  it('un fichier inexistant sous /uploads -> 404', async () => {
    const res = await request(app).get('/uploads/recipes/inexistant.png');
    expect(res.status).toBe(404);
  });
});
