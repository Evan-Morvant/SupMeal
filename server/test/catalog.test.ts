import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Ingredient, Tag } from '../src/models';

const app = createApp();

const bearer = (token: string) => 'Bearer ' + token;

async function registerUser(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'motdepasse123', displayName: email.split('@')[0] });
  return res.body.accessToken;
}

/**
 * Le catalogue n'appartient à personne : ni `ingredients` ni `tags` ne
 * référencent `users`, le TRUNCATE de `setup.ts` ne les vide donc pas. Chaque
 * test part d'un catalogue connu.
 */
beforeEach(async () => {
  await Ingredient.destroy({ where: {} });
  await Tag.destroy({ where: { type: 'custom' } });
});

/** Noms des ingrédients d'une réponse, dans l'ordre rendu. */
function names(body: { name: string }[]): string[] {
  return body.map((entry) => entry.name);
}

describe('Catalogue des ingrédients', () => {
  it('exige une authentification', async () => {
    const res = await request(app).get('/api/v1/ingredients');
    expect(res.status).toBe(401);
  });

  it('trouve un ingrédient par fragment, où qu il se situe dans le nom', async () => {
    const token = await registerUser('cat1@test.fr');
    await Ingredient.bulkCreate([
      { name: 'huile d olive' },
      { name: 'olives noires' },
      { name: 'farine' },
    ]);

    const res = await request(app)
      .get('/api/v1/ingredients')
      .query({ q: 'olive' })
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    // Ce qui commence par la saisie passe devant, le reste suit par ordre alphabétique.
    expect(names(res.body)).toEqual(['olives noires', 'huile d olive']);
  });

  it('ignore la casse de la saisie', async () => {
    const token = await registerUser('cat2@test.fr');
    await Ingredient.create({ name: 'tomate' });

    const res = await request(app)
      .get('/api/v1/ingredients')
      .query({ q: 'ToMaTe' })
      .set('Authorization', bearer(token));
    expect(names(res.body)).toEqual(['tomate']);
  });

  it('traite les jokers LIKE comme du texte ordinaire', async () => {
    const token = await registerUser('cat3@test.fr');
    await Ingredient.bulkCreate([{ name: 'sucre' }, { name: 'sel' }, { name: '100% cacao' }]);

    // Sans échappement, « % » ferait remonter le catalogue entier.
    const joker = await request(app)
      .get('/api/v1/ingredients')
      .query({ q: '%' })
      .set('Authorization', bearer(token));
    expect(names(joker.body)).toEqual(['100% cacao']);

    // Idem pour « _ », qui remplacerait n'importe quel caractère.
    const souligne = await request(app)
      .get('/api/v1/ingredients')
      .query({ q: 's_l' })
      .set('Authorization', bearer(token));
    expect(souligne.body).toEqual([]);
  });

  it('rend le début du catalogue quand aucune saisie n est fournie', async () => {
    const token = await registerUser('cat4@test.fr');
    await Ingredient.bulkCreate([{ name: 'poivre' }, { name: 'ail' }, { name: 'basilic' }]);

    const res = await request(app).get('/api/v1/ingredients').set('Authorization', bearer(token));
    expect(names(res.body)).toEqual(['ail', 'basilic', 'poivre']);
  });

  it('plafonne le nombre de propositions', async () => {
    const token = await registerUser('cat5@test.fr');
    await Ingredient.bulkCreate(
      Array.from({ length: 30 }, (_, index) => ({ name: 'ingredient ' + String(index).padStart(2, '0') })),
    );

    const defaut = await request(app).get('/api/v1/ingredients').set('Authorization', bearer(token));
    expect(defaut.body).toHaveLength(20);

    const demande = await request(app)
      .get('/api/v1/ingredients')
      .query({ limit: 5 })
      .set('Authorization', bearer(token));
    expect(demande.body).toHaveLength(5);

    const excessif = await request(app)
      .get('/api/v1/ingredients')
      .query({ limit: 500 })
      .set('Authorization', bearer(token));
    expect(excessif.status).toBe(400);
  });

  it('alimente le catalogue au fil des recettes créées', async () => {
    const token = await registerUser('cat6@test.fr');
    await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', bearer(token))
      .send({ title: 'Tarte', ingredients: [{ name: 'Pommes Golden', quantity: 4 }] });

    const res = await request(app)
      .get('/api/v1/ingredients')
      .query({ q: 'golden' })
      .set('Authorization', bearer(token));
    // Le nom est normalisé en minuscules à l'écriture.
    expect(names(res.body)).toEqual(['pommes golden']);
  });

  it('reste partagé entre utilisateurs : le catalogue n a pas de propriétaire', async () => {
    const auteur = await registerUser('cat7@test.fr');
    await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', bearer(auteur))
      .send({ title: 'Secrète', ingredients: [{ name: 'safran' }] });

    const autre = await registerUser('cat8@test.fr');
    const res = await request(app)
      .get('/api/v1/ingredients')
      .query({ q: 'safran' })
      .set('Authorization', bearer(autre));
    expect(names(res.body)).toEqual(['safran']);
  });
});

describe('Catalogue des tags', () => {
  // Un tag custom naît de la saisie libre d un utilisateur : celui qui ne vit
  // que sur une recette privée ne doit pas se retrouver dans une liste publique.
  it('un visiteur ne voit que les tags portés par une recette publique', async () => {
    const token = await registerUser('tag0@test.fr');
    await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', bearer(token))
      .send({ title: 'Vitrine', tags: ['Publiable'], visibility: 'public' });
    await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', bearer(token))
      .send({ title: 'Carnet', tags: ['Anniversaire de Marie'] });

    const anonyme = await request(app).get('/api/v1/tags');
    const connecte = await request(app).get('/api/v1/tags').set('Authorization', bearer(token));

    expect(anonyme.status).toBe(200);
    expect(names(anonyme.body)).toEqual(['Publiable']);
    expect(names(connecte.body)).toEqual(
      expect.arrayContaining(['Publiable', 'Anniversaire de Marie']),
    );
  });

  it('rendre une recette privée retire son tag de la liste publique', async () => {
    const token = await registerUser('tag0b@test.fr');
    const creation = await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', bearer(token))
      .send({ title: 'Bascule', tags: ['Ephemere'], visibility: 'public' });
    expect(names((await request(app).get('/api/v1/tags')).body)).toEqual(['Ephemere']);

    await request(app)
      .patch('/api/v1/recipes/' + creation.body.id)
      .set('Authorization', bearer(token))
      .send({ visibility: 'private' });

    expect(names((await request(app).get('/api/v1/tags')).body)).toEqual([]);
  });

  it('rend les tags de référence posés par la migration', async () => {
    const token = await registerUser('tag1@test.fr');
    const res = await request(app).get('/api/v1/tags').set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    const course = res.body.filter((tag: { type: string }) => tag.type === 'course');
    expect(course.map((tag: { name: string }) => tag.name)).toContain('Dessert');
    expect(course[0]).toHaveProperty('id');
  });

  it('filtre par type', async () => {
    const token = await registerUser('tag2@test.fr');
    await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', bearer(token))
      .send({ title: 'Curry', tags: ['Rapide'] });

    const custom = await request(app)
      .get('/api/v1/tags')
      .query({ type: 'custom' })
      .set('Authorization', bearer(token));
    expect(custom.body.map((tag: { name: string }) => tag.name)).toEqual(['Rapide']);

    const course = await request(app)
      .get('/api/v1/tags')
      .query({ type: 'course' })
      .set('Authorization', bearer(token));
    expect(course.body.every((tag: { type: string }) => tag.type === 'course')).toBe(true);
    expect(course.body.some((tag: { name: string }) => tag.name === 'Rapide')).toBe(false);
  });

  /*
   * `mine` sert les filtres de recherche : proposer un tag qu'aucune recette
   * accessible ne porte donnerait un critère qui ne renvoie jamais rien.
   */
  it('mine ne rend que les tags des recettes accessibles', async () => {
    const moi = await registerUser('tag4@test.fr');
    const autre = await registerUser('tag5@test.fr');

    await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', bearer(moi))
      .send({ title: 'Mon curry', tags: ['MonTag'] });
    // Recette d'autrui, publique : son tag entre au vocabulaire commun, mais
    // pas dans le périmètre filtrable de l'appelant.
    await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', bearer(autre))
      .send({ title: 'Sa vitrine', tags: ['SonTag'], visibility: 'public' });

    const complet = await request(app).get('/api/v1/tags').set('Authorization', bearer(moi));
    expect(names(complet.body)).toEqual(expect.arrayContaining(['MonTag', 'SonTag']));

    const restreint = await request(app)
      .get('/api/v1/tags')
      .query({ mine: 'true' })
      .set('Authorization', bearer(moi));

    expect(restreint.status).toBe(200);
    expect(names(restreint.body)).toContain('MonTag');
    expect(names(restreint.body)).not.toContain('SonTag');
    // Les tags de référence sans recette accessible disparaissent aussi.
    expect(names(restreint.body)).not.toContain('Dessert');
  });

  it('mine suit le partage : un tag entre avec la recette rangée au cookbook', async () => {
    const proprietaire = await registerUser('tag6@test.fr');
    const membre = await registerUser('tag7@test.fr');

    const recette = await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', bearer(proprietaire))
      .send({ title: 'Partagée', tags: ['TagPartage'] });
    const cookbook = await request(app)
      .post('/api/v1/cookbooks')
      .set('Authorization', bearer(proprietaire))
      .send({ name: 'Famille' });
    await request(app)
      .put('/api/v1/cookbooks/' + cookbook.body.id + '/recipes/' + recette.body.id)
      .set('Authorization', bearer(proprietaire));

    const avant = await request(app)
      .get('/api/v1/tags')
      .query({ mine: 'true' })
      .set('Authorization', bearer(membre));
    expect(names(avant.body)).not.toContain('TagPartage');

    const invitation = await request(app)
      .post('/api/v1/cookbooks/' + cookbook.body.id + '/invitations')
      .set('Authorization', bearer(proprietaire))
      .send({ email: 'tag7@test.fr', role: 'READER' });
    await request(app)
      .post('/api/v1/invitations/' + invitation.body.token + '/accept')
      .set('Authorization', bearer(membre));

    const apres = await request(app)
      .get('/api/v1/tags')
      .query({ mine: 'true' })
      .set('Authorization', bearer(membre));
    expect(names(apres.body)).toContain('TagPartage');
  });

  it('mine exige une authentification', async () => {
    const res = await request(app).get('/api/v1/tags').query({ mine: 'true' });
    expect(res.status).toBe(401);
  });

  it('mine se combine avec le filtre par type', async () => {
    const token = await registerUser('tag8@test.fr');
    await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', bearer(token))
      .send({ title: 'Gateau', tags: ['Dessert', 'FaitMaison'] });

    const res = await request(app)
      .get('/api/v1/tags')
      .query({ mine: 'true', type: 'custom' })
      .set('Authorization', bearer(token));

    expect(names(res.body)).toEqual(['FaitMaison']);
  });

  it('refuse un type inconnu', async () => {
    const token = await registerUser('tag3@test.fr');
    const res = await request(app)
      .get('/api/v1/tags')
      .query({ type: 'inexistant' })
      .set('Authorization', bearer(token));
    expect(res.status).toBe(400);
  });
});
