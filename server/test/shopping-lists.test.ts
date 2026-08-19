import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();
const base = '/api/v1/shopping-lists';

const bearer = (token: string) => 'Bearer ' + token;

async function registerUser(email: string): Promise<{ id: string; email: string; token: string }> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'Motdepasse123!', displayName: email.split('@')[0] });
  const me = await request(app)
    .get('/api/v1/auth/me')
    .set('Authorization', bearer(res.body.accessToken));
  return { id: me.body.id, email, token: res.body.accessToken };
}

/** Date décalée, au format attendu par le planning. */
function isoDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const LUNDI = isoDate(1);
const MARDI = isoDate(2);
const DIMANCHE = isoDate(7);

async function createRecipe(
  token: string,
  body: Record<string, unknown>,
): Promise<string> {
  const res = await request(app)
    .post('/api/v1/recipes')
    .set('Authorization', bearer(token))
    .send(body);
  expect(res.status).toBe(201);
  return res.body.id;
}

async function planMeal(
  token: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await request(app)
    .post('/api/v1/meal-plan')
    .set('Authorization', bearer(token))
    .send(body);
  expect(res.status).toBe(201);
}

function generate(token: string, body: Record<string, unknown>) {
  return request(app).post(base).set('Authorization', bearer(token)).send(body);
}

/** Lignes rendues sous forme comparable, triées par nom d'ingrédient. */
function lines(list: { items: { ingredient: { name: string }; quantity: number | null; unit: string | null }[] }) {
  return list.items.map((item) => ({
    name: item.ingredient.name,
    quantity: item.quantity,
    unit: item.unit,
  }));
}

async function inviteAs(ownerToken: string, cookbookId: string, guest: { email: string; token: string }, role: string) {
  const invitation = await request(app)
    .post('/api/v1/cookbooks/' + cookbookId + '/invitations')
    .set('Authorization', bearer(ownerToken))
    .send({ email: guest.email, role });
  await request(app)
    .post('/api/v1/invitations/' + invitation.body.token + '/accept')
    .set('Authorization', bearer(guest.token));
}

describe('Génération depuis le planning', () => {
  it('exige une authentification', async () => {
    const res = await request(app).get(base);
    expect(res.status).toBe(401);
  });

  it('agrège les ingrédients des repas de la période', async () => {
    const user = await registerUser('sl1@test.fr');
    const tarte = await createRecipe(user.token, {
      title: 'Tarte',
      ingredients: [
        { name: 'farine', quantity: 200, unit: 'g' },
        { name: 'pommes', quantity: 4 },
        { name: 'sel' },
      ],
    });
    const gateau = await createRecipe(user.token, {
      title: 'Gâteau',
      ingredients: [
        { name: 'farine', quantity: 300, unit: 'g' },
        { name: 'sucre', quantity: 100, unit: 'g' },
      ],
    });

    await planMeal(user.token, { recipeId: tarte, date: LUNDI, mealType: 'dîner' });
    await planMeal(user.token, { recipeId: gateau, date: MARDI, mealType: 'déjeuner' });

    const res = await generate(user.token, { fromDate: LUNDI, toDate: MARDI });
    expect(res.status).toBe(201);
    expect(res.body.fromDate).toBe(LUNDI);
    expect(res.body.cookbookId).toBeNull();
    expect(res.body.name).toContain(LUNDI);

    expect(lines(res.body)).toEqual([
      { name: 'farine', quantity: 500, unit: 'g' },
      { name: 'pommes', quantity: 4, unit: null },
      { name: 'sel', quantity: null, unit: null },
      { name: 'sucre', quantity: 100, unit: 'g' },
    ]);
  });

  it('met les quantités à l échelle des portions prévues', async () => {
    const user = await registerUser('sl2@test.fr');
    const recette = await createRecipe(user.token, {
      title: 'Gratin',
      servings: 4,
      ingredients: [{ name: 'pommes de terre', quantity: 800, unit: 'g' }],
    });
    // 8 parts prévues d'une recette qui en donne 4.
    await planMeal(user.token, { recipeId: recette, date: LUNDI, mealType: 'dîner', servings: 8 });

    const res = await generate(user.token, { fromDate: LUNDI, toDate: LUNDI });
    expect(lines(res.body)).toEqual([
      { name: 'pommes de terre', quantity: 1600, unit: 'g' },
    ]);
  });

  it('ne retient que les repas de la fenêtre demandée', async () => {
    const user = await registerUser('sl3@test.fr');
    const dedans = await createRecipe(user.token, {
      title: 'Dans la fenêtre',
      ingredients: [{ name: 'riz', quantity: 200, unit: 'g' }],
    });
    const dehors = await createRecipe(user.token, {
      title: 'Hors fenêtre',
      ingredients: [{ name: 'quinoa', quantity: 200, unit: 'g' }],
    });
    await planMeal(user.token, { recipeId: dedans, date: LUNDI, mealType: 'dîner' });
    await planMeal(user.token, { recipeId: dehors, date: DIMANCHE, mealType: 'dîner' });

    const res = await generate(user.token, { fromDate: LUNDI, toDate: MARDI });
    expect(lines(res.body).map((line) => line.name)).toEqual(['riz']);
  });

  it('refuse une période sans aucun repas planifié', async () => {
    const user = await registerUser('sl4@test.fr');
    const res = await generate(user.token, { fromDate: LUNDI, toDate: MARDI });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('EMPTY_MEAL_PLAN');
  });

  it('refuse une fenêtre inversée', async () => {
    const user = await registerUser('sl5@test.fr');
    const res = await generate(user.token, { fromDate: DIMANCHE, toDate: LUNDI });
    expect(res.status).toBe(400);
  });

  it('accepte un intitulé choisi', async () => {
    const user = await registerUser('sl6@test.fr');
    const recette = await createRecipe(user.token, {
      title: 'Soupe',
      ingredients: [{ name: 'carottes', quantity: 3 }],
    });
    await planMeal(user.token, { recipeId: recette, date: LUNDI, mealType: 'dîner' });

    const res = await generate(user.token, {
      name: 'Courses de la semaine',
      fromDate: LUNDI,
      toDate: MARDI,
    });
    expect(res.body.name).toBe('Courses de la semaine');
  });

  it('reste un instantané : modifier la recette ensuite ne réécrit pas la liste', async () => {
    const user = await registerUser('sl7@test.fr');
    const recette = await createRecipe(user.token, {
      title: 'Pâtes',
      ingredients: [{ name: 'pâtes', quantity: 200, unit: 'g' }],
    });
    await planMeal(user.token, { recipeId: recette, date: LUNDI, mealType: 'dîner' });
    const liste = await generate(user.token, { fromDate: LUNDI, toDate: LUNDI });

    await request(app)
      .patch('/api/v1/recipes/' + recette)
      .set('Authorization', bearer(user.token))
      .send({ ingredients: [{ name: 'pâtes', quantity: 900, unit: 'g' }] });

    const relue = await request(app)
      .get(base + '/' + liste.body.id)
      .set('Authorization', bearer(user.token));
    expect(lines(relue.body)).toEqual([{ name: 'pâtes', quantity: 200, unit: 'g' }]);
  });
});

describe('Consultation et suppression', () => {
  it('ne rend que ses propres listes personnelles', async () => {
    const user = await registerUser('sl8@test.fr');
    const recette = await createRecipe(user.token, {
      title: 'Omelette',
      ingredients: [{ name: 'oeufs', quantity: 3 }],
    });
    await planMeal(user.token, { recipeId: recette, date: LUNDI, mealType: 'dîner' });
    const liste = await generate(user.token, { fromDate: LUNDI, toDate: LUNDI });

    const mienne = await request(app).get(base).set('Authorization', bearer(user.token));
    expect(mienne.body).toHaveLength(1);

    const intrus = await registerUser('sl9@test.fr');
    const sienne = await request(app).get(base).set('Authorization', bearer(intrus.token));
    expect(sienne.body).toEqual([]);

    const detail = await request(app)
      .get(base + '/' + liste.body.id)
      .set('Authorization', bearer(intrus.token));
    expect(detail.status).toBe(404);
  });

  it('supprime une liste personnelle', async () => {
    const user = await registerUser('sl10@test.fr');
    const recette = await createRecipe(user.token, {
      title: 'Salade',
      ingredients: [{ name: 'laitue', quantity: 1 }],
    });
    await planMeal(user.token, { recipeId: recette, date: LUNDI, mealType: 'déjeuner' });
    const liste = await generate(user.token, { fromDate: LUNDI, toDate: LUNDI });

    const supprimee = await request(app)
      .delete(base + '/' + liste.body.id)
      .set('Authorization', bearer(user.token));
    expect(supprimee.status).toBe(204);

    const relue = await request(app)
      .get(base + '/' + liste.body.id)
      .set('Authorization', bearer(user.token));
    expect(relue.status).toBe(404);
  });
});

describe('Cocher les lignes', () => {
  async function listeAvecUneLigne(email: string) {
    const user = await registerUser(email);
    const recette = await createRecipe(user.token, {
      title: 'Riz au lait',
      ingredients: [{ name: 'riz rond', quantity: 150, unit: 'g' }],
    });
    await planMeal(user.token, { recipeId: recette, date: LUNDI, mealType: 'collation' });
    const liste = await generate(user.token, { fromDate: LUNDI, toDate: LUNDI });
    return { user, liste: liste.body };
  }

  it('coche puis décoche une ligne', async () => {
    const { user, liste } = await listeAvecUneLigne('sl11@test.fr');
    const itemId = liste.items[0].id;

    const cochee = await request(app)
      .patch(base + '/' + liste.id + '/items/' + itemId)
      .set('Authorization', bearer(user.token))
      .send({ checked: true });
    expect(cochee.status).toBe(200);
    // Seule la ligne est rendue, pas la liste entière.
    expect(cochee.body).toMatchObject({ id: itemId, checked: true });
    expect(cochee.body.ingredient.name).toBe('riz rond');

    const decochee = await request(app)
      .patch(base + '/' + liste.id + '/items/' + itemId)
      .set('Authorization', bearer(user.token))
      .send({ checked: false });
    expect(decochee.body.checked).toBe(false);
  });

  it('corrige la quantité et l unité à la main', async () => {
    const { user, liste } = await listeAvecUneLigne('sl12@test.fr');
    const res = await request(app)
      .patch(base + '/' + liste.id + '/items/' + liste.items[0].id)
      .set('Authorization', bearer(user.token))
      .send({ quantity: 500, unit: 'g' });
    expect(res.body.quantity).toBe(500);
  });

  it('refuse un corps vide et une ligne d une autre liste', async () => {
    const { user, liste } = await listeAvecUneLigne('sl13@test.fr');

    const vide = await request(app)
      .patch(base + '/' + liste.id + '/items/' + liste.items[0].id)
      .set('Authorization', bearer(user.token))
      .send({});
    expect(vide.status).toBe(400);

    const inconnue = await request(app)
      .patch(base + '/' + liste.id + '/items/' + liste.id)
      .set('Authorization', bearer(user.token))
      .send({ checked: true });
    expect(inconnue.status).toBe(404);
  });
});

describe('Listes de groupe', () => {
  /** Cookbook avec une recette planifiée, prêt à produire une liste. */
  async function cookbookPlanifie(prefix: string) {
    const owner = await registerUser(prefix + '-owner@test.fr');
    const cookbook = await request(app)
      .post('/api/v1/cookbooks')
      .set('Authorization', bearer(owner.token))
      .send({ name: 'Famille' });

    const recette = await createRecipe(owner.token, {
      title: 'Couscous',
      ingredients: [{ name: 'semoule', quantity: 500, unit: 'g' }],
    });
    await request(app)
      .put('/api/v1/cookbooks/' + cookbook.body.id + '/recipes/' + recette)
      .set('Authorization', bearer(owner.token));
    await planMeal(owner.token, {
      recipeId: recette,
      cookbookId: cookbook.body.id,
      date: LUNDI,
      mealType: 'dîner',
    });
    return { owner, cookbookId: cookbook.body.id };
  }

  it('génère depuis le planning du groupe et la partage avec ses membres', async () => {
    const { owner, cookbookId } = await cookbookPlanifie('grp1');
    const lecteur = await registerUser('grp1-lecteur@test.fr');
    await inviteAs(owner.token, cookbookId, lecteur, 'READER');

    const res = await generate(owner.token, { fromDate: LUNDI, toDate: LUNDI, cookbookId });
    expect(res.status).toBe(201);
    expect(res.body.cookbookId).toBe(cookbookId);
    expect(lines(res.body)).toEqual([{ name: 'semoule', quantity: 500, unit: 'g' }]);

    // Le lecteur voit la liste du groupe sans l'avoir générée.
    const chezLeLecteur = await request(app).get(base).set('Authorization', bearer(lecteur.token));
    expect(chezLeLecteur.body).toHaveLength(1);
    expect(chezLeLecteur.body[0].id).toBe(res.body.id);
  });

  it('réserve la génération à l éditeur', async () => {
    const { owner, cookbookId } = await cookbookPlanifie('grp2');
    const lecteur = await registerUser('grp2-lecteur@test.fr');
    await inviteAs(owner.token, cookbookId, lecteur, 'READER');

    const res = await generate(lecteur.token, { fromDate: LUNDI, toDate: LUNDI, cookbookId });
    expect(res.status).toBe(403);
  });

  it('réserve la modification des lignes à l éditeur', async () => {
    const { owner, cookbookId } = await cookbookPlanifie('grp3');
    const lecteur = await registerUser('grp3-lecteur@test.fr');
    const editeur = await registerUser('grp3-editeur@test.fr');
    await inviteAs(owner.token, cookbookId, lecteur, 'READER');
    await inviteAs(owner.token, cookbookId, editeur, 'EDITOR');

    const liste = await generate(owner.token, { fromDate: LUNDI, toDate: LUNDI, cookbookId });
    const itemId = liste.body.items[0].id;
    const url = base + '/' + liste.body.id + '/items/' + itemId;

    const parLeLecteur = await request(app)
      .patch(url)
      .set('Authorization', bearer(lecteur.token))
      .send({ checked: true });
    expect(parLeLecteur.status).toBe(403);

    const parLEditeur = await request(app)
      .patch(url)
      .set('Authorization', bearer(editeur.token))
      .send({ checked: true });
    expect(parLEditeur.status).toBe(200);
  });

  it('reste invisible à un non-membre', async () => {
    const { owner, cookbookId } = await cookbookPlanifie('grp4');
    const liste = await generate(owner.token, { fromDate: LUNDI, toDate: LUNDI, cookbookId });

    const intrus = await registerUser('grp4-intrus@test.fr');
    const listes = await request(app).get(base).set('Authorization', bearer(intrus.token));
    expect(listes.body).toEqual([]);

    const detail = await request(app)
      .get(base + '/' + liste.body.id)
      .set('Authorization', bearer(intrus.token));
    expect(detail.status).toBe(404);
  });
});
