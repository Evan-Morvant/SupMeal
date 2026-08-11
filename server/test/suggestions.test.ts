import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();
const base = '/api/v1/recipes/suggestions';

const bearer = (token: string) => 'Bearer ' + token;

async function registerUser(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'motdepasse123', displayName: email.split('@')[0] });
  return res.body.accessToken;
}

async function createRecipe(token: string, body: Record<string, unknown>): Promise<string> {
  const res = await request(app)
    .post('/api/v1/recipes')
    .set('Authorization', bearer(token))
    .send(body);
  expect(res.status).toBe(201);
  return res.body.id;
}

function setPreferences(token: string, preferences: Record<string, unknown>) {
  return request(app)
    .put('/api/v1/users/me/preferences')
    .set('Authorization', bearer(token))
    .send(preferences);
}

function suggest(token: string, query: Record<string, unknown> = {}) {
  return request(app).get(base).query(query).set('Authorization', bearer(token));
}

/** Titres suggérés, dans l'ordre du classement. */
function titles(body: { recipe: { title: string } }[]): string[] {
  return body.map((entry) => entry.recipe.title);
}

function isoDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('Suggestions de recettes', () => {
  it('exige une authentification', async () => {
    const res = await request(app).get(base);
    expect(res.status).toBe(401);
  });

  it('n est pas confondue avec une recette dont l identifiant serait « suggestions »', async () => {
    const token = await registerUser('sug1@test.fr');
    const res = await suggest(token);
    // Sans cette route déclarée avant `/:id`, la requête finirait en 400 ou 404.
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('classe les recettes selon le régime et les cuisines du profil', async () => {
    const token = await registerUser('sug2@test.fr');
    await setPreferences(token, {
      diets: ['Végétarien'],
      preferredCuisines: ['Italienne'],
      allergies: [],
      defaultServings: 2,
    });

    await createRecipe(token, { title: 'Steak frites' });
    await createRecipe(token, { title: 'Pizza margherita', tags: ['Italienne'] });
    await createRecipe(token, { title: 'Risotto aux legumes', tags: ['Végétarien', 'Italienne'] });

    const res = await suggest(token);
    expect(res.status).toBe(200);
    expect(titles(res.body)).toEqual(['Risotto aux legumes', 'Pizza margherita', 'Steak frites']);
    expect(res.body[0].score).toBeGreaterThan(res.body[1].score);
    expect(res.body[2].score).toBe(0);
  });

  it('accompagne chaque suggestion de ses motifs', async () => {
    const token = await registerUser('sug3@test.fr');
    await setPreferences(token, { diets: ['Végétarien'], allergies: [] });
    await createRecipe(token, { title: 'Curry de legumes', tags: ['Végétarien'] });

    const res = await suggest(token);
    expect(res.body[0].reasons).toEqual(['correspond à votre régime : Végétarien']);
  });

  it('écarte toute recette contenant un ingrédient allergène', async () => {
    const token = await registerUser('sug4@test.fr');
    await setPreferences(token, { allergies: ['arachide'] });

    await createRecipe(token, {
      title: 'Sauce satay',
      // La correspondance est large : « arachide » écarte « beurre d arachide ».
      ingredients: [{ name: 'beurre d arachide', quantity: 100, unit: 'g' }],
    });
    await createRecipe(token, {
      title: 'Salade verte',
      ingredients: [{ name: 'laitue', quantity: 1 }],
    });

    const res = await suggest(token);
    expect(titles(res.body)).toEqual(['Salade verte']);
  });

  it('traite les jokers LIKE d une allergie comme du texte', async () => {
    const token = await registerUser('sug5@test.fr');
    await setPreferences(token, { allergies: ['%'] });
    await createRecipe(token, {
      title: 'Toujours proposable',
      ingredients: [{ name: 'farine', quantity: 100, unit: 'g' }],
    });

    // Sans échappement, « % » écarterait toutes les recettes ayant un ingrédient.
    const res = await suggest(token);
    expect(titles(res.body)).toEqual(['Toujours proposable']);
  });

  it('écarte les favoris : une suggestion sert à faire découvrir', async () => {
    const token = await registerUser('sug6@test.fr');
    const favorite = await createRecipe(token, { title: 'Déjà en favori' });
    await createRecipe(token, { title: 'Jamais vue' });
    await request(app)
      .post('/api/v1/recipes/' + favorite + '/favorite')
      .set('Authorization', bearer(token));

    const res = await suggest(token);
    expect(titles(res.body)).toEqual(['Jamais vue']);
  });

  it('écarte ce qui est déjà prévu, mais garde ce qui est passé', async () => {
    const token = await registerUser('sug7@test.fr');
    const aVenir = await createRecipe(token, { title: 'Prévue demain' });
    const passee = await createRecipe(token, { title: 'Cuisinée le mois dernier' });

    await request(app)
      .post('/api/v1/meal-plan')
      .set('Authorization', bearer(token))
      .send({ recipeId: aVenir, date: isoDate(3), mealType: 'dîner' });
    await request(app)
      .post('/api/v1/meal-plan')
      .set('Authorization', bearer(token))
      .send({ recipeId: passee, date: isoDate(-30), mealType: 'dîner' });

    const res = await suggest(token);
    expect(titles(res.body)).toEqual(['Cuisinée le mois dernier']);
  });

  it('rapproche des tags de ce que l utilisateur cuisine déjà', async () => {
    const token = await registerUser('sug8@test.fr');
    const aime = await createRecipe(token, { title: 'Tiramisu', tags: ['Dessert'] });
    await request(app)
      .post('/api/v1/recipes/' + aime + '/favorite')
      .set('Authorization', bearer(token));

    await createRecipe(token, { title: 'Poulet rôti', tags: ['Plat'] });
    await createRecipe(token, { title: 'Panna cotta', tags: ['Dessert'] });

    const res = await suggest(token);
    expect(titles(res.body)[0]).toBe('Panna cotta');
    expect(res.body[0].reasons).toEqual(['proche de ce que vous cuisinez : Dessert']);
  });

  it('respecte la limite demandée', async () => {
    const token = await registerUser('sug9@test.fr');
    for (const title of ['Une', 'Deux', 'Trois']) {
      await createRecipe(token, { title });
    }

    const res = await suggest(token, { limit: 2 });
    expect(res.body).toHaveLength(2);

    const excessif = await suggest(token, { limit: 100 });
    expect(excessif.status).toBe(400);
  });

  it('ne suggère jamais une recette inaccessible', async () => {
    const auteur = await registerUser('sug10@test.fr');
    await createRecipe(auteur, { title: 'Recette privée d un tiers' });

    const autre = await registerUser('sug11@test.fr');
    const res = await suggest(autre);
    expect(res.body).toEqual([]);
  });

  it('suggère les recettes d un cookbook dont on est membre', async () => {
    const owner = await registerUser('sug12@test.fr');
    const cookbook = await request(app)
      .post('/api/v1/cookbooks')
      .set('Authorization', bearer(owner))
      .send({ name: 'Partagé' });
    await request(app)
      .post('/api/v1/cookbooks/' + cookbook.body.id + '/recipes')
      .set('Authorization', bearer(owner))
      .send({ title: 'Recette du groupe' });

    const invite = await registerUser('sug13@test.fr');
    const invitation = await request(app)
      .post('/api/v1/cookbooks/' + cookbook.body.id + '/invitations')
      .set('Authorization', bearer(owner))
      .send({ email: 'sug13@test.fr', role: 'READER' });
    await request(app)
      .post('/api/v1/invitations/' + invitation.body.token + '/accept')
      .set('Authorization', bearer(invite));

    const res = await suggest(invite);
    expect(titles(res.body)).toEqual(['Recette du groupe']);
  });
});
