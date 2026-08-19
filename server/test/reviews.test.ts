import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Recipe } from '../src/models';

const app = createApp();
const base = '/api/v1/recipes';

async function registerUser(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'Motdepasse123!', displayName: email.split('@')[0] });
  return res.body.accessToken;
}

const bearer = (token: string) => 'Bearer ' + token;

const reviewsUrl = (recipeId: string) => base + '/' + recipeId + '/reviews';

async function createRecipe(token: string, visibility = 'public'): Promise<string> {
  const res = await request(app)
    .post(base)
    .set('Authorization', bearer(token))
    .send({ title: 'Tarte aux pommes', visibility });
  return res.body.id;
}

function review(token: string, recipeId: string, rating: number, body?: string) {
  return request(app)
    .put(reviewsUrl(recipeId))
    .set('Authorization', bearer(token))
    .send({ rating, body });
}

describe('Dépôt d un avis', () => {
  it('note une recette publique -> 200 avec son auteur', async () => {
    const owner = await registerUser('rv-owner@test.fr');
    const reader = await registerUser('rv-reader@test.fr');
    const recipeId = await createRecipe(owner);

    const res = await review(reader, recipeId, 4, 'Bien dosée');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ recipeId, rating: 4, body: 'Bien dosée' });
    expect(res.body.author.email).toBe('rv-reader@test.fr');
    expect(res.body.author.passwordHash).toBeUndefined();
  });

  it('un second avis du même utilisateur remplace le premier', async () => {
    const owner = await registerUser('rv-owner2@test.fr');
    const reader = await registerUser('rv-reader2@test.fr');
    const recipeId = await createRecipe(owner);

    const first = await review(reader, recipeId, 2, 'Trop sucrée');
    const second = await review(reader, recipeId, 5, 'Finalement très bonne');

    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.rating).toBe(5);

    const list = await request(app).get(reviewsUrl(recipeId));
    expect(list.body.reviewCount).toBe(1);
    expect(list.body.items).toHaveLength(1);
  });

  it('le créateur ne note pas sa propre recette -> 403', async () => {
    const owner = await registerUser('rv-self@test.fr');
    const recipeId = await createRecipe(owner);

    const res = await review(owner, recipeId, 5);

    expect(res.status).toBe(403);
  });

  it('refuse une note hors de l échelle 1-5 -> 400', async () => {
    const owner = await registerUser('rv-owner3@test.fr');
    const reader = await registerUser('rv-reader3@test.fr');
    const recipeId = await createRecipe(owner);

    expect((await review(reader, recipeId, 6)).status).toBe(400);
    expect((await review(reader, recipeId, 0)).status).toBe(400);
  });

  it('sans authentification -> 401', async () => {
    const owner = await registerUser('rv-owner4@test.fr');
    const recipeId = await createRecipe(owner);

    const res = await request(app).put(reviewsUrl(recipeId)).send({ rating: 5 });

    expect(res.status).toBe(401);
  });

  it('recette privée d autrui : pas d avis possible -> 403', async () => {
    const owner = await registerUser('rv-owner5@test.fr');
    const outsider = await registerUser('rv-outsider@test.fr');
    const recipeId = await createRecipe(owner, 'private');

    const res = await review(outsider, recipeId, 5);

    expect(res.status).toBe(403);
  });
});

describe('Lecture des avis', () => {
  it('moyenne et total sur plusieurs avis', async () => {
    const owner = await registerUser('rv-avg-owner@test.fr');
    const first = await registerUser('rv-avg1@test.fr');
    const second = await registerUser('rv-avg2@test.fr');
    const recipeId = await createRecipe(owner);

    await review(first, recipeId, 5);
    await review(second, recipeId, 4);

    const res = await request(app).get(reviewsUrl(recipeId));

    expect(res.status).toBe(200);
    expect(res.body.avgRating).toBe(4.5);
    expect(res.body.reviewCount).toBe(2);
    expect(res.body.items).toHaveLength(2);
  });

  it('recette sans avis : moyenne nulle, pas zéro', async () => {
    const owner = await registerUser('rv-empty@test.fr');
    const recipeId = await createRecipe(owner);

    const res = await request(app).get(reviewsUrl(recipeId));

    expect(res.body.avgRating).toBeNull();
    expect(res.body.reviewCount).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  it('un visiteur anonyme lit les avis d une recette publique', async () => {
    const owner = await registerUser('rv-anon-owner@test.fr');
    const reader = await registerUser('rv-anon-reader@test.fr');
    const recipeId = await createRecipe(owner);
    await review(reader, recipeId, 3, 'Correcte');

    const res = await request(app).get(reviewsUrl(recipeId));

    expect(res.status).toBe(200);
    expect(res.body.items[0].body).toBe('Correcte');
  });

  it('un visiteur anonyme n atteint pas les avis d une recette privée -> 403', async () => {
    const owner = await registerUser('rv-anon-priv@test.fr');
    const recipeId = await createRecipe(owner, 'private');

    const res = await request(app).get(reviewsUrl(recipeId));

    expect(res.status).toBe(403);
  });

  it('un token invalide reste une erreur, pas une visite anonyme -> 401', async () => {
    const owner = await registerUser('rv-badtoken@test.fr');
    const recipeId = await createRecipe(owner);

    const res = await request(app)
      .get(reviewsUrl(recipeId))
      .set('Authorization', bearer('pas-un-jeton'));

    expect(res.status).toBe(401);
  });

  it('recette inconnue -> 404', async () => {
    const res = await request(app).get(
      reviewsUrl('00000000-0000-4000-8000-000000000000'),
    );

    expect(res.status).toBe(404);
  });
});

describe('Suppression d un avis', () => {
  it('retire son avis et remet la recette à l état non noté', async () => {
    const owner = await registerUser('rv-del-owner@test.fr');
    const reader = await registerUser('rv-del-reader@test.fr');
    const recipeId = await createRecipe(owner);
    await review(reader, recipeId, 5);

    const res = await request(app)
      .delete(reviewsUrl(recipeId))
      .set('Authorization', bearer(reader));

    expect(res.status).toBe(204);

    const list = await request(app).get(reviewsUrl(recipeId));
    expect(list.body.avgRating).toBeNull();
    expect(list.body.reviewCount).toBe(0);
  });

  it('sans avis à supprimer -> 404', async () => {
    const owner = await registerUser('rv-del-owner2@test.fr');
    const reader = await registerUser('rv-del-reader2@test.fr');
    const recipeId = await createRecipe(owner);

    const res = await request(app)
      .delete(reviewsUrl(recipeId))
      .set('Authorization', bearer(reader));

    expect(res.status).toBe(404);
  });

  it('la suppression ne touche que son propre avis', async () => {
    const owner = await registerUser('rv-del-owner3@test.fr');
    const first = await registerUser('rv-del1@test.fr');
    const second = await registerUser('rv-del2@test.fr');
    const recipeId = await createRecipe(owner);
    await review(first, recipeId, 5);
    await review(second, recipeId, 3);

    await request(app).delete(reviewsUrl(recipeId)).set('Authorization', bearer(first));

    const list = await request(app).get(reviewsUrl(recipeId));
    expect(list.body.reviewCount).toBe(1);
    expect(list.body.avgRating).toBe(3);
    expect(list.body.items[0].author.email).toBe('rv-del2@test.fr');
  });
});

describe('Agrégats portés par la recette', () => {
  it('la fiche de la recette expose la note moyenne', async () => {
    const owner = await registerUser('rv-fiche-owner@test.fr');
    const reader = await registerUser('rv-fiche-reader@test.fr');
    const recipeId = await createRecipe(owner);
    await review(reader, recipeId, 4);

    const res = await request(app)
      .get(base + '/' + recipeId)
      .set('Authorization', bearer(owner));

    expect(res.body.avgRating).toBe(4);
    expect(res.body.reviewCount).toBe(1);
  });

  it('noter une recette ne la marque pas comme modifiée', async () => {
    const owner = await registerUser('rv-date-owner@test.fr');
    const reader = await registerUser('rv-date-reader@test.fr');
    const recipeId = await createRecipe(owner);
    const before = (await Recipe.findByPk(recipeId))!.updatedAt;

    await review(reader, recipeId, 4);

    const after = (await Recipe.findByPk(recipeId))!.updatedAt;
    expect(after.getTime()).toBe(before.getTime());
  });
});
