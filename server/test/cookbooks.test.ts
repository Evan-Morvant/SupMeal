import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { CookbookMembership, CookbookRecipe, User } from '../src/models';
import type { Role } from '../src/middlewares/require-role';

const app = createApp();
const base = '/api/v1/cookbooks';

async function registerUser(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'motdepasse123', displayName: email.split('@')[0] });
  return res.body.accessToken;
}

const bearer = (token: string) => 'Bearer ' + token;

async function createCookbook(token: string, name = 'Cuisine de famille'): Promise<string> {
  const res = await request(app).post(base).set('Authorization', bearer(token)).send({ name });
  return res.body.id;
}

async function createRecipe(token: string, title = 'Tarte aux pommes'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/recipes')
    .set('Authorization', bearer(token))
    .send({ title });
  return res.body.id;
}

/**
 * Ajoute un membre avec le rôle voulu. La gestion des membres relève des
 * routes à venir : on écrit donc directement l'appartenance, ce qui permet de
 * tester dès maintenant les gardes de rôle.
 */
async function addMember(cookbookId: string, email: string, role: Role): Promise<string> {
  const user = await User.findOne({ where: { email } });
  await CookbookMembership.create({ cookbookId, userId: user!.id, role });
  return user!.id;
}

/** Identifiant bien formé mais absent de la base. */
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Création et liste', () => {
  it('crée un cookbook dont l auteur est OWNER -> 201', async () => {
    const token = await registerUser('cb-create@test.fr');

    const res = await request(app)
      .post(base)
      .set('Authorization', bearer(token))
      .send({ name: 'Cuisine de famille', description: 'Les classiques' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Cuisine de famille',
      description: 'Les classiques',
      myRole: 'OWNER',
      memberCount: 1,
      recipeCount: 0,
    });
  });

  it('l appartenance du créateur est bien enregistrée', async () => {
    const token = await registerUser('cb-membership@test.fr');
    const cookbookId = await createCookbook(token);

    const memberships = await CookbookMembership.findAll({ where: { cookbookId } });
    expect(memberships).toHaveLength(1);
    expect(memberships[0].role).toBe('OWNER');
  });

  it('sans nom -> 400', async () => {
    const token = await registerUser('cb-noname@test.fr');

    const res = await request(app)
      .post(base)
      .set('Authorization', bearer(token))
      .send({ description: 'Sans titre' });

    expect(res.status).toBe(400);
  });

  it('sans token -> 401', async () => {
    const res = await request(app).post(base).send({ name: 'Anonyme' });
    expect(res.status).toBe(401);
  });

  it('la liste ne contient que les cookbooks dont on est membre', async () => {
    const mine = await registerUser('cb-mine@test.fr');
    const other = await registerUser('cb-other@test.fr');
    await createCookbook(mine, 'Le mien');
    await createCookbook(other, 'Le sien');

    const res = await request(app).get(base).set('Authorization', bearer(mine));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Le mien');
  });

  it('la liste inclut les cookbooks rejoints, avec le rôle du demandeur', async () => {
    const owner = await registerUser('cb-owner@test.fr');
    const reader = await registerUser('cb-reader@test.fr');
    const cookbookId = await createCookbook(owner, 'Partagé');
    await addMember(cookbookId, 'cb-reader@test.fr', 'READER');

    const res = await request(app).get(base).set('Authorization', bearer(reader));

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: cookbookId, myRole: 'READER', memberCount: 2 });
  });

  it('compte membres et recettes sans les charger', async () => {
    const owner = await registerUser('cb-counts@test.fr');
    await registerUser('cb-counts2@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'cb-counts2@test.fr', 'EDITOR');
    await request(app)
      .post(base + '/' + cookbookId + '/recipes')
      .set('Authorization', bearer(owner))
      .send({ title: 'Blanquette' });

    const res = await request(app).get(base).set('Authorization', bearer(owner));

    expect(res.body[0]).toMatchObject({ memberCount: 2, recipeCount: 1 });
  });

  it('les cookbooks sont triés par nom', async () => {
    const token = await registerUser('cb-sort@test.fr');
    await createCookbook(token, 'Zeste');
    await createCookbook(token, 'Anis');

    const res = await request(app).get(base).set('Authorization', bearer(token));

    expect(res.body.map((cookbook: { name: string }) => cookbook.name)).toEqual(['Anis', 'Zeste']);
  });
});

describe('Consultation et appartenance', () => {
  it('un membre accède au détail -> 200', async () => {
    const token = await registerUser('cb-detail@test.fr');
    const cookbookId = await createCookbook(token);

    const res = await request(app)
      .get(base + '/' + cookbookId)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: cookbookId, myRole: 'OWNER' });
  });

  it('un non-membre reçoit 404, et non 403 : l existence du cookbook reste secrète', async () => {
    const owner = await registerUser('cb-secret-owner@test.fr');
    const stranger = await registerUser('cb-stranger@test.fr');
    const cookbookId = await createCookbook(owner);

    const res = await request(app)
      .get(base + '/' + cookbookId)
      .set('Authorization', bearer(stranger));

    expect(res.status).toBe(404);
  });

  it('un cookbook inexistant rend la même réponse qu un cookbook interdit', async () => {
    const token = await registerUser('cb-unknown@test.fr');

    const res = await request(app)
      .get(base + '/' + UNKNOWN_ID)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(404);
  });

  it('identifiant mal formé -> 400 (et non une erreur SQL)', async () => {
    const token = await registerUser('cb-badid@test.fr');

    const res = await request(app)
      .get(base + '/pas-un-uuid')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(400);
  });
});

describe('Modification et suppression', () => {
  it('le créateur modifie le cookbook -> 200', async () => {
    const token = await registerUser('cb-patch@test.fr');
    const cookbookId = await createCookbook(token, 'Ancien nom');

    const res = await request(app)
      .patch(base + '/' + cookbookId)
      .set('Authorization', bearer(token))
      .send({ name: 'Nouveau nom' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Nouveau nom');
  });

  it('un champ absent est conservé', async () => {
    const token = await registerUser('cb-patch-partial@test.fr');
    const res = await request(app)
      .post(base)
      .set('Authorization', bearer(token))
      .send({ name: 'Cuisine', description: 'À conserver' });

    const patched = await request(app)
      .patch(base + '/' + res.body.id)
      .set('Authorization', bearer(token))
      .send({ name: 'Cuisine du soir' });

    expect(patched.body.description).toBe('À conserver');
  });

  it('corps vide -> 400', async () => {
    const token = await registerUser('cb-patch-empty@test.fr');
    const cookbookId = await createCookbook(token);

    const res = await request(app)
      .patch(base + '/' + cookbookId)
      .set('Authorization', bearer(token))
      .send({});

    expect(res.status).toBe(400);
  });

  it('un éditeur ne peut pas modifier le cookbook -> 403', async () => {
    const owner = await registerUser('cb-patch-owner@test.fr');
    const editor = await registerUser('cb-patch-editor@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'cb-patch-editor@test.fr', 'EDITOR');

    const res = await request(app)
      .patch(base + '/' + cookbookId)
      .set('Authorization', bearer(editor))
      .send({ name: 'Détourné' });

    expect(res.status).toBe(403);
  });

  it('le créateur supprime le cookbook -> 204', async () => {
    const token = await registerUser('cb-delete@test.fr');
    const cookbookId = await createCookbook(token);

    const removed = await request(app)
      .delete(base + '/' + cookbookId)
      .set('Authorization', bearer(token));
    expect(removed.status).toBe(204);

    const after = await request(app).get(base).set('Authorization', bearer(token));
    expect(after.body).toHaveLength(0);
  });

  it('la suppression du cookbook n efface pas les recettes', async () => {
    const token = await registerUser('cb-delete-keep@test.fr');
    const cookbookId = await createCookbook(token);
    const created = await request(app)
      .post(base + '/' + cookbookId + '/recipes')
      .set('Authorization', bearer(token))
      .send({ title: 'Blanquette' });

    await request(app)
      .delete(base + '/' + cookbookId)
      .set('Authorization', bearer(token));

    const recipe = await request(app)
      .get('/api/v1/recipes/' + created.body.id)
      .set('Authorization', bearer(token));
    expect(recipe.status).toBe(200);
    expect(await CookbookRecipe.count({ where: { cookbookId } })).toBe(0);
  });

  it('un lecteur ne peut pas supprimer le cookbook -> 403', async () => {
    const owner = await registerUser('cb-del-owner@test.fr');
    const reader = await registerUser('cb-del-reader@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'cb-del-reader@test.fr', 'READER');

    const res = await request(app)
      .delete(base + '/' + cookbookId)
      .set('Authorization', bearer(reader));

    expect(res.status).toBe(403);
    const still = await request(app).get(base).set('Authorization', bearer(owner));
    expect(still.body).toHaveLength(1);
  });

  it('un éditeur ne peut pas supprimer le cookbook -> 403', async () => {
    const owner = await registerUser('cb-del-owner2@test.fr');
    const editor = await registerUser('cb-del-editor@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'cb-del-editor@test.fr', 'EDITOR');

    const res = await request(app)
      .delete(base + '/' + cookbookId)
      .set('Authorization', bearer(editor));

    expect(res.status).toBe(403);
  });
});

describe('Recettes du cookbook', () => {
  it('un éditeur crée une recette directement dans le cookbook -> 201', async () => {
    const owner = await registerUser('cbr-create-owner@test.fr');
    const editor = await registerUser('cbr-create-editor@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'cbr-create-editor@test.fr', 'EDITOR');

    const res = await request(app)
      .post(base + '/' + cookbookId + '/recipes')
      .set('Authorization', bearer(editor))
      .send({ title: 'Blanquette', ingredients: [{ name: 'Veau', quantity: 800 }] });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Blanquette');
    expect(await CookbookRecipe.count({ where: { cookbookId, recipeId: res.body.id } })).toBe(1);
  });

  it('un lecteur ne peut pas créer de recette -> 403', async () => {
    const owner = await registerUser('cbr-reader-owner@test.fr');
    const reader = await registerUser('cbr-reader@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'cbr-reader@test.fr', 'READER');

    const res = await request(app)
      .post(base + '/' + cookbookId + '/recipes')
      .set('Authorization', bearer(reader))
      .send({ title: 'Interdite' });

    expect(res.status).toBe(403);
  });

  it('lie une recette existante -> 204', async () => {
    const token = await registerUser('cbr-link@test.fr');
    const cookbookId = await createCookbook(token);
    const recipeId = await createRecipe(token);

    const res = await request(app)
      .put(base + '/' + cookbookId + '/recipes/' + recipeId)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(204);
    expect(await CookbookRecipe.count({ where: { cookbookId, recipeId } })).toBe(1);
  });

  it('lier deux fois la même recette -> 409', async () => {
    const token = await registerUser('cbr-link-twice@test.fr');
    const cookbookId = await createCookbook(token);
    const recipeId = await createRecipe(token);

    await request(app)
      .put(base + '/' + cookbookId + '/recipes/' + recipeId)
      .set('Authorization', bearer(token));
    const second = await request(app)
      .put(base + '/' + cookbookId + '/recipes/' + recipeId)
      .set('Authorization', bearer(token));

    expect(second.status).toBe(409);
    expect(await CookbookRecipe.count({ where: { cookbookId, recipeId } })).toBe(1);
  });

  it('lier la recette privée d un tiers -> 403', async () => {
    const editor = await registerUser('cbr-thief@test.fr');
    const victim = await registerUser('cbr-victim@test.fr');
    const cookbookId = await createCookbook(editor);
    const secret = await createRecipe(victim, 'Recette secrète');

    const res = await request(app)
      .put(base + '/' + cookbookId + '/recipes/' + secret)
      .set('Authorization', bearer(editor));

    expect(res.status).toBe(403);
    expect(await CookbookRecipe.count({ where: { cookbookId } })).toBe(0);
  });

  it('lier une recette publique d un tiers reste possible', async () => {
    const editor = await registerUser('cbr-public-editor@test.fr');
    const author = await registerUser('cbr-public-author@test.fr');
    const cookbookId = await createCookbook(editor);
    const published = await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', bearer(author))
      .send({ title: 'Recette publique', visibility: 'public' });

    const res = await request(app)
      .put(base + '/' + cookbookId + '/recipes/' + published.body.id)
      .set('Authorization', bearer(editor));

    expect(res.status).toBe(204);
  });

  it('lier une recette inconnue -> 404', async () => {
    const token = await registerUser('cbr-link-unknown@test.fr');
    const cookbookId = await createCookbook(token);

    const res = await request(app)
      .put(base + '/' + cookbookId + '/recipes/' + UNKNOWN_ID)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(404);
  });

  it('un lecteur ne peut pas lier de recette -> 403', async () => {
    const owner = await registerUser('cbr-link-owner@test.fr');
    const reader = await registerUser('cbr-link-reader@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'cbr-link-reader@test.fr', 'READER');
    const recipeId = await createRecipe(reader);

    const res = await request(app)
      .put(base + '/' + cookbookId + '/recipes/' + recipeId)
      .set('Authorization', bearer(reader));

    expect(res.status).toBe(403);
  });

  it('retirer une recette supprime la liaison, pas la recette', async () => {
    const token = await registerUser('cbr-unlink@test.fr');
    const cookbookId = await createCookbook(token);
    const recipeId = await createRecipe(token);
    await request(app)
      .put(base + '/' + cookbookId + '/recipes/' + recipeId)
      .set('Authorization', bearer(token));

    const res = await request(app)
      .delete(base + '/' + cookbookId + '/recipes/' + recipeId)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(204);
    expect(await CookbookRecipe.count({ where: { cookbookId, recipeId } })).toBe(0);

    const recipe = await request(app)
      .get('/api/v1/recipes/' + recipeId)
      .set('Authorization', bearer(token));
    expect(recipe.status).toBe(200);
  });

  it('retirer une recette non liée reste un 204', async () => {
    const token = await registerUser('cbr-unlink-absent@test.fr');
    const cookbookId = await createCookbook(token);
    const recipeId = await createRecipe(token);

    const res = await request(app)
      .delete(base + '/' + cookbookId + '/recipes/' + recipeId)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(204);
  });

  it('identifiant de recette mal formé -> 400', async () => {
    const token = await registerUser('cbr-badid@test.fr');
    const cookbookId = await createCookbook(token);

    const res = await request(app)
      .put(base + '/' + cookbookId + '/recipes/pas-un-uuid')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(400);
  });
});

describe('Recherche interne au cookbook', () => {
  /** Un cookbook de deux recettes, plus une recette hors cookbook. */
  async function seed(token: string) {
    const cookbookId = await createCookbook(token);
    await request(app)
      .post(base + '/' + cookbookId + '/recipes')
      .set('Authorization', bearer(token))
      .send({ title: 'Tarte aux pommes', tags: ['dessert'], prepTimeMin: 30 });
    await request(app)
      .post(base + '/' + cookbookId + '/recipes')
      .set('Authorization', bearer(token))
      .send({ title: 'Soupe de tomates', tags: ['plat principal'], prepTimeMin: 15 });
    await createRecipe(token, 'Recette personnelle hors cookbook');
    return cookbookId;
  }

  it('ne renvoie que les recettes du cookbook, paginées', async () => {
    const token = await registerUser('cbs-list@test.fr');
    const cookbookId = await seed(token);

    const res = await request(app)
      .get(base + '/' + cookbookId + '/recipes')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.items.map((recipe: { title: string }) => recipe.title).sort()).toEqual([
      'Soupe de tomates',
      'Tarte aux pommes',
    ]);
  });

  it('la recherche plein texte s applique dans le cookbook', async () => {
    const token = await registerUser('cbs-search@test.fr');
    const cookbookId = await seed(token);

    const res = await request(app)
      .get(base + '/' + cookbookId + '/recipes?q=tomate')
      .set('Authorization', bearer(token));

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Soupe de tomates');
  });

  it('les filtres de la liste générale sont disponibles', async () => {
    const token = await registerUser('cbs-filter@test.fr');
    const cookbookId = await seed(token);

    const byTag = await request(app)
      .get(base + '/' + cookbookId + '/recipes?tags=dessert')
      .set('Authorization', bearer(token));
    expect(byTag.body.items).toHaveLength(1);
    expect(byTag.body.items[0].title).toBe('Tarte aux pommes');

    const byTime = await request(app)
      .get(base + '/' + cookbookId + '/recipes?maxPrep=20')
      .set('Authorization', bearer(token));
    expect(byTime.body.items).toHaveLength(1);
    expect(byTime.body.items[0].title).toBe('Soupe de tomates');
  });

  it('un lecteur consulte les recettes du cookbook -> 200', async () => {
    const owner = await registerUser('cbs-owner@test.fr');
    const reader = await registerUser('cbs-reader@test.fr');
    const cookbookId = await seed(owner);
    await addMember(cookbookId, 'cbs-reader@test.fr', 'READER');

    const res = await request(app)
      .get(base + '/' + cookbookId + '/recipes')
      .set('Authorization', bearer(reader));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it('un non-membre -> 404', async () => {
    const owner = await registerUser('cbs-owner2@test.fr');
    const stranger = await registerUser('cbs-stranger@test.fr');
    const cookbookId = await seed(owner);

    const res = await request(app)
      .get(base + '/' + cookbookId + '/recipes')
      .set('Authorization', bearer(stranger));

    expect(res.status).toBe(404);
  });

  it('taille de page hors bornes -> 400', async () => {
    const token = await registerUser('cbs-pagesize@test.fr');
    const cookbookId = await createCookbook(token);

    const res = await request(app)
      .get(base + '/' + cookbookId + '/recipes?pageSize=500')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(400);
  });
});
