import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Cookbook, CookbookMembership, CookbookRecipe, Favorite, User } from '../src/models';

const app = createApp();
const base = '/api/v1/recipes';

async function registerUser(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'motdepasse123', displayName: email.split('@')[0] });
  return res.body.accessToken;
}

const bearer = (token: string) => 'Bearer ' + token;

interface RecipePayload {
  title: string;
  description?: string;
  prepTimeMin?: number;
  cookTimeMin?: number;
  ingredients?: { name: string; quantity?: number }[];
  tags?: string[];
}

async function createRecipe(token: string, payload: RecipePayload): Promise<string> {
  const res = await request(app).post(base).set('Authorization', bearer(token)).send(payload);
  return res.body.id;
}

/** Jeu d'essai commun : trois recettes bien différenciées. */
async function seedRecipes(token: string) {
  const tarte = await createRecipe(token, {
    title: 'Tarte aux pommes',
    description: 'Dessert classique au four',
    prepTimeMin: 30,
    cookTimeMin: 45,
    ingredients: [{ name: 'Pomme', quantity: 6 }, { name: 'Sucre', quantity: 100 }],
    tags: ['dessert', 'facile'],
  });
  const salade = await createRecipe(token, {
    title: 'Salade de tomates',
    description: 'Entrée fraîche et rapide',
    prepTimeMin: 10,
    cookTimeMin: 0,
    ingredients: [{ name: 'Tomate', quantity: 3 }, { name: 'Basilic' }],
    tags: ['facile'],
  });
  const soupe = await createRecipe(token, {
    title: 'Soupe de tomates au basilic',
    description: 'Reconfortante',
    prepTimeMin: 15,
    cookTimeMin: 30,
    ingredients: [{ name: 'Tomate', quantity: 8 }, { name: 'Basilic' }, { name: 'Creme' }],
    tags: ['plat principal'],
  });
  return { tarte, salade, soupe };
}

const titles = (res: request.Response) =>
  res.body.items.map((item: { title: string }) => item.title);

function search(token: string, queryString: string) {
  return request(app)
    .get(base + queryString)
    .set('Authorization', bearer(token));
}

describe('Recherche plein texte', () => {
  it('trouve par un mot du titre', async () => {
    const token = await registerUser('ft1@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?q=tomates');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(titles(res).sort()).toEqual(['Salade de tomates', 'Soupe de tomates au basilic']);
  });

  it('trouve par un mot de la description', async () => {
    const token = await registerUser('ft2@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?q=fraîche');
    expect(titles(res)).toEqual(['Salade de tomates']);
  });

  it('trouve par un nom d ingrédient absent du titre', async () => {
    const token = await registerUser('ft3@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?q=creme');
    expect(titles(res)).toEqual(['Soupe de tomates au basilic']);
  });

  it('ignore la casse et les accents du français', async () => {
    const token = await registerUser('ft4@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?q=POMMES');
    expect(titles(res)).toEqual(['Tarte aux pommes']);
  });

  it('classe par pertinence : le titre pèse plus que les ingrédients', async () => {
    const token = await registerUser('ft5@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?q=basilic');
    expect(res.body.total).toBe(2);
    expect(titles(res)[0]).toBe('Soupe de tomates au basilic');
  });

  it('aucun résultat -> liste vide et total à zéro', async () => {
    const token = await registerUser('ft6@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?q=cassoulet');
    expect(res.body.total).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  it('une apostrophe dans la recherche ne casse pas la requête', async () => {
    const token = await registerUser('ft7@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?q=' + encodeURIComponent("d'agneau' OR 1=1 --"));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });
});

describe('Filtres', () => {
  it('par tag', async () => {
    const token = await registerUser('f1@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?tags=facile');
    expect(res.body.total).toBe(2);
  });

  it('par tag, insensible à la casse', async () => {
    const token = await registerUser('f2@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?tags=DESSERT');
    expect(titles(res)).toEqual(['Tarte aux pommes']);
  });

  it('plusieurs tags se cumulent (ET, pas OU)', async () => {
    const token = await registerUser('f3@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?tags=dessert,facile');
    expect(titles(res)).toEqual(['Tarte aux pommes']);
  });

  it('par ingrédient', async () => {
    const token = await registerUser('f4@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?ingredients=tomate');
    expect(res.body.total).toBe(2);
  });

  it('plusieurs ingrédients se cumulent (ET)', async () => {
    const token = await registerUser('f5@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?ingredients=tomate,creme');
    expect(titles(res)).toEqual(['Soupe de tomates au basilic']);
  });

  it('par temps de préparation maximal', async () => {
    const token = await registerUser('f6@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?maxPrep=15');
    expect(res.body.total).toBe(2);
  });

  it('par temps de cuisson maximal', async () => {
    const token = await registerUser('f7@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?maxCook=30');
    expect(res.body.total).toBe(2);
  });

  it('une recette sans temps renseigné est exclue du filtre de temps', async () => {
    const token = await registerUser('f8@test.fr');
    await createRecipe(token, { title: 'Sans temps' });

    const res = await search(token, '?maxPrep=1000');
    expect(res.body.total).toBe(0);
  });

  it('les filtres se combinent entre eux', async () => {
    const token = await registerUser('f9@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?q=tomates&maxPrep=10&tags=facile');
    expect(titles(res)).toEqual(['Salade de tomates']);
  });

  it('par favoris', async () => {
    const token = await registerUser('f10@test.fr');
    const { salade } = await seedRecipes(token);
    const user = await User.findOne({ where: { email: 'f10@test.fr' } });
    await Favorite.create({ userId: user!.id, recipeId: salade });

    const res = await search(token, '?favorite=true');
    expect(titles(res)).toEqual(['Salade de tomates']);
  });

  it('favorite=false ne filtre pas', async () => {
    const token = await registerUser('f11@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?favorite=false');
    expect(res.body.total).toBe(3);
  });

  it('valeur de tri inconnue -> 400', async () => {
    const token = await registerUser('f12@test.fr');
    const res = await search(token, '?sort=nimportequoi');
    expect(res.status).toBe(400);
  });

  it('cookbookId mal formé -> 400', async () => {
    const token = await registerUser('f13@test.fr');
    const res = await search(token, '?cookbookId=pas-un-uuid');
    expect(res.status).toBe(400);
  });
});

describe('Tri', () => {
  it('par défaut, les plus récentes d abord', async () => {
    const token = await registerUser('t1@test.fr');
    await seedRecipes(token);

    const res = await search(token, '');
    expect(titles(res)[0]).toBe('Soupe de tomates au basilic');
  });

  it('par temps de préparation croissant', async () => {
    const token = await registerUser('t2@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?sort=prepTime');
    expect(titles(res)).toEqual([
      'Salade de tomates',
      'Soupe de tomates au basilic',
      'Tarte aux pommes',
    ]);
  });

  it('les recettes sans temps passent en dernier', async () => {
    const token = await registerUser('t3@test.fr');
    await seedRecipes(token);
    await createRecipe(token, { title: 'Sans temps' });

    const res = await search(token, '?sort=prepTime');
    expect(titles(res)[3]).toBe('Sans temps');
  });

  it('le tri survit à la pagination', async () => {
    const token = await registerUser('t4@test.fr');
    await seedRecipes(token);

    const res = await search(token, '?sort=prepTime&page=2&pageSize=1');
    expect(titles(res)).toEqual(['Soupe de tomates au basilic']);
    expect(res.body.total).toBe(3);
  });
});

describe('Périmètre de visibilité', () => {
  it('ne renvoie pas les recettes des autres', async () => {
    const moi = await registerUser('p1@test.fr');
    const autre = await registerUser('p2@test.fr');
    await seedRecipes(autre);
    await createRecipe(moi, { title: 'La mienne' });

    const res = await search(moi, '');
    expect(titles(res)).toEqual(['La mienne']);
  });

  it('inclut les recettes d un cookbook dont on est membre', async () => {
    const proprietaire = await registerUser('p3@test.fr');
    const membre = await registerUser('p4@test.fr');
    const recipeId = await createRecipe(proprietaire, { title: 'Partagee' });

    const owner = await User.findOne({ where: { email: 'p3@test.fr' } });
    const invite = await User.findOne({ where: { email: 'p4@test.fr' } });
    // Le créateur d'un cookbook est son membre OWNER : pas de colonne dédiée.
    const cookbook = await Cookbook.create({ name: 'Famille', description: null });
    await CookbookMembership.create({
      cookbookId: cookbook.id,
      userId: owner!.id,
      role: 'OWNER',
    });
    await CookbookMembership.create({
      cookbookId: cookbook.id,
      userId: invite!.id,
      role: 'READER',
    });
    await CookbookRecipe.create({
      cookbookId: cookbook.id,
      recipeId,
      addedBy: owner!.id,
    });

    const res = await search(membre, '');
    expect(titles(res)).toEqual(['Partagee']);

    // Et le détail suit le même périmètre que la liste.
    const detail = await request(app)
      .get(base + '/' + recipeId)
      .set('Authorization', bearer(membre));
    expect(detail.status).toBe(200);
  });

  it('exclut les recettes d un cookbook dont on n est pas membre', async () => {
    const proprietaire = await registerUser('p5@test.fr');
    const etranger = await registerUser('p6@test.fr');
    const recipeId = await createRecipe(proprietaire, { title: 'Fermee' });

    const owner = await User.findOne({ where: { email: 'p5@test.fr' } });
    const cookbook = await Cookbook.create({ name: 'Prive', description: null });
    await CookbookRecipe.create({ cookbookId: cookbook.id, recipeId, addedBy: owner!.id });

    const res = await search(etranger, '');
    expect(res.body.total).toBe(0);

    const detail = await request(app)
      .get(base + '/' + recipeId)
      .set('Authorization', bearer(etranger));
    expect(detail.status).toBe(403);
  });

  it('filtre par cookbook', async () => {
    const token = await registerUser('p7@test.fr');
    const { tarte } = await seedRecipes(token);
    const user = await User.findOne({ where: { email: 'p7@test.fr' } });
    const cookbook = await Cookbook.create({ name: 'Desserts', description: null });
    await CookbookMembership.create({
      cookbookId: cookbook.id,
      userId: user!.id,
      role: 'OWNER',
    });
    await CookbookRecipe.create({ cookbookId: cookbook.id, recipeId: tarte, addedBy: user!.id });

    const res = await search(token, '?cookbookId=' + cookbook.id);
    expect(titles(res)).toEqual(['Tarte aux pommes']);
  });
});
