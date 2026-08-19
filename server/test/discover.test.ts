import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();
const base = '/api/v1/discover/recipes';

async function registerUser(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'Motdepasse123!', displayName: email.split('@')[0] });
  return res.body.accessToken;
}

const bearer = (token: string) => 'Bearer ' + token;

async function createRecipe(
  token: string,
  body: Record<string, unknown>,
  visibility = 'public',
): Promise<string> {
  const res = await request(app)
    .post('/api/v1/recipes')
    .set('Authorization', bearer(token))
    .send({ ...body, visibility });
  expect(res.status).toBe(201);
  return res.body.id;
}

/** Dépose un avis d'un compte tiers, pour alimenter la note moyenne. */
async function rate(recipeId: string, email: string, rating: number): Promise<void> {
  const token = await registerUser(email);
  const res = await request(app)
    .put('/api/v1/recipes/' + recipeId + '/reviews')
    .set('Authorization', bearer(token))
    .send({ rating });
  expect(res.status).toBe(200);
}

const titles = (body: { items: { title: string }[] }) => body.items.map((item) => item.title);

describe('Découverte des recettes publiques', () => {
  it('un visiteur anonyme obtient une page de recettes publiques', async () => {
    const token = await registerUser('dc1@test.fr');
    await createRecipe(token, { title: 'Ratatouille publique' });

    const res = await request(app).get(base);

    expect(res.status).toBe(200);
    expect(titles(res.body)).toContain('Ratatouille publique');
    expect(res.body).toMatchObject({ page: 1, pageSize: 20 });
    expect(typeof res.body.total).toBe('number');
  });

  it('les recettes privées restent invisibles', async () => {
    const token = await registerUser('dc2@test.fr');
    await createRecipe(token, { title: 'Secret de famille' }, 'private');

    const res = await request(app).get(base);

    expect(titles(res.body)).not.toContain('Secret de famille');
  });

  it('même à leur propre créateur : la découverte ne montre que le fonds public', async () => {
    const token = await registerUser('dc3@test.fr');
    await createRecipe(token, { title: 'Ma privée' }, 'private');

    const res = await request(app).get(base).set('Authorization', bearer(token));

    expect(titles(res.body)).not.toContain('Ma privée');
  });

  it('cherche en plein texte', async () => {
    const token = await registerUser('dc4@test.fr');
    await createRecipe(token, { title: 'Tarte aux myrtilles' });
    await createRecipe(token, { title: 'Gratin dauphinois' });

    const res = await request(app).get(base).query({ q: 'myrtilles' });

    expect(titles(res.body)).toEqual(['Tarte aux myrtilles']);
  });

  it('filtre par tags', async () => {
    const token = await registerUser('dc5@test.fr');
    await createRecipe(token, { title: 'Curry de legumes', tags: ['Végétarien'] });
    await createRecipe(token, { title: 'Boeuf bourguignon', tags: ['Viande'] });

    const res = await request(app).get(base).query({ tags: 'Végétarien' });

    expect(titles(res.body)).toEqual(['Curry de legumes']);
  });

  it('trie par note moyenne, les non notées en dernier', async () => {
    const auteur = await registerUser('dc6@test.fr');
    const bonne = await createRecipe(auteur, { title: 'Tres bien notee' });
    const moyenne = await createRecipe(auteur, { title: 'Moyennement notee' });
    await createRecipe(auteur, { title: 'Jamais notee' });

    await rate(bonne, 'dc6-a@test.fr', 5);
    await rate(moyenne, 'dc6-b@test.fr', 2);

    const res = await request(app).get(base).query({ sort: 'rating' });

    const classement = titles(res.body);
    expect(classement.indexOf('Tres bien notee')).toBeLessThan(
      classement.indexOf('Moyennement notee'),
    );
    expect(classement.indexOf('Moyennement notee')).toBeLessThan(
      classement.indexOf('Jamais notee'),
    );
  });

  it('pagine', async () => {
    const token = await registerUser('dc7@test.fr');
    await createRecipe(token, { title: 'Pagination une' });
    await createRecipe(token, { title: 'Pagination deux' });

    const res = await request(app).get(base).query({ pageSize: 1, page: 1 });

    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  it('refuse un tri inconnu', async () => {
    const res = await request(app).get(base).query({ sort: 'prepTime' });

    expect(res.status).toBe(400);
  });

  it('filtre par temps de cuisson, sans authentification', async () => {
    const token = await registerUser('dc7b@test.fr');
    await createRecipe(token, { title: 'Rapide au four', cookTimeMin: 20 });
    await createRecipe(token, { title: 'Longue au four', cookTimeMin: 120 });

    const res = await request(app).get(base).query({ maxCook: 30, q: 'four' });

    expect(res.status).toBe(200);
    expect(titles(res.body)).toEqual(['Rapide au four']);
  });

  it('une recette sans temps renseigné sort du filtre de durée', async () => {
    const token = await registerUser('dc7c@test.fr');
    await createRecipe(token, { title: 'Chronometree', prepTimeMin: 10 });
    await createRecipe(token, { title: 'Non chronometree' });

    const res = await request(app).get(base).query({ maxPrep: 60, q: 'chronometree' });

    expect(titles(res.body)).toEqual(['Chronometree']);
  });

  it('ignore les critères propres à un compte', async () => {
    const token = await registerUser('dc8@test.fr');
    await createRecipe(token, { title: 'Publique quand même' });

    // `favorite` et `cookbookId` n'existent pas ici : le schéma les rejette
    // en silence plutôt que de filtrer sur un périmètre que le visiteur n'a pas.
    const res = await request(app).get(base).query({ favorite: 'true' });

    expect(res.status).toBe(200);
    expect(titles(res.body)).toContain('Publique quand même');
  });

  it('signale ses favoris à un utilisateur connecté', async () => {
    const auteur = await registerUser('dc9-auteur@test.fr');
    const lecteur = await registerUser('dc9@test.fr');
    const recipeId = await createRecipe(auteur, { title: 'Mise en favori' });
    await request(app)
      .post('/api/v1/recipes/' + recipeId + '/favorite')
      .set('Authorization', bearer(lecteur));

    const connecte = await request(app).get(base).set('Authorization', bearer(lecteur));
    const anonyme = await request(app).get(base);

    const trouve = (body: { items: { title: string; isFavorite: boolean }[] }) =>
      body.items.find((item) => item.title === 'Mise en favori')!;
    expect(trouve(connecte.body).isFavorite).toBe(true);
    expect(trouve(anonyme.body).isFavorite).toBe(false);
  });
});

describe('Détail public d une recette', () => {
  it('rend la recette entière à un visiteur anonyme', async () => {
    const token = await registerUser('dd1@test.fr');
    const recipeId = await createRecipe(token, {
      title: 'Soupe à l oignon',
      steps: ['Émincer les oignons'],
      ingredients: [{ name: 'oignon', quantity: 4 }],
    });

    const res = await request(app).get(base + '/' + recipeId);

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Soupe à l oignon');
    expect(res.body.steps).toHaveLength(1);
    expect(res.body.ingredients[0].name).toBe('oignon');
  });

  it('répond 404 sur une recette privée, comme sur une inexistante', async () => {
    const token = await registerUser('dd2@test.fr');
    const privee = await createRecipe(token, { title: 'Cachée' }, 'private');

    const surPrivee = await request(app).get(base + '/' + privee);
    const surInconnue = await request(app).get(
      base + '/00000000-0000-4000-8000-000000000000',
    );

    expect(surPrivee.status).toBe(404);
    expect(surInconnue.status).toBe(404);
    // Rien ne distingue les deux réponses : c'est tout l'objet du 404.
    expect(surPrivee.body).toEqual(surInconnue.body);
  });

  it('répond 404 même à son créateur, qui la lit par /recipes', async () => {
    const token = await registerUser('dd3@test.fr');
    const privee = await createRecipe(token, { title: 'La mienne' }, 'private');

    const parDiscover = await request(app)
      .get(base + '/' + privee)
      .set('Authorization', bearer(token));
    const parRecipes = await request(app)
      .get('/api/v1/recipes/' + privee)
      .set('Authorization', bearer(token));

    expect(parDiscover.status).toBe(404);
    expect(parRecipes.status).toBe(200);
  });

  it('répond 400 sur un identifiant mal formé, jamais 500', async () => {
    const res = await request(app).get(base + '/pas-un-uuid');

    expect(res.status).toBe(400);
  });

  it('porte la note moyenne', async () => {
    const auteur = await registerUser('dd4@test.fr');
    const recipeId = await createRecipe(auteur, { title: 'Notée publiquement' });
    await rate(recipeId, 'dd4-a@test.fr', 4);

    const res = await request(app).get(base + '/' + recipeId);

    expect(res.body.avgRating).toBe(4);
    expect(res.body.reviewCount).toBe(1);
  });
});
