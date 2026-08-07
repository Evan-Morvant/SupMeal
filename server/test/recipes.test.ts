import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Ingredient, Recipe, RecipeIngredient, RecipeStep, Tag } from '../src/models';

const app = createApp();
const base = '/api/v1/recipes';

/** Inscrit un utilisateur et renvoie son access token. */
async function registerUser(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'motdepasse123', displayName: email.split('@')[0] });
  return res.body.accessToken;
}

const bearer = (token: string) => 'Bearer ' + token;

const tarte = {
  title: 'Tarte aux pommes',
  description: 'Le classique',
  prepTimeMin: 30,
  cookTimeMin: 45,
  servings: 6,
  ingredients: [
    { name: 'Pomme', quantity: 6, unit: 'piece' },
    { name: 'Sucre', quantity: 100, unit: 'g', note: 'pour la pate' },
    { name: 'Sucre', quantity: 50, unit: 'g', note: 'pour le nappage' },
    { name: 'Sel' },
  ],
  steps: ['Eplucher les pommes', 'Etaler la pate', 'Enfourner 45 minutes'],
  tags: ['dessert', 'facile'],
};

function createTarte(token: string) {
  return request(app).post(base).set('Authorization', bearer(token)).send(tarte);
}

describe('Création de recette', () => {
  it('crée la recette avec son contenu structuré -> 201', async () => {
    const token = await registerUser('chef@test.fr');
    const res = await createTarte(token);

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Tarte aux pommes');
    expect(res.body.visibility).toBe('private');
    expect(res.body.ingredients).toHaveLength(4);
    expect(res.body.steps).toHaveLength(3);
    expect(res.body.tags).toHaveLength(2);
  });

  it('conserve l ordre des étapes et des ingrédients', async () => {
    const token = await registerUser('ordre@test.fr');
    const res = await createTarte(token);

    expect(res.body.steps.map((s: { instruction: string }) => s.instruction)).toEqual([
      'Eplucher les pommes',
      'Etaler la pate',
      'Enfourner 45 minutes',
    ]);
    expect(res.body.steps.map((s: { position: number }) => s.position)).toEqual([0, 1, 2]);
    expect(res.body.ingredients[0].name).toBe('pomme');
  });

  it('accepte un ingrédient sans quantité', async () => {
    const token = await registerUser('sel@test.fr');
    const res = await createTarte(token);

    const sel = res.body.ingredients.find((i: { name: string }) => i.name === 'sel');
    expect(sel.quantity).toBeNull();
    expect(sel.unit).toBeNull();
  });

  it('renvoie la quantité en nombre, pas en chaîne', async () => {
    const token = await registerUser('nombre@test.fr');
    const res = await createTarte(token);

    const pomme = res.body.ingredients.find((i: { name: string }) => i.name === 'pomme');
    expect(pomme.quantity).toBe(6);
  });

  it('garde deux lignes pour un même ingrédient utilisé deux fois', async () => {
    const token = await registerUser('double@test.fr');
    const res = await createTarte(token);

    const sucres = res.body.ingredients.filter((i: { name: string }) => i.name === 'sucre');
    expect(sucres).toHaveLength(2);
    expect(sucres.map((s: { note: string }) => s.note)).toEqual([
      'pour la pate',
      'pour le nappage',
    ]);
    expect(await Ingredient.count({ where: { name: 'sucre' } })).toBe(1);
  });

  it('mutualise les ingrédients entre recettes malgré la casse', async () => {
    const token = await registerUser('mutualise@test.fr');
    await createTarte(token);
    await request(app)
      .post(base)
      .set('Authorization', bearer(token))
      .send({ title: 'Compote', ingredients: [{ name: '  POMME ', quantity: 4 }] });

    expect(await Ingredient.count({ where: { name: 'pomme' } })).toBe(1);
  });

  it('réutilise un tag de référence au lieu d en créer un doublon', async () => {
    const token = await registerUser('tag@test.fr');
    const res = await createTarte(token);

    const dessert = res.body.tags.find((t: { name: string }) => t.name === 'Dessert');
    expect(dessert.type).toBe('course');
    expect(await Tag.count({ where: { name: 'dessert' } })).toBe(0);
  });

  it('sans titre -> 400', async () => {
    const token = await registerUser('sanstitre@test.fr');
    const res = await request(app)
      .post(base)
      .set('Authorization', bearer(token))
      .send({ description: 'orpheline' });
    expect(res.status).toBe(400);
  });

  it('sans token -> 401', async () => {
    const res = await request(app).post(base).send(tarte);
    expect(res.status).toBe(401);
  });
});

describe('Consultation', () => {
  it('le créateur accède au détail complet', async () => {
    const token = await registerUser('lecture@test.fr');
    const created = await createTarte(token);

    const res = await request(app)
      .get(base + '/' + created.body.id)
      .set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.ingredients).toHaveLength(4);
  });

  it('recette privée d un autre utilisateur -> 403', async () => {
    const proprietaire = await registerUser('prive@test.fr');
    const intrus = await registerUser('intrus@test.fr');
    const created = await createTarte(proprietaire);

    const res = await request(app)
      .get(base + '/' + created.body.id)
      .set('Authorization', bearer(intrus));
    expect(res.status).toBe(403);
  });

  it('recette publique d un autre utilisateur -> 200', async () => {
    const proprietaire = await registerUser('public@test.fr');
    const autre = await registerUser('curieux@test.fr');
    const created = await request(app)
      .post(base)
      .set('Authorization', bearer(proprietaire))
      .send({ ...tarte, visibility: 'public' });

    const res = await request(app)
      .get(base + '/' + created.body.id)
      .set('Authorization', bearer(autre));
    expect(res.status).toBe(200);
  });

  it('identifiant inconnu -> 404', async () => {
    const token = await registerUser('introuvable@test.fr');
    const res = await request(app)
      .get(base + '/e5b3c7de-0000-4000-8000-000000000000')
      .set('Authorization', bearer(token));
    expect(res.status).toBe(404);
  });
});

describe('Modification', () => {
  it('un champ simple seul laisse les collections intactes', async () => {
    const token = await registerUser('patch@test.fr');
    const created = await createTarte(token);

    const res = await request(app)
      .patch(base + '/' + created.body.id)
      .set('Authorization', bearer(token))
      .send({ title: 'Tarte aux poires' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Tarte aux poires');
    expect(res.body.ingredients).toHaveLength(4);
    expect(res.body.steps).toHaveLength(3);
    expect(res.body.tags).toHaveLength(2);
  });

  it('une collection présente remplace intégralement l ancienne', async () => {
    const token = await registerUser('remplace@test.fr');
    const created = await createTarte(token);

    const res = await request(app)
      .patch(base + '/' + created.body.id)
      .set('Authorization', bearer(token))
      .send({ ingredients: [{ name: 'Poire', quantity: 4, unit: 'piece' }] });

    expect(res.body.ingredients).toHaveLength(1);
    expect(res.body.ingredients[0].name).toBe('poire');
    // Les étapes, absentes du corps, sont conservées.
    expect(res.body.steps).toHaveLength(3);
    expect(await RecipeIngredient.count({ where: { recipeId: created.body.id } })).toBe(1);
  });

  it('une collection vide efface la collection', async () => {
    const token = await registerUser('vide@test.fr');
    const created = await createTarte(token);

    const res = await request(app)
      .patch(base + '/' + created.body.id)
      .set('Authorization', bearer(token))
      .send({ steps: [] });

    expect(res.body.steps).toHaveLength(0);
    expect(await RecipeStep.count({ where: { recipeId: created.body.id } })).toBe(0);
  });

  it('corps vide -> 400', async () => {
    const token = await registerUser('vide2@test.fr');
    const created = await createTarte(token);

    const res = await request(app)
      .patch(base + '/' + created.body.id)
      .set('Authorization', bearer(token))
      .send({});
    expect(res.status).toBe(400);
  });

  it('modification par un autre utilisateur -> 403', async () => {
    const proprietaire = await registerUser('proprio@test.fr');
    const intrus = await registerUser('vilain@test.fr');
    const created = await createTarte(proprietaire);

    const res = await request(app)
      .patch(base + '/' + created.body.id)
      .set('Authorization', bearer(intrus))
      .send({ title: 'Vole' });
    expect(res.status).toBe(403);
  });

  it('une recette publique reste modifiable par son seul créateur', async () => {
    const proprietaire = await registerUser('ouvert@test.fr');
    const autre = await registerUser('passant@test.fr');
    const created = await request(app)
      .post(base)
      .set('Authorization', bearer(proprietaire))
      .send({ ...tarte, visibility: 'public' });

    const res = await request(app)
      .patch(base + '/' + created.body.id)
      .set('Authorization', bearer(autre))
      .send({ title: 'Detourne' });
    expect(res.status).toBe(403);
  });
});

describe('Suppression', () => {
  it('le créateur supprime sa recette et son contenu', async () => {
    const token = await registerUser('suppr@test.fr');
    const created = await createTarte(token);

    const res = await request(app)
      .delete(base + '/' + created.body.id)
      .set('Authorization', bearer(token));
    expect(res.status).toBe(204);

    expect(await Recipe.count({ where: { id: created.body.id } })).toBe(0);
    expect(await RecipeStep.count({ where: { recipeId: created.body.id } })).toBe(0);
    expect(await RecipeIngredient.count({ where: { recipeId: created.body.id } })).toBe(0);
    // L'ingrédient mutualisé survit à la recette qui l'utilisait.
    expect(await Ingredient.count({ where: { name: 'pomme' } })).toBe(1);
  });

  it('suppression par un autre utilisateur -> 403', async () => {
    const proprietaire = await registerUser('garde@test.fr');
    const intrus = await registerUser('pilleur@test.fr');
    const created = await createTarte(proprietaire);

    const res = await request(app)
      .delete(base + '/' + created.body.id)
      .set('Authorization', bearer(intrus));
    expect(res.status).toBe(403);
    expect(await Recipe.count({ where: { id: created.body.id } })).toBe(1);
  });
});

describe('Liste', () => {
  it('ne renvoie que les recettes du demandeur, sans le détail', async () => {
    const moi = await registerUser('liste@test.fr');
    const autre = await registerUser('voisin@test.fr');
    await createTarte(moi);
    await createTarte(autre);

    const res = await request(app).get(base).set('Authorization', bearer(moi));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].tags).toHaveLength(2);
    expect(res.body.items[0].ingredients).toBeUndefined();
  });

  it('pagine et compte le total', async () => {
    const token = await registerUser('page@test.fr');
    await createTarte(token);
    await createTarte(token);
    await createTarte(token);

    const res = await request(app)
      .get(base + '?page=2&pageSize=2')
      .set('Authorization', bearer(token));
    expect(res.body.total).toBe(3);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.page).toBe(2);
  });

  it('taille de page hors bornes -> 400', async () => {
    const token = await registerUser('bornes@test.fr');
    const res = await request(app)
      .get(base + '?pageSize=500')
      .set('Authorization', bearer(token));
    expect(res.status).toBe(400);
  });
});
