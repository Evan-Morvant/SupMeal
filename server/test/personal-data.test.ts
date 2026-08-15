import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Recipe } from '../src/models';

const app = createApp();
const url = '/api/v1/users/me/data';

async function registerUser(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'motdepasse123', displayName: email.split('@')[0] });
  return res.body.accessToken;
}

const bearer = (token: string) => 'Bearer ' + token;

const download = (token: string) => request(app).get(url).set('Authorization', bearer(token));

async function createRecipe(token: string, title: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/recipes')
    .set('Authorization', bearer(token))
    .send({ title, visibility: 'public' });
  return res.body.id;
}

async function createCookbook(token: string, name: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/cookbooks')
    .set('Authorization', bearer(token))
    .send({ name });
  return res.body.id;
}

/** Fait entrer un second compte dans le cookbook, avec le rôle demandé. */
async function invite(
  ownerToken: string,
  guestToken: string,
  cookbookId: string,
  email: string,
  role: string,
): Promise<void> {
  const invitation = await request(app)
    .post('/api/v1/cookbooks/' + cookbookId + '/invitations')
    .set('Authorization', bearer(ownerToken))
    .send({ email, role });
  await request(app)
    .post('/api/v1/invitations/' + invitation.body.token + '/accept')
    .set('Authorization', bearer(guestToken));
}

describe('Export des données personnelles', () => {
  it('exige une authentification', async () => {
    const res = await request(app).get(url);
    expect(res.status).toBe(401);
  });

  it('rend un fichier daté, en pièce jointe, avec son avertissement', async () => {
    const token = await registerUser('pd1@test.fr');

    const res = await download(token);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="supmeal-donnees-\d{4}-\d{2}-\d{2}\.json"/,
    );
    expect(res.body.warning).toContain('en clair');
    expect(res.body.profile.email).toBe('pd1@test.fr');
    expect(res.body.profile.displayName).toBe('pd1');
  });

  it('ne laisse sortir ni hash de mot de passe ni jeton', async () => {
    const token = await registerUser('pd2@test.fr');

    const res = await download(token);

    const brut = JSON.stringify(res.body);
    expect(brut).not.toContain('passwordHash');
    expect(brut).not.toContain('$2a$');
    expect(brut).not.toContain('motdepasse123');
    expect(brut).not.toContain('token');
    // L'existence d'un mot de passe est une donnée du compte, pas sa valeur.
    expect(res.body.profile.hasPassword).toBe(true);
  });

  it('porte les préférences culinaires', async () => {
    const token = await registerUser('pd3@test.fr');
    await request(app)
      .put('/api/v1/users/me/preferences')
      .set('Authorization', bearer(token))
      .send({ diets: ['végétarien'], allergies: ['arachides'], defaultServings: 4 });

    const res = await download(token);

    expect(res.body.preferences).toMatchObject({
      diets: ['végétarien'],
      allergies: ['arachides'],
      defaultServings: 4,
    });
  });

  it('liste les recettes en référence, sans leur contenu', async () => {
    const token = await registerUser('pd4@test.fr');
    await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', bearer(token))
      .send({
        title: 'Blanquette',
        steps: ['Faire revenir la viande'],
        ingredients: [{ name: 'veau', quantity: 800, unit: 'g' }],
      });

    const res = await download(token);

    expect(res.body.recipes.items).toHaveLength(1);
    expect(res.body.recipes.items[0]).toMatchObject({ title: 'Blanquette', visibility: 'private' });
    expect(res.body.recipes.items[0]).not.toHaveProperty('steps');
    expect(res.body.recipes.items[0]).not.toHaveProperty('ingredients');
    expect(res.body.recipes.note).toContain('/api/v1/export');
  });

  it('rassemble favoris, avis, planning et listes de courses', async () => {
    const owner = await registerUser('pd5-owner@test.fr');
    const token = await registerUser('pd5@test.fr');
    const recipeId = await createRecipe(owner, 'Ratatouille');

    await request(app)
      .post('/api/v1/recipes/' + recipeId + '/favorite')
      .set('Authorization', bearer(token));
    await request(app)
      .put('/api/v1/recipes/' + recipeId + '/reviews')
      .set('Authorization', bearer(token))
      .send({ rating: 5, body: 'Parfaite en été' });
    await request(app)
      .post('/api/v1/meal-plan')
      .set('Authorization', bearer(token))
      .send({ recipeId, date: '2026-09-01', mealType: 'dîner' });

    const res = await download(token);

    expect(res.body.favorites).toEqual([
      expect.objectContaining({ recipe: 'Ratatouille' }),
    ]);
    expect(res.body.reviews).toEqual([
      expect.objectContaining({ recipe: 'Ratatouille', rating: 5, body: 'Parfaite en été' }),
    ]);
    expect(res.body.mealPlan).toEqual([
      expect.objectContaining({ recipe: 'Ratatouille', mealType: 'dîner', cookbook: null }),
    ]);
  });

  it('ne porte que ses propres commentaires et messages, jamais ceux des autres', async () => {
    const owner = await registerUser('pd6-owner@test.fr');
    const membre = await registerUser('pd6@test.fr');
    const cookbookId = await createCookbook(owner, 'Cuisine partagée');
    await invite(owner, membre, cookbookId, 'pd6@test.fr', 'COMMENTER');

    const recipeId = await createRecipe(owner, 'Chili');
    await request(app)
      .put('/api/v1/cookbooks/' + cookbookId + '/recipes/' + recipeId)
      .set('Authorization', bearer(owner));

    const fil = '/api/v1/cookbooks/' + cookbookId + '/recipes/' + recipeId + '/comments';
    await request(app)
      .post(fil)
      .set('Authorization', bearer(owner))
      .send({ content: 'Propos du createur' });
    await request(app)
      .post(fil)
      .set('Authorization', bearer(membre))
      .send({ content: 'Propos du membre' });

    const salon = '/api/v1/cookbooks/' + cookbookId + '/messages';
    await request(app)
      .post(salon)
      .set('Authorization', bearer(owner))
      .send({ content: 'Message du createur' });
    await request(app)
      .post(salon)
      .set('Authorization', bearer(membre))
      .send({ content: 'Message du membre' });

    const res = await download(membre);

    expect(res.body.comments).toEqual([
      expect.objectContaining({ content: 'Propos du membre', cookbook: 'Cuisine partagée' }),
    ]);
    expect(res.body.messages).toEqual([
      expect.objectContaining({ content: 'Message du membre', cookbook: 'Cuisine partagée' }),
    ]);

    const brut = JSON.stringify(res.body);
    expect(brut).not.toContain('Propos du createur');
    expect(brut).not.toContain('Message du createur');
    expect(brut).not.toContain('pd6-owner@test.fr');
  });

  it('donne son adhésion à un cookbook, pas la liste de ses membres', async () => {
    const owner = await registerUser('pd7-owner@test.fr');
    const membre = await registerUser('pd7@test.fr');
    const cookbookId = await createCookbook(owner, 'Le club');
    await invite(owner, membre, cookbookId, 'pd7@test.fr', 'EDITOR');

    const res = await download(membre);

    expect(res.body.cookbookMemberships).toEqual([
      expect.objectContaining({ cookbook: 'Le club', role: 'EDITOR' }),
    ]);
    expect(JSON.stringify(res.body)).not.toContain('pd7-owner@test.fr');
  });

  it('ne mélange pas les données de deux comptes', async () => {
    const premier = await registerUser('pd8-a@test.fr');
    const second = await registerUser('pd8-b@test.fr');
    await createRecipe(premier, 'Recette du premier');
    await createRecipe(second, 'Recette du second');

    const res = await download(second);

    expect(res.body.recipes.items.map((item: { title: string }) => item.title)).toEqual([
      'Recette du second',
    ]);
  });

  it('reste lisible sur un compte neuf : des sections vides, pas d erreur', async () => {
    const token = await registerUser('pd9@test.fr');

    const res = await download(token);

    expect(res.status).toBe(200);
    expect(res.body.recipes.items).toEqual([]);
    expect(res.body.favorites).toEqual([]);
    expect(res.body.reviews).toEqual([]);
    expect(res.body.comments).toEqual([]);
    expect(res.body.messages).toEqual([]);
    expect(res.body.mealPlan).toEqual([]);
    expect(res.body.shoppingLists).toEqual([]);
    expect(res.body.cookbookMemberships).toEqual([]);
    expect(res.body.oauthAccounts).toEqual([]);
  });
});

describe('Cloisonnement avec l export de contenu', () => {
  it('les recettes complètes restent du ressort de /export', async () => {
    const token = await registerUser('pd11@test.fr');
    await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', bearer(token))
      .send({ title: 'Gratin', steps: ['Enfourner'] });

    const personnel = await download(token);
    const contenu = await request(app)
      .get('/api/v1/export')
      .set('Authorization', bearer(token));

    expect(personnel.body.recipes.items[0]).not.toHaveProperty('steps');
    expect(contenu.body.recipes[0].steps).toEqual(['Enfourner']);
    // Et réciproquement : l'export de contenu ignore la personne.
    expect(contenu.body).not.toHaveProperty('profile');
    expect(contenu.body).not.toHaveProperty('preferences');
  });

  it('les identifiants de recettes se recoupent entre les deux fichiers', async () => {
    const token = await registerUser('pd12@test.fr');
    await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', bearer(token))
      .send({ title: 'Curry' });

    const personnel = await download(token);
    const enBase = await Recipe.findOne({ where: { title: 'Curry' } });

    expect(personnel.body.recipes.items[0].id).toBe(enBase!.id);
  });
});
