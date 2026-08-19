import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Comment, CookbookMembership, User } from '../src/models';
import type { Role } from '../src/middlewares/require-role';

const app = createApp();
const base = '/api/v1/cookbooks';

async function registerUser(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'Motdepasse123!', displayName: email.split('@')[0] });
  return res.body.accessToken;
}

const bearer = (token: string) => 'Bearer ' + token;

async function addMember(cookbookId: string, email: string, role: Role): Promise<string> {
  const user = await User.findOne({ where: { email } });
  await CookbookMembership.create({ cookbookId, userId: user!.id, role });
  return user!.id;
}

/** Un cookbook contenant une recette : le contexte minimal d'un fil. */
async function seedThread(ownerToken: string) {
  const cookbook = await request(app)
    .post(base)
    .set('Authorization', bearer(ownerToken))
    .send({ name: 'Cuisine de famille' });
  const recipe = await request(app)
    .post(base + '/' + cookbook.body.id + '/recipes')
    .set('Authorization', bearer(ownerToken))
    .send({ title: 'Blanquette' });
  return { cookbookId: cookbook.body.id as string, recipeId: recipe.body.id as string };
}

const threadUrl = (cookbookId: string, recipeId: string) =>
  base + '/' + cookbookId + '/recipes/' + recipeId + '/comments';

async function comment(token: string, cookbookId: string, recipeId: string, content: string) {
  const res = await request(app)
    .post(threadUrl(cookbookId, recipeId))
    .set('Authorization', bearer(token))
    .send({ content });
  return res.body;
}

describe('Écriture d un commentaire', () => {
  it('un commentateur commente -> 201 avec son auteur', async () => {
    const owner = await registerUser('cm-owner@test.fr');
    const commenter = await registerUser('cm-commenter@test.fr');
    const { cookbookId, recipeId } = await seedThread(owner);
    await addMember(cookbookId, 'cm-commenter@test.fr', 'COMMENTER');

    const res = await request(app)
      .post(threadUrl(cookbookId, recipeId))
      .set('Authorization', bearer(commenter))
      .send({ content: 'Ajouter une pointe de muscade' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      content: 'Ajouter une pointe de muscade',
      recipeId,
      cookbookId,
    });
    expect(res.body.author.email).toBe('cm-commenter@test.fr');
    expect(res.body.author.passwordHash).toBeUndefined();
  });

  it('un lecteur ne peut pas commenter -> 403', async () => {
    const owner = await registerUser('cm-owner2@test.fr');
    const reader = await registerUser('cm-reader@test.fr');
    const { cookbookId, recipeId } = await seedThread(owner);
    await addMember(cookbookId, 'cm-reader@test.fr', 'READER');

    const res = await request(app)
      .post(threadUrl(cookbookId, recipeId))
      .set('Authorization', bearer(reader))
      .send({ content: 'Interdit' });

    expect(res.status).toBe(403);
  });

  it('un non-membre -> 404', async () => {
    const owner = await registerUser('cm-owner3@test.fr');
    const stranger = await registerUser('cm-stranger@test.fr');
    const { cookbookId, recipeId } = await seedThread(owner);

    const res = await request(app)
      .post(threadUrl(cookbookId, recipeId))
      .set('Authorization', bearer(stranger))
      .send({ content: 'Bonjour' });

    expect(res.status).toBe(404);
  });

  it('commenter une recette absente du cookbook -> 404', async () => {
    const owner = await registerUser('cm-outside@test.fr');
    const { cookbookId } = await seedThread(owner);
    const solo = await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', bearer(owner))
      .send({ title: 'Recette personnelle' });

    const res = await request(app)
      .post(threadUrl(cookbookId, solo.body.id))
      .set('Authorization', bearer(owner))
      .send({ content: 'Hors sujet' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RECIPE_NOT_IN_COOKBOOK');
  });

  it('contenu vide -> 400', async () => {
    const owner = await registerUser('cm-empty@test.fr');
    const { cookbookId, recipeId } = await seedThread(owner);

    const res = await request(app)
      .post(threadUrl(cookbookId, recipeId))
      .set('Authorization', bearer(owner))
      .send({ content: '' });

    expect(res.status).toBe(400);
  });
});

describe('Lecture du fil', () => {
  it('un lecteur suit la conversation, dans l ordre', async () => {
    const owner = await registerUser('cl-owner@test.fr');
    const reader = await registerUser('cl-reader@test.fr');
    const { cookbookId, recipeId } = await seedThread(owner);
    await addMember(cookbookId, 'cl-reader@test.fr', 'READER');
    await comment(owner, cookbookId, recipeId, 'Premier');
    await comment(owner, cookbookId, recipeId, 'Second');

    const res = await request(app)
      .get(threadUrl(cookbookId, recipeId))
      .set('Authorization', bearer(reader));

    expect(res.status).toBe(200);
    expect(res.body.map((item: { content: string }) => item.content)).toEqual([
      'Premier',
      'Second',
    ]);
  });

  it('le fil reste interne au cookbook : deux groupes ne se voient pas', async () => {
    const owner = await registerUser('cl-shared-owner@test.fr');
    const friend = await registerUser('cl-friend@test.fr');
    const { cookbookId, recipeId } = await seedThread(owner);

    // La même recette, liée à un second cookbook auquel l ami appartient.
    const other = await request(app)
      .post(base)
      .set('Authorization', bearer(owner))
      .send({ name: 'Cuisine des collègues' });
    await request(app)
      .put(base + '/' + other.body.id + '/recipes/' + recipeId)
      .set('Authorization', bearer(owner));
    await addMember(other.body.id, 'cl-friend@test.fr', 'COMMENTER');

    await comment(owner, cookbookId, recipeId, 'Secret de famille');

    const res = await request(app)
      .get(threadUrl(other.body.id, recipeId))
      .set('Authorization', bearer(friend));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('un non-membre ne lit pas le fil -> 404', async () => {
    const owner = await registerUser('cl-owner2@test.fr');
    const stranger = await registerUser('cl-stranger@test.fr');
    const { cookbookId, recipeId } = await seedThread(owner);
    await comment(owner, cookbookId, recipeId, 'Privé');

    const res = await request(app)
      .get(threadUrl(cookbookId, recipeId))
      .set('Authorization', bearer(stranger));

    expect(res.status).toBe(404);
  });

  it('identifiant de recette mal formé -> 400', async () => {
    const owner = await registerUser('cl-badid@test.fr');
    const { cookbookId } = await seedThread(owner);

    const res = await request(app)
      .get(base + '/' + cookbookId + '/recipes/pas-un-uuid/comments')
      .set('Authorization', bearer(owner));

    expect(res.status).toBe(400);
  });
});

describe('Modification d un commentaire', () => {
  it('l auteur modifie son commentaire -> 200', async () => {
    const owner = await registerUser('cu-owner@test.fr');
    const { cookbookId, recipeId } = await seedThread(owner);
    const created = await comment(owner, cookbookId, recipeId, 'Avec du thym');

    const res = await request(app)
      .patch('/api/v1/comments/' + created.id)
      .set('Authorization', bearer(owner))
      .send({ content: 'Avec du thym et du laurier' });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe('Avec du thym et du laurier');
  });

  it('un autre membre ne modifie pas le commentaire d autrui -> 403', async () => {
    const owner = await registerUser('cu-owner2@test.fr');
    const commenter = await registerUser('cu-commenter@test.fr');
    const { cookbookId, recipeId } = await seedThread(owner);
    await addMember(cookbookId, 'cu-commenter@test.fr', 'COMMENTER');
    const created = await comment(commenter, cookbookId, recipeId, 'Mon avis');

    const res = await request(app)
      .patch('/api/v1/comments/' + created.id)
      .set('Authorization', bearer(owner))
      .send({ content: 'Détourné' });

    expect(res.status).toBe(403);
  });

  it('commentaire inconnu -> 404', async () => {
    const owner = await registerUser('cu-unknown@test.fr');

    const res = await request(app)
      .patch('/api/v1/comments/00000000-0000-4000-8000-000000000000')
      .set('Authorization', bearer(owner))
      .send({ content: 'Rien' });

    expect(res.status).toBe(404);
  });

  it('contenu manquant -> 400', async () => {
    const owner = await registerUser('cu-nobody@test.fr');
    const { cookbookId, recipeId } = await seedThread(owner);
    const created = await comment(owner, cookbookId, recipeId, 'Initial');

    const res = await request(app)
      .patch('/api/v1/comments/' + created.id)
      .set('Authorization', bearer(owner))
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('Suppression d un commentaire', () => {
  it('l auteur supprime son commentaire -> 204', async () => {
    const owner = await registerUser('cd-owner@test.fr');
    const commenter = await registerUser('cd-commenter@test.fr');
    const { cookbookId, recipeId } = await seedThread(owner);
    await addMember(cookbookId, 'cd-commenter@test.fr', 'COMMENTER');
    const created = await comment(commenter, cookbookId, recipeId, 'À effacer');

    const res = await request(app)
      .delete('/api/v1/comments/' + created.id)
      .set('Authorization', bearer(commenter));

    expect(res.status).toBe(204);
    expect(await Comment.count({ where: { cookbookId } })).toBe(0);
  });

  it('le créateur du cookbook modère le fil de son groupe -> 204', async () => {
    const owner = await registerUser('cd-owner2@test.fr');
    const commenter = await registerUser('cd-commenter2@test.fr');
    const { cookbookId, recipeId } = await seedThread(owner);
    await addMember(cookbookId, 'cd-commenter2@test.fr', 'COMMENTER');
    const created = await comment(commenter, cookbookId, recipeId, 'Propos déplacés');

    const res = await request(app)
      .delete('/api/v1/comments/' + created.id)
      .set('Authorization', bearer(owner));

    expect(res.status).toBe(204);
  });

  it('un éditeur ne supprime pas le commentaire d autrui -> 403', async () => {
    const owner = await registerUser('cd-owner3@test.fr');
    const editor = await registerUser('cd-editor@test.fr');
    const { cookbookId, recipeId } = await seedThread(owner);
    await addMember(cookbookId, 'cd-editor@test.fr', 'EDITOR');
    const created = await comment(owner, cookbookId, recipeId, 'Le mien');

    const res = await request(app)
      .delete('/api/v1/comments/' + created.id)
      .set('Authorization', bearer(editor));

    expect(res.status).toBe(403);
    expect(await Comment.count({ where: { cookbookId } })).toBe(1);
  });

  it('le créateur d un autre cookbook n a aucun pouvoir ici -> 403', async () => {
    const owner = await registerUser('cd-owner4@test.fr');
    const outsider = await registerUser('cd-outsider@test.fr');
    const { cookbookId, recipeId } = await seedThread(owner);
    const created = await comment(owner, cookbookId, recipeId, 'Chez moi');
    // L intrus est créateur, mais de son propre cookbook.
    await request(app)
      .post(base)
      .set('Authorization', bearer(outsider))
      .send({ name: 'Ailleurs' });

    const res = await request(app)
      .delete('/api/v1/comments/' + created.id)
      .set('Authorization', bearer(outsider));

    expect(res.status).toBe(403);
  });

  it('la suppression de la recette emporte ses commentaires', async () => {
    const owner = await registerUser('cd-cascade@test.fr');
    const { cookbookId, recipeId } = await seedThread(owner);
    await comment(owner, cookbookId, recipeId, 'Éphémère');

    await request(app)
      .delete('/api/v1/recipes/' + recipeId)
      .set('Authorization', bearer(owner));

    expect(await Comment.count({ where: { cookbookId } })).toBe(0);
  });
});
