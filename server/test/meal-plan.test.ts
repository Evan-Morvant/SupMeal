import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { CookbookMembership, MealPlanEntry, User } from '../src/models';
import type { Role } from '../src/middlewares/require-role';

const app = createApp();
const base = '/api/v1/meal-plan';

async function registerUser(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'motdepasse123', displayName: email.split('@')[0] });
  return res.body.accessToken;
}

const bearer = (token: string) => 'Bearer ' + token;

async function addMember(cookbookId: string, email: string, role: Role): Promise<string> {
  const user = await User.findOne({ where: { email } });
  await CookbookMembership.create({ cookbookId, userId: user!.id, role });
  return user!.id;
}

async function createCookbook(token: string, name = 'Cuisine de famille'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/cookbooks')
    .set('Authorization', bearer(token))
    .send({ name });
  return res.body.id;
}

async function createRecipe(token: string, title = 'Blanquette'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/recipes')
    .set('Authorization', bearer(token))
    .send({ title });
  return res.body.id;
}

function plan(token: string, body: Record<string, unknown>) {
  return request(app).post(base).set('Authorization', bearer(token)).send(body);
}

/** Entrée type : la recette du jour, au déjeuner. */
function lunch(recipeId: string, date = '2026-09-01', extra: Record<string, unknown> = {}) {
  return { recipeId, date, mealType: 'déjeuner', ...extra };
}

describe('Planning personnel', () => {
  it('ajoute une entrée -> 201 avec la recette et son auteur', async () => {
    const token = await registerUser('mp-solo@test.fr');
    const recipeId = await createRecipe(token);

    const res = await plan(token, lunch(recipeId, '2026-09-01', { servings: 4 }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      date: '2026-09-01',
      mealType: 'déjeuner',
      servings: 4,
      cookbookId: null,
    });
    expect(res.body.recipe.title).toBe('Blanquette');
    expect(res.body.author.email).toBe('mp-solo@test.fr');
  });

  it('liste le planning personnel, sans celui des autres', async () => {
    const alice = await registerUser('mp-alice@test.fr');
    const bob = await registerUser('mp-bob@test.fr');
    await plan(alice, lunch(await createRecipe(alice, 'Chez Alice')));
    await plan(bob, lunch(await createRecipe(bob, 'Chez Bob')));

    const res = await request(app).get(base).set('Authorization', bearer(alice));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].recipe.title).toBe('Chez Alice');
  });

  it('rend les entrées dans l ordre des jours puis des repas', async () => {
    const token = await registerUser('mp-order@test.fr');
    const recipeId = await createRecipe(token);
    await plan(token, { recipeId, date: '2026-09-02', mealType: 'déjeuner' });
    await plan(token, { recipeId, date: '2026-09-01', mealType: 'dîner' });
    await plan(token, { recipeId, date: '2026-09-01', mealType: 'petit-déjeuner' });

    const res = await request(app).get(base).set('Authorization', bearer(token));

    expect(res.body.map((e: { date: string; mealType: string }) => e.date + ' ' + e.mealType)).toEqual([
      '2026-09-01 petit-déjeuner',
      '2026-09-01 dîner',
      '2026-09-02 déjeuner',
    ]);
  });

  it('filtre sur la fenêtre demandée, bornes comprises', async () => {
    const token = await registerUser('mp-window@test.fr');
    const recipeId = await createRecipe(token);
    await plan(token, lunch(recipeId, '2026-09-01'));
    await plan(token, lunch(recipeId, '2026-09-05'));
    await plan(token, lunch(recipeId, '2026-09-10'));

    const res = await request(app)
      .get(base + '?from=2026-09-01&to=2026-09-05')
      .set('Authorization', bearer(token));

    expect(res.body.map((e: { date: string }) => e.date)).toEqual(['2026-09-01', '2026-09-05']);
  });

  it('une fenêtre inversée est refusée -> 400', async () => {
    const token = await registerUser('mp-badwindow@test.fr');

    const res = await request(app)
      .get(base + '?from=2026-09-10&to=2026-09-01')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('une date mal formée est refusée -> 400', async () => {
    const token = await registerUser('mp-baddate@test.fr');
    const recipeId = await createRecipe(token);

    const res = await plan(token, { recipeId, date: '01/09/2026', mealType: 'déjeuner' });

    expect(res.status).toBe(400);
  });

  it('un type de repas inconnu est refusé -> 400', async () => {
    const token = await registerUser('mp-badmeal@test.fr');
    const recipeId = await createRecipe(token);

    const res = await plan(token, { recipeId, date: '2026-09-01', mealType: 'brunch' });

    expect(res.status).toBe(400);
  });

  it('sans jeton -> 401', async () => {
    const res = await request(app).get(base);

    expect(res.status).toBe(401);
  });
});

describe('Accès à la recette planifiée', () => {
  it('planifier la recette privée d un tiers est refusé -> 403', async () => {
    const alice = await registerUser('mp-owner@test.fr');
    const bob = await registerUser('mp-intrus@test.fr');
    const recipeId = await createRecipe(alice, 'Secret de famille');

    const res = await plan(bob, lunch(recipeId));

    expect(res.status).toBe(403);
    expect(await MealPlanEntry.count()).toBe(0);
  });

  it('une recette publique se planifie librement -> 201', async () => {
    const alice = await registerUser('mp-public@test.fr');
    const bob = await registerUser('mp-lecteur@test.fr');
    const res = await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', bearer(alice))
      .send({ title: 'Tarte partagée', visibility: 'public' });

    const planned = await plan(bob, lunch(res.body.id));

    expect(planned.status).toBe(201);
  });

  it('une recette inexistante -> 404', async () => {
    const token = await registerUser('mp-noRecipe@test.fr');

    const res = await plan(token, lunch('11111111-1111-1111-1111-111111111111'));

    expect(res.status).toBe(404);
  });
});

describe('Planning de groupe', () => {
  it('un éditeur inscrit un repas au planning du cookbook -> 201', async () => {
    const owner = await registerUser('mp-cb-owner@test.fr');
    const editor = await registerUser('mp-cb-editor@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'mp-cb-editor@test.fr', 'EDITOR');
    const recipeId = await createRecipe(editor);

    const res = await plan(editor, lunch(recipeId, '2026-09-01', { cookbookId }));

    expect(res.status).toBe(201);
    expect(res.body.cookbookId).toBe(cookbookId);
  });

  it('un commentateur ne peut pas planifier pour le groupe -> 403', async () => {
    const owner = await registerUser('mp-cb-owner2@test.fr');
    const commenter = await registerUser('mp-cb-commenter@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'mp-cb-commenter@test.fr', 'COMMENTER');
    const recipeId = await createRecipe(commenter);

    const res = await plan(commenter, lunch(recipeId, '2026-09-01', { cookbookId }));

    expect(res.status).toBe(403);
    expect(await MealPlanEntry.count()).toBe(0);
  });

  it("un non-membre reçoit 404, l'existence du cookbook ne lui est pas confirmée", async () => {
    const owner = await registerUser('mp-cb-owner3@test.fr');
    const stranger = await registerUser('mp-cb-stranger@test.fr');
    const cookbookId = await createCookbook(owner);
    const recipeId = await createRecipe(stranger);

    const res = await plan(stranger, lunch(recipeId, '2026-09-01', { cookbookId }));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COOKBOOK_NOT_FOUND');
  });

  it('tous les membres voient le planning du groupe, y compris un lecteur', async () => {
    const owner = await registerUser('mp-cb-owner4@test.fr');
    const reader = await registerUser('mp-cb-reader@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'mp-cb-reader@test.fr', 'READER');
    const recipeId = await createRecipe(owner);
    await plan(owner, lunch(recipeId, '2026-09-01', { cookbookId }));

    const res = await request(app)
      .get(base + '?cookbookId=' + cookbookId)
      .set('Authorization', bearer(reader));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].author.email).toBe('mp-cb-owner4@test.fr');
  });

  it('le planning de groupe reste distinct du planning personnel', async () => {
    const owner = await registerUser('mp-cb-split@test.fr');
    const cookbookId = await createCookbook(owner);
    const recipeId = await createRecipe(owner);
    await plan(owner, lunch(recipeId, '2026-09-01', { cookbookId }));
    await plan(owner, lunch(recipeId, '2026-09-02'));

    const personnel = await request(app).get(base).set('Authorization', bearer(owner));
    const groupe = await request(app)
      .get(base + '?cookbookId=' + cookbookId)
      .set('Authorization', bearer(owner));

    expect(personnel.body.map((e: { date: string }) => e.date)).toEqual(['2026-09-02']);
    expect(groupe.body.map((e: { date: string }) => e.date)).toEqual(['2026-09-01']);
  });

  it('un non-membre ne peut pas lire le planning du groupe -> 404', async () => {
    const owner = await registerUser('mp-cb-owner5@test.fr');
    const stranger = await registerUser('mp-cb-stranger2@test.fr');
    const cookbookId = await createCookbook(owner);

    const res = await request(app)
      .get(base + '?cookbookId=' + cookbookId)
      .set('Authorization', bearer(stranger));

    expect(res.status).toBe(404);
  });
});

describe('Modification et suppression', () => {
  it('l auteur modifie son entrée -> 200', async () => {
    const token = await registerUser('mp-edit@test.fr');
    const recipeId = await createRecipe(token);
    const created = await plan(token, lunch(recipeId, '2026-09-01', { servings: 2 }));

    const res = await request(app)
      .patch(base + '/' + created.body.id)
      .set('Authorization', bearer(token))
      .send({ date: '2026-09-03', servings: 6 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ date: '2026-09-03', servings: 6, mealType: 'déjeuner' });
  });

  it('un tiers ne voit pas l entrée personnelle d un autre -> 404', async () => {
    const alice = await registerUser('mp-priv-owner@test.fr');
    const bob = await registerUser('mp-priv-intrus@test.fr');
    const recipeId = await createRecipe(alice);
    const created = await plan(alice, lunch(recipeId));

    const res = await request(app)
      .delete(base + '/' + created.body.id)
      .set('Authorization', bearer(bob));

    expect(res.status).toBe(404);
    expect(await MealPlanEntry.count()).toBe(1);
  });

  it('un éditeur du cookbook corrige l entrée d un autre membre -> 200', async () => {
    const owner = await registerUser('mp-cb-e1@test.fr');
    const editor = await registerUser('mp-cb-e2@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'mp-cb-e2@test.fr', 'EDITOR');
    const recipeId = await createRecipe(owner);
    const created = await plan(owner, lunch(recipeId, '2026-09-01', { cookbookId }));

    const res = await request(app)
      .patch(base + '/' + created.body.id)
      .set('Authorization', bearer(editor))
      .send({ mealType: 'dîner' });

    expect(res.status).toBe(200);
    expect(res.body.mealType).toBe('dîner');
  });

  it('un lecteur du cookbook ne peut pas supprimer une entrée du groupe -> 403', async () => {
    const owner = await registerUser('mp-cb-r1@test.fr');
    const reader = await registerUser('mp-cb-r2@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'mp-cb-r2@test.fr', 'READER');
    const recipeId = await createRecipe(owner);
    const created = await plan(owner, lunch(recipeId, '2026-09-01', { cookbookId }));

    const res = await request(app)
      .delete(base + '/' + created.body.id)
      .set('Authorization', bearer(reader));

    expect(res.status).toBe(403);
    expect(await MealPlanEntry.count()).toBe(1);
  });

  it('exclu du cookbook, l auteur ne touche plus à son entrée de groupe -> 404', async () => {
    const owner = await registerUser('mp-kick-owner@test.fr');
    const editor = await registerUser('mp-kick-editor@test.fr');
    const cookbookId = await createCookbook(owner);
    const editorId = await addMember(cookbookId, 'mp-kick-editor@test.fr', 'EDITOR');
    const recipeId = await createRecipe(editor);
    const created = await plan(editor, lunch(recipeId, '2026-09-01', { cookbookId }));

    await CookbookMembership.destroy({ where: { cookbookId, userId: editorId } });
    const res = await request(app)
      .delete(base + '/' + created.body.id)
      .set('Authorization', bearer(editor));

    expect(res.status).toBe(404);
    expect(await MealPlanEntry.count()).toBe(1);
  });

  it('rétrogradé en lecteur, l auteur garde la main sur sa propre entrée -> 200', async () => {
    const owner = await registerUser('mp-demote-owner@test.fr');
    const editor = await registerUser('mp-demote-editor@test.fr');
    const cookbookId = await createCookbook(owner);
    const editorId = await addMember(cookbookId, 'mp-demote-editor@test.fr', 'EDITOR');
    const recipeId = await createRecipe(editor);
    const created = await plan(editor, lunch(recipeId, '2026-09-01', { cookbookId }));

    await CookbookMembership.update(
      { role: 'READER' },
      { where: { cookbookId, userId: editorId } },
    );
    const res = await request(app)
      .patch(base + '/' + created.body.id)
      .set('Authorization', bearer(editor))
      .send({ mealType: 'dîner' });

    expect(res.status).toBe(200);
    expect(res.body.mealType).toBe('dîner');
  });

  it('déplacer une entrée vers un cookbook est refusé -> 400', async () => {
    const owner = await registerUser('mp-move@test.fr');
    const cookbookId = await createCookbook(owner);
    const recipeId = await createRecipe(owner);
    const created = await plan(owner, lunch(recipeId));

    const res = await request(app)
      .patch(base + '/' + created.body.id)
      .set('Authorization', bearer(owner))
      .send({ cookbookId });

    expect(res.status).toBe(400);
    const entry = await MealPlanEntry.findByPk(created.body.id);
    expect(entry!.cookbookId).toBeNull();
  });

  it('substituer une recette inaccessible est refusé -> 403', async () => {
    const alice = await registerUser('mp-sub-alice@test.fr');
    const bob = await registerUser('mp-sub-bob@test.fr');
    const sien = await createRecipe(bob, 'La sienne');
    const secret = await createRecipe(alice, 'Secret');
    const created = await plan(bob, lunch(sien));

    const res = await request(app)
      .patch(base + '/' + created.body.id)
      .set('Authorization', bearer(bob))
      .send({ recipeId: secret });

    expect(res.status).toBe(403);
    const entry = await MealPlanEntry.findByPk(created.body.id);
    expect(entry!.recipeId).toBe(sien);
  });

  it('une modification vide est refusée -> 400', async () => {
    const token = await registerUser('mp-empty@test.fr');
    const recipeId = await createRecipe(token);
    const created = await plan(token, lunch(recipeId));

    const res = await request(app)
      .patch(base + '/' + created.body.id)
      .set('Authorization', bearer(token))
      .send({});

    expect(res.status).toBe(400);
  });

  it('l auteur supprime son entrée -> 204', async () => {
    const token = await registerUser('mp-del@test.fr');
    const recipeId = await createRecipe(token);
    const created = await plan(token, lunch(recipeId));

    const res = await request(app)
      .delete(base + '/' + created.body.id)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(204);
    expect(await MealPlanEntry.count()).toBe(0);
  });

  it('un identifiant d entrée mal formé -> 400', async () => {
    const token = await registerUser('mp-badid@test.fr');

    const res = await request(app)
      .delete(base + '/pas-un-uuid')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(400);
  });
});
