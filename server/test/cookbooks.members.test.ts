import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { CookbookInvitation, CookbookMembership, CookbookRecipe, User } from '../src/models';
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

async function userId(email: string): Promise<string> {
  const user = await User.findOne({ where: { email } });
  return user!.id;
}

/** Pose une appartenance directement, pour préparer un état de départ. */
async function addMember(cookbookId: string, email: string, role: Role): Promise<string> {
  const id = await userId(email);
  await CookbookMembership.create({ cookbookId, userId: id, role });
  return id;
}

/** Invitation créée par un créateur : renvoie le token en clair. */
async function invite(
  token: string,
  cookbookId: string,
  email: string,
  role: Role = 'READER',
): Promise<{ id: string; token: string; acceptUrl: string }> {
  const res = await request(app)
    .post(base + '/' + cookbookId + '/invitations')
    .set('Authorization', bearer(token))
    .send({ email, role });
  return res.body;
}

const UNKNOWN_TOKEN = 'f'.repeat(64);

describe('Liste des membres', () => {
  it('liste les membres et leurs rôles, sans le hash du mot de passe', async () => {
    const owner = await registerUser('mb-owner@test.fr');
    await registerUser('mb-reader@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'mb-reader@test.fr', 'READER');

    const res = await request(app)
      .get(base + '/' + cookbookId + '/members')
      .set('Authorization', bearer(owner));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ role: 'OWNER' });
    expect(res.body[0].user.email).toBe('mb-owner@test.fr');
    expect(res.body[0].user.passwordHash).toBeUndefined();
    expect(res.body[1]).toMatchObject({ role: 'READER' });
  });

  it('un lecteur peut consulter la liste des membres', async () => {
    const owner = await registerUser('mb-list-owner@test.fr');
    const reader = await registerUser('mb-list-reader@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'mb-list-reader@test.fr', 'READER');

    const res = await request(app)
      .get(base + '/' + cookbookId + '/members')
      .set('Authorization', bearer(reader));

    expect(res.status).toBe(200);
  });

  it('un non-membre -> 404', async () => {
    const owner = await registerUser('mb-list-owner2@test.fr');
    const stranger = await registerUser('mb-stranger@test.fr');
    const cookbookId = await createCookbook(owner);

    const res = await request(app)
      .get(base + '/' + cookbookId + '/members')
      .set('Authorization', bearer(stranger));

    expect(res.status).toBe(404);
  });
});

describe('Changement de rôle', () => {
  it('le créateur promeut un lecteur en éditeur -> 200', async () => {
    const owner = await registerUser('rl-owner@test.fr');
    const reader = await registerUser('rl-reader@test.fr');
    const cookbookId = await createCookbook(owner);
    const readerId = await addMember(cookbookId, 'rl-reader@test.fr', 'READER');

    const res = await request(app)
      .patch(base + '/' + cookbookId + '/members/' + readerId)
      .set('Authorization', bearer(owner))
      .send({ role: 'EDITOR' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('EDITOR');

    // Le nouveau rôle est effectif : l'ancien lecteur peut désormais créer.
    const created = await request(app)
      .post(base + '/' + cookbookId + '/recipes')
      .set('Authorization', bearer(reader))
      .send({ title: 'Blanquette' });
    expect(created.status).toBe(201);
  });

  it('un éditeur ne peut pas changer les rôles -> 403', async () => {
    const owner = await registerUser('rl-owner2@test.fr');
    const editor = await registerUser('rl-editor@test.fr');
    const cookbookId = await createCookbook(owner);
    const editorId = await addMember(cookbookId, 'rl-editor@test.fr', 'EDITOR');

    const res = await request(app)
      .patch(base + '/' + cookbookId + '/members/' + editorId)
      .set('Authorization', bearer(editor))
      .send({ role: 'OWNER' });

    expect(res.status).toBe(403);
  });

  it('sur quelqu un qui n est pas membre -> 404', async () => {
    const owner = await registerUser('rl-owner3@test.fr');
    await registerUser('rl-outsider@test.fr');
    const cookbookId = await createCookbook(owner);
    const outsiderId = await userId('rl-outsider@test.fr');

    const res = await request(app)
      .patch(base + '/' + cookbookId + '/members/' + outsiderId)
      .set('Authorization', bearer(owner))
      .send({ role: 'EDITOR' });

    expect(res.status).toBe(404);
  });

  it('rôle inconnu -> 400', async () => {
    const owner = await registerUser('rl-owner4@test.fr');
    await registerUser('rl-member@test.fr');
    const cookbookId = await createCookbook(owner);
    const memberId = await addMember(cookbookId, 'rl-member@test.fr', 'READER');

    const res = await request(app)
      .patch(base + '/' + cookbookId + '/members/' + memberId)
      .set('Authorization', bearer(owner))
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(400);
  });

  it('rétrograder le dernier créateur -> 409, le cookbook garde un responsable', async () => {
    const owner = await registerUser('rl-last@test.fr');
    const cookbookId = await createCookbook(owner);
    const ownerId = await userId('rl-last@test.fr');

    const res = await request(app)
      .patch(base + '/' + cookbookId + '/members/' + ownerId)
      .set('Authorization', bearer(owner))
      .send({ role: 'READER' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_OWNER');
  });

  it('rétrograder un créateur reste possible s il en reste un autre', async () => {
    const owner = await registerUser('rl-two-owners@test.fr');
    await registerUser('rl-second-owner@test.fr');
    const cookbookId = await createCookbook(owner);
    const secondId = await addMember(cookbookId, 'rl-second-owner@test.fr', 'OWNER');

    const res = await request(app)
      .patch(base + '/' + cookbookId + '/members/' + secondId)
      .set('Authorization', bearer(owner))
      .send({ role: 'READER' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('READER');
  });
});

describe('Retrait d un membre', () => {
  it('le créateur retire un membre -> 204, qui perd l accès', async () => {
    const owner = await registerUser('rm-owner@test.fr');
    const member = await registerUser('rm-member@test.fr');
    const cookbookId = await createCookbook(owner);
    const memberId = await addMember(cookbookId, 'rm-member@test.fr', 'EDITOR');

    const res = await request(app)
      .delete(base + '/' + cookbookId + '/members/' + memberId)
      .set('Authorization', bearer(owner));
    expect(res.status).toBe(204);

    const after = await request(app)
      .get(base + '/' + cookbookId)
      .set('Authorization', bearer(member));
    expect(after.status).toBe(404);
  });

  it('les recettes du partant restent dans le cookbook', async () => {
    const owner = await registerUser('rm-keep-owner@test.fr');
    const editor = await registerUser('rm-keep-editor@test.fr');
    const cookbookId = await createCookbook(owner);
    const editorId = await addMember(cookbookId, 'rm-keep-editor@test.fr', 'EDITOR');
    await request(app)
      .post(base + '/' + cookbookId + '/recipes')
      .set('Authorization', bearer(editor))
      .send({ title: 'Blanquette' });

    await request(app)
      .delete(base + '/' + cookbookId + '/members/' + editorId)
      .set('Authorization', bearer(owner));

    expect(await CookbookRecipe.count({ where: { cookbookId } })).toBe(1);
    const recipes = await request(app)
      .get(base + '/' + cookbookId + '/recipes')
      .set('Authorization', bearer(owner));
    expect(recipes.body.total).toBe(1);
  });

  it('retirer le dernier créateur -> 409', async () => {
    const owner = await registerUser('rm-last@test.fr');
    const cookbookId = await createCookbook(owner);
    const ownerId = await userId('rm-last@test.fr');

    const res = await request(app)
      .delete(base + '/' + cookbookId + '/members/' + ownerId)
      .set('Authorization', bearer(owner));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_OWNER');
  });

  it('un éditeur ne peut pas retirer un membre -> 403', async () => {
    const owner = await registerUser('rm-owner2@test.fr');
    const editor = await registerUser('rm-editor@test.fr');
    await registerUser('rm-victim@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'rm-editor@test.fr', 'EDITOR');
    const victimId = await addMember(cookbookId, 'rm-victim@test.fr', 'READER');

    const res = await request(app)
      .delete(base + '/' + cookbookId + '/members/' + victimId)
      .set('Authorization', bearer(editor));

    expect(res.status).toBe(403);
  });
});

describe('Quitter un cookbook', () => {
  it('un lecteur quitte le cookbook -> 204', async () => {
    const owner = await registerUser('lv-owner@test.fr');
    const reader = await registerUser('lv-reader@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'lv-reader@test.fr', 'READER');

    const res = await request(app)
      .delete(base + '/' + cookbookId + '/members/me')
      .set('Authorization', bearer(reader));

    expect(res.status).toBe(204);
    const mine = await request(app).get(base).set('Authorization', bearer(reader));
    expect(mine.body).toHaveLength(0);

    // Le cookbook, lui, survit au départ.
    const stillThere = await request(app).get(base).set('Authorization', bearer(owner));
    expect(stillThere.body).toHaveLength(1);
  });

  it('le dernier créateur ne peut pas quitter son cookbook -> 409', async () => {
    const owner = await registerUser('lv-last@test.fr');
    const cookbookId = await createCookbook(owner);

    const res = await request(app)
      .delete(base + '/' + cookbookId + '/members/me')
      .set('Authorization', bearer(owner));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_OWNER');
  });

  it('un créateur peut partir après en avoir promu un autre', async () => {
    const owner = await registerUser('lv-owner2@test.fr');
    await registerUser('lv-successor@test.fr');
    const cookbookId = await createCookbook(owner);
    const successorId = await addMember(cookbookId, 'lv-successor@test.fr', 'READER');

    await request(app)
      .patch(base + '/' + cookbookId + '/members/' + successorId)
      .set('Authorization', bearer(owner))
      .send({ role: 'OWNER' });
    const res = await request(app)
      .delete(base + '/' + cookbookId + '/members/me')
      .set('Authorization', bearer(owner));

    expect(res.status).toBe(204);
    expect(await CookbookMembership.count({ where: { cookbookId } })).toBe(1);
  });

  it('un non-membre ne peut pas quitter -> 404', async () => {
    const owner = await registerUser('lv-owner3@test.fr');
    const stranger = await registerUser('lv-stranger@test.fr');
    const cookbookId = await createCookbook(owner);

    const res = await request(app)
      .delete(base + '/' + cookbookId + '/members/me')
      .set('Authorization', bearer(stranger));

    expect(res.status).toBe(404);
  });
});

describe('Invitations', () => {
  it('le créateur invite une adresse -> 201 avec le lien d acceptation', async () => {
    const owner = await registerUser('iv-owner@test.fr');
    const cookbookId = await createCookbook(owner);

    const res = await request(app)
      .post(base + '/' + cookbookId + '/invitations')
      .set('Authorization', bearer(owner))
      .send({ email: 'iv-guest@test.fr', role: 'COMMENTER' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      invitedEmail: 'iv-guest@test.fr',
      role: 'COMMENTER',
      status: 'pending',
    });
    expect(res.body.token).toHaveLength(64);
    expect(res.body.acceptUrl).toContain(res.body.token);
  });

  it('le token n est pas stocké en clair', async () => {
    const owner = await registerUser('iv-hash-owner@test.fr');
    const cookbookId = await createCookbook(owner);

    const created = await invite(owner, cookbookId, 'iv-hash-guest@test.fr');

    const stored = await CookbookInvitation.findByPk(created.id);
    expect(stored!.token).not.toBe(created.token);
    expect(stored!.token).not.toContain(created.token);
  });

  it('le rôle par défaut est le moins permissif', async () => {
    const owner = await registerUser('iv-default-owner@test.fr');
    const cookbookId = await createCookbook(owner);

    const res = await request(app)
      .post(base + '/' + cookbookId + '/invitations')
      .set('Authorization', bearer(owner))
      .send({ email: 'iv-default-guest@test.fr' });

    expect(res.body.role).toBe('READER');
  });

  it('un éditeur ne peut pas inviter -> 403', async () => {
    const owner = await registerUser('iv-owner2@test.fr');
    const editor = await registerUser('iv-editor@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'iv-editor@test.fr', 'EDITOR');

    const res = await request(app)
      .post(base + '/' + cookbookId + '/invitations')
      .set('Authorization', bearer(editor))
      .send({ email: 'iv-guest2@test.fr', role: 'READER' });

    expect(res.status).toBe(403);
  });

  it('email invalide -> 400', async () => {
    const owner = await registerUser('iv-owner3@test.fr');
    const cookbookId = await createCookbook(owner);

    const res = await request(app)
      .post(base + '/' + cookbookId + '/invitations')
      .set('Authorization', bearer(owner))
      .send({ email: 'pas-un-email', role: 'READER' });

    expect(res.status).toBe(400);
  });

  it('inviter quelqu un qui est déjà membre -> 409', async () => {
    const owner = await registerUser('iv-owner4@test.fr');
    await registerUser('iv-already@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'iv-already@test.fr', 'READER');

    const res = await request(app)
      .post(base + '/' + cookbookId + '/invitations')
      .set('Authorization', bearer(owner))
      .send({ email: 'iv-already@test.fr', role: 'EDITOR' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_MEMBER');
  });

  it('deux invitations en attente pour la même adresse -> 409', async () => {
    const owner = await registerUser('iv-owner5@test.fr');
    const cookbookId = await createCookbook(owner);
    await invite(owner, cookbookId, 'iv-twice@test.fr');

    const res = await request(app)
      .post(base + '/' + cookbookId + '/invitations')
      .set('Authorization', bearer(owner))
      .send({ email: 'iv-twice@test.fr', role: 'READER' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVITATION_PENDING');
  });

  it('la liste des invitations n expose aucun token', async () => {
    const owner = await registerUser('iv-list-owner@test.fr');
    const cookbookId = await createCookbook(owner);
    await invite(owner, cookbookId, 'iv-list-guest@test.fr');

    const res = await request(app)
      .get(base + '/' + cookbookId + '/invitations')
      .set('Authorization', bearer(owner));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].token).toBeUndefined();
    expect(res.body[0].acceptUrl).toBeUndefined();
  });

  it('un lecteur ne peut pas lister les invitations -> 403', async () => {
    const owner = await registerUser('iv-list-owner2@test.fr');
    const reader = await registerUser('iv-list-reader@test.fr');
    const cookbookId = await createCookbook(owner);
    await addMember(cookbookId, 'iv-list-reader@test.fr', 'READER');

    const res = await request(app)
      .get(base + '/' + cookbookId + '/invitations')
      .set('Authorization', bearer(reader));

    expect(res.status).toBe(403);
  });

  it('révoquer une invitation -> 204, le lien ne vaut plus rien', async () => {
    const owner = await registerUser('iv-revoke-owner@test.fr');
    const guest = await registerUser('iv-revoke-guest@test.fr');
    const cookbookId = await createCookbook(owner);
    const created = await invite(owner, cookbookId, 'iv-revoke-guest@test.fr');

    const revoked = await request(app)
      .delete(base + '/' + cookbookId + '/invitations/' + created.id)
      .set('Authorization', bearer(owner));
    expect(revoked.status).toBe(204);

    const accepted = await request(app)
      .post('/api/v1/invitations/' + created.token + '/accept')
      .set('Authorization', bearer(guest));
    expect(accepted.status).toBe(404);
  });

  it('révoquer une invitation inconnue -> 404', async () => {
    const owner = await registerUser('iv-revoke-owner2@test.fr');
    const cookbookId = await createCookbook(owner);

    const res = await request(app)
      .delete(base + '/' + cookbookId + '/invitations/00000000-0000-4000-8000-000000000000')
      .set('Authorization', bearer(owner));

    expect(res.status).toBe(404);
  });
});

describe('Réponse à une invitation', () => {
  it('l invité accepte et rejoint le cookbook avec le rôle prévu', async () => {
    const owner = await registerUser('ac-owner@test.fr');
    const guest = await registerUser('ac-guest@test.fr');
    const cookbookId = await createCookbook(owner, 'Partagé');
    const created = await invite(owner, cookbookId, 'ac-guest@test.fr', 'EDITOR');

    const res = await request(app)
      .post('/api/v1/invitations/' + created.token + '/accept')
      .set('Authorization', bearer(guest));

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('EDITOR');
    expect(res.body.user.email).toBe('ac-guest@test.fr');

    const mine = await request(app).get(base).set('Authorization', bearer(guest));
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0]).toMatchObject({ id: cookbookId, myRole: 'EDITOR', memberCount: 2 });
  });

  it('l invitation acceptée change de statut et ne resert pas', async () => {
    const owner = await registerUser('ac-once-owner@test.fr');
    const guest = await registerUser('ac-once-guest@test.fr');
    const cookbookId = await createCookbook(owner);
    const created = await invite(owner, cookbookId, 'ac-once-guest@test.fr');

    await request(app)
      .post('/api/v1/invitations/' + created.token + '/accept')
      .set('Authorization', bearer(guest));

    const stored = await CookbookInvitation.findByPk(created.id);
    expect(stored!.status).toBe('accepted');

    const second = await request(app)
      .post('/api/v1/invitations/' + created.token + '/accept')
      .set('Authorization', bearer(guest));
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('INVITATION_ALREADY_ANSWERED');
  });

  it('l email de l invitation est comparé sans tenir compte de la casse', async () => {
    const owner = await registerUser('ac-case-owner@test.fr');
    const guest = await registerUser('ac-case-guest@test.fr');
    const cookbookId = await createCookbook(owner);
    const created = await invite(owner, cookbookId, 'AC-Case-Guest@Test.fr');

    const res = await request(app)
      .post('/api/v1/invitations/' + created.token + '/accept')
      .set('Authorization', bearer(guest));

    expect(res.status).toBe(200);
  });

  it('un tiers qui récupère le lien ne peut pas s en servir -> 403', async () => {
    const owner = await registerUser('ac-thief-owner@test.fr');
    await registerUser('ac-thief-guest@test.fr');
    const thief = await registerUser('ac-thief@test.fr');
    const cookbookId = await createCookbook(owner);
    const created = await invite(owner, cookbookId, 'ac-thief-guest@test.fr');

    const res = await request(app)
      .post('/api/v1/invitations/' + created.token + '/accept')
      .set('Authorization', bearer(thief));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVITATION_EMAIL_MISMATCH');
    expect(await CookbookMembership.count({ where: { cookbookId } })).toBe(1);
  });

  it('token inconnu -> 404', async () => {
    const guest = await registerUser('ac-unknown@test.fr');

    const res = await request(app)
      .post('/api/v1/invitations/' + UNKNOWN_TOKEN + '/accept')
      .set('Authorization', bearer(guest));

    expect(res.status).toBe(404);
  });

  it('token mal formé -> 400', async () => {
    const guest = await registerUser('ac-badtoken@test.fr');

    const res = await request(app)
      .post('/api/v1/invitations/pas-un-token/accept')
      .set('Authorization', bearer(guest));

    expect(res.status).toBe(400);
  });

  it('sans authentification -> 401', async () => {
    const res = await request(app).post('/api/v1/invitations/' + UNKNOWN_TOKEN + '/accept');
    expect(res.status).toBe(401);
  });

  it('accepter alors qu on est déjà membre -> 409', async () => {
    const owner = await registerUser('ac-already-owner@test.fr');
    const guest = await registerUser('ac-already-guest@test.fr');
    const cookbookId = await createCookbook(owner);
    const created = await invite(owner, cookbookId, 'ac-already-guest@test.fr');
    await addMember(cookbookId, 'ac-already-guest@test.fr', 'READER');

    const res = await request(app)
      .post('/api/v1/invitations/' + created.token + '/accept')
      .set('Authorization', bearer(guest));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_MEMBER');
  });

  it('refuser une invitation -> 204, sans devenir membre', async () => {
    const owner = await registerUser('dc-owner@test.fr');
    const guest = await registerUser('dc-guest@test.fr');
    const cookbookId = await createCookbook(owner);
    const created = await invite(owner, cookbookId, 'dc-guest@test.fr');

    const res = await request(app)
      .post('/api/v1/invitations/' + created.token + '/decline')
      .set('Authorization', bearer(guest));

    expect(res.status).toBe(204);
    expect(await CookbookMembership.count({ where: { cookbookId } })).toBe(1);

    const accepted = await request(app)
      .post('/api/v1/invitations/' + created.token + '/accept')
      .set('Authorization', bearer(guest));
    expect(accepted.status).toBe(409);
  });

  it('après un refus, le créateur peut réinviter', async () => {
    const owner = await registerUser('dc-again-owner@test.fr');
    const guest = await registerUser('dc-again-guest@test.fr');
    const cookbookId = await createCookbook(owner);
    const first = await invite(owner, cookbookId, 'dc-again-guest@test.fr');
    await request(app)
      .post('/api/v1/invitations/' + first.token + '/decline')
      .set('Authorization', bearer(guest));

    const second = await request(app)
      .post(base + '/' + cookbookId + '/invitations')
      .set('Authorization', bearer(owner))
      .send({ email: 'dc-again-guest@test.fr', role: 'READER' });

    expect(second.status).toBe(201);
  });
});
