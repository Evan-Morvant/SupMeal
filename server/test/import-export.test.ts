import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Ingredient, Recipe, RecipeIngredient, User } from '../src/models';

const app = createApp();
const exportUrl = '/api/v1/export';
const importUrl = '/api/v1/import';

const bearer = (token: string) => 'Bearer ' + token;

async function registerUser(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'motdepasse123', displayName: email.split('@')[0] });
  return res.body.accessToken;
}

/** Recette complète : tous les champs que l'aller-retour doit préserver. */
const TARTE = {
  title: 'Tarte aux pommes',
  description: 'La recette de mamie',
  prepTimeMin: 20,
  cookTimeMin: 40,
  servings: 6,
  source: 'https://exemple.fr/tarte',
  tags: ['Dessert', 'Facile'],
  ingredients: [
    { name: 'farine', quantity: 200, unit: 'g', note: 'tamisée' },
    { name: 'pommes', quantity: 4, unit: null, note: null },
    { name: 'sel' },
  ],
  steps: ['Préparer la pâte', 'Éplucher les pommes', 'Enfourner 40 min'],
};

async function createRecipe(token: string, body: Record<string, unknown>): Promise<void> {
  const res = await request(app)
    .post('/api/v1/recipes')
    .set('Authorization', bearer(token))
    .send(body);
  expect(res.status).toBe(201);
}

function exportAs(token: string, format: string) {
  return request(app)
    .get(exportUrl)
    .query({ format })
    .set('Authorization', bearer(token));
}

function importFile(token: string, content: string, filename: string, format?: string) {
  const req = request(app).post(importUrl).set('Authorization', bearer(token));
  if (format !== undefined) {
    req.field('format', format);
  }
  return req.attach('file', Buffer.from(content, 'utf8'), {
    filename,
    contentType: filename.endsWith('.csv') ? 'text/csv' : 'application/json',
  });
}

/** Recette relue en base avec son contenu, pour vérifier l'import. */
async function findImported(email: string, title: string) {
  const user = await User.findOne({ where: { email } });
  const recipe = await Recipe.findOne({
    where: { ownerId: user!.id, title },
    include: [
      { model: RecipeIngredient, as: 'ingredients', include: [{ model: Ingredient, as: 'ingredient' }] },
      'steps',
      'tags',
    ],
  });
  return recipe;
}

/**
 * Les tags de référence ne sont pas remis à zéro entre les tests et la
 * résolution des tags est insensible à la casse : un « Facile » créé ici peut
 * retrouver un « facile » déjà en base. Seul le libellé, à la casse près,
 * a besoin d'être vérifié.
 */
function tagNames(names: (string | undefined)[]): string[] {
  return names.map((name) => (name ?? '').toLowerCase()).sort();
}

describe('Export', () => {
  it('exige une authentification', async () => {
    const res = await request(app).get(exportUrl);
    expect(res.status).toBe(401);
  });

  it('rend un JSON complet, avec avertissement et pièce jointe datée', async () => {
    const token = await registerUser('export1@test.fr');
    await createRecipe(token, TARTE);

    const res = await exportAs(token, 'json');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="supmeal-export-\d{4}-\d{2}-\d{2}\.json"/);
    expect(res.body.warning).toContain('en clair');

    expect(res.body.recipes).toHaveLength(1);
    const recipe = res.body.recipes[0];
    expect(recipe.title).toBe(TARTE.title);
    expect(recipe.prepTimeMin).toBe(20);
    expect(recipe.servings).toBe(6);
    expect(recipe.steps).toEqual(TARTE.steps);
    expect(tagNames(recipe.tags)).toEqual(['dessert', 'facile']);
    expect(recipe.ingredients[0]).toEqual({
      name: 'farine',
      quantity: 200,
      unit: 'g',
      note: 'tamisée',
    });
  });

  it('joint les cookbooks et leur composition', async () => {
    const token = await registerUser('export2@test.fr');
    await createRecipe(token, { title: 'Soupe' });

    const cookbook = await request(app)
      .post('/api/v1/cookbooks')
      .set('Authorization', bearer(token))
      .send({ name: 'Famille' });
    const recipeId = (await findImported('export2@test.fr', 'Soupe'))!.id;
    const linked = await request(app)
      .put('/api/v1/cookbooks/' + cookbook.body.id + '/recipes/' + recipeId)
      .set('Authorization', bearer(token));
    expect(linked.status).toBe(204);

    const res = await exportAs(token, 'json');
    expect(res.body.cookbooks).toEqual([
      { name: 'Famille', description: null, recipeTitles: ['Soupe'] },
    ]);
  });

  it('rend un CSV portant la légende puis les colonnes', async () => {
    const token = await registerUser('export3@test.fr');
    await createRecipe(token, TARTE);

    const res = await exportAs(token, 'csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.split('\r\n')[0]).toContain('en clair');
    expect(res.text).toContain('title,description,prepTimeMin');
    expect(res.text).toContain('200|g|farine|tamisée');
  });

  it('rend un tableau au schéma de Mealie', async () => {
    const token = await registerUser('export4@test.fr');
    await createRecipe(token, TARTE);

    const res = await exportAs(token, 'mealie');
    expect(res.status).toBe(200);
    const [recipe] = res.body;
    expect(recipe.name).toBe(TARTE.title);
    expect(recipe.slug).toBe('tarte-aux-pommes');
    expect(recipe.prepTime).toBe('PT20M');
    expect(recipe.performTime).toBe('PT40M');
    expect(recipe.totalTime).toBe('PT1H');
    expect(recipe.recipeYield).toBe('6 portions');
    expect(recipe.recipeInstructions.map((step: { text: string }) => step.text)).toEqual(TARTE.steps);
    expect(recipe.recipeIngredient[0]).toMatchObject({
      quantity: 200,
      unit: { name: 'g' },
      food: { name: 'farine' },
      note: 'tamisée',
      display: '200 g farine (tamisée)',
    });
  });
});

describe('Export d\'une recette isolée', () => {
  /** Identifiant de la recette créée, relu en base. */
  async function recipeIdOf(email: string, title: string): Promise<string> {
    return (await findImported(email, title))!.id;
  }

  function exportRecipeAs(token: string, recipeId: string, format: string) {
    return request(app)
      .get('/api/v1/recipes/' + recipeId + '/export')
      .query({ format })
      .set('Authorization', bearer(token));
  }

  it('ne rend que la recette demandée, dans un fichier à son nom', async () => {
    const token = await registerUser('solo1@test.fr');
    await createRecipe(token, TARTE);
    await createRecipe(token, { title: 'Soupe à ne pas exporter' });
    const recipeId = await recipeIdOf('solo1@test.fr', TARTE.title);

    const res = await exportRecipeAs(token, recipeId, 'json');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(
      /filename="supmeal-tarte-aux-pommes-\d{4}-\d{2}-\d{2}\.json"/,
    );
    expect(res.body.recipes).toHaveLength(1);
    expect(res.body.recipes[0].title).toBe(TARTE.title);
    expect(res.body.cookbooks).toEqual([]);
    expect(res.body.warning).toContain('en clair');
  });

  it('accepte les trois formats', async () => {
    const token = await registerUser('solo2@test.fr');
    await createRecipe(token, TARTE);
    const recipeId = await recipeIdOf('solo2@test.fr', TARTE.title);

    const csv = await exportRecipeAs(token, recipeId, 'csv');
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('200|g|farine|tamisée');

    const mealie = await exportRecipeAs(token, recipeId, 'mealie');
    expect(mealie.status).toBe(200);
    expect(mealie.body).toHaveLength(1);
    expect(mealie.body[0].slug).toBe('tarte-aux-pommes');
  });

  it.each(['json', 'csv', 'mealie'])(
    'produit un fichier réimportable tel quel en %s',
    async (format) => {
      const author = await registerUser('solo-' + format + '-a@test.fr');
      await createRecipe(author, TARTE);
      const recipeId = await recipeIdOf('solo-' + format + '-a@test.fr', TARTE.title);
      const exported = await exportRecipeAs(author, recipeId, format);
      const file = format === 'csv' ? exported.text : JSON.stringify(exported.body);

      const importer = await registerUser('solo-' + format + '-b@test.fr');
      const res = await importFile(
        importer,
        file,
        'recette.' + (format === 'csv' ? 'csv' : 'json'),
      );

      // Le format n'est pas précisé : il doit être reconnu au contenu.
      expect(res.body).toMatchObject({ format, created: 1, skipped: 0, errors: [] });
      const recipe = await findImported('solo-' + format + '-b@test.fr', TARTE.title);
      expect(recipe!.servings).toBe(6);
      expect(recipe!.steps!.map((step) => step.instruction)).toEqual(TARTE.steps);
    },
  );

  it('refuse la recette d\'un autre utilisateur', async () => {
    const author = await registerUser('solo3@test.fr');
    await createRecipe(author, TARTE);
    const recipeId = await recipeIdOf('solo3@test.fr', TARTE.title);

    const intrus = await registerUser('solo4@test.fr');
    const res = await exportRecipeAs(intrus, recipeId, 'json');
    expect(res.status).toBe(403);
  });
});

describe('Export d\'un cookbook', () => {
  /** Cookbook contenant les recettes indiquées, créées au préalable. */
  async function seedCookbook(
    email: string,
    name: string,
    titles: string[],
  ): Promise<{ token: string; cookbookId: string }> {
    const token = await registerUser(email);
    const created = await request(app)
      .post('/api/v1/cookbooks')
      .set('Authorization', bearer(token))
      .send({ name });

    for (const title of titles) {
      await createRecipe(token, { ...TARTE, title });
      const recipe = await findImported(email, title);
      await request(app)
        .put('/api/v1/cookbooks/' + created.body.id + '/recipes/' + recipe!.id)
        .set('Authorization', bearer(token));
    }
    return { token, cookbookId: created.body.id };
  }

  function exportCookbookAs(token: string, cookbookId: string, format = 'json') {
    return request(app)
      .get('/api/v1/cookbooks/' + cookbookId + '/export')
      .query({ format })
      .set('Authorization', bearer(token));
  }

  it('ne rend que les recettes du cookbook, dans un fichier à son nom', async () => {
    const { token, cookbookId } = await seedCookbook('cb1@test.fr', 'Recettes de Noël', ['Bûche']);
    // Recette personnelle, hors du cookbook : elle ne doit pas sortir.
    await createRecipe(token, { title: 'Sandwich du midi' });

    const res = await exportCookbookAs(token, cookbookId);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(
      /filename="supmeal-recettes-de-noel-\d{4}-\d{2}-\d{2}\.json"/,
    );
    expect(res.body.recipes.map((recipe: { title: string }) => recipe.title)).toEqual(['Bûche']);
    expect(res.body.cookbooks).toEqual([
      { name: 'Recettes de Noël', description: null, recipeTitles: ['Bûche'] },
    ]);
  });

  it('ne joint rien de celui qui exporte', async () => {
    const { token, cookbookId } = await seedCookbook('cb2@test.fr', 'Famille', ['Gratin']);
    await request(app)
      .put('/api/v1/users/me/preferences')
      .set('Authorization', bearer(token))
      .send({ allergies: ['arachides'] });

    const res = await exportCookbookAs(token, cookbookId);
    expect(res.body).not.toHaveProperty('preferences');
    expect(res.body).not.toHaveProperty('owner');
  });

  it('produit un fichier réimportable', async () => {
    const { token, cookbookId } = await seedCookbook('cb3@test.fr', 'Partage', ['Ratatouille']);
    const exported = await exportCookbookAs(token, cookbookId);

    const importer = await registerUser('cb4@test.fr');
    const res = await importFile(importer, JSON.stringify(exported.body), 'cookbook.json');
    expect(res.body).toMatchObject({ format: 'json', created: 1, errors: [] });
    expect(await findImported('cb4@test.fr', 'Ratatouille')).not.toBeNull();
  });

  it('est ouvert au lecteur invité', async () => {
    const { token, cookbookId } = await seedCookbook('cb5@test.fr', 'Ouvert', ['Quiche']);
    const lecteur = await registerUser('cb6@test.fr');

    const invitation = await request(app)
      .post('/api/v1/cookbooks/' + cookbookId + '/invitations')
      .set('Authorization', bearer(token))
      .send({ email: 'cb6@test.fr', role: 'READER' });
    expect(invitation.status).toBe(201);

    const accepted = await request(app)
      .post('/api/v1/invitations/' + invitation.body.token + '/accept')
      .set('Authorization', bearer(lecteur));
    expect(accepted.status).toBe(200);

    const res = await exportCookbookAs(lecteur, cookbookId);
    expect(res.status).toBe(200);
    expect(res.body.recipes).toHaveLength(1);
  });

  it('reste introuvable pour un non-membre', async () => {
    const { cookbookId } = await seedCookbook('cb7@test.fr', 'Privé', ['Tiramisu']);
    const intrus = await registerUser('cb8@test.fr');

    const res = await exportCookbookAs(intrus, cookbookId);
    expect(res.status).toBe(404);
  });
});

describe('Aucune donnée personnelle dans l\'export', () => {
  const PREFERENCES = {
    diets: ['végétarien'],
    allergies: ['arachides', 'gluten'],
    preferredCuisines: ['italienne'],
    defaultServings: 4,
  };

  async function setPreferences(token: string): Promise<void> {
    const res = await request(app)
      .put('/api/v1/users/me/preferences')
      .set('Authorization', bearer(token))
      .send(PREFERENCES);
    expect(res.status).toBe(200);
  }

  function getPreferences(token: string) {
    return request(app).get('/api/v1/users/me/preferences').set('Authorization', bearer(token));
  }

  it('l\'export du compte ne porte ni profil ni préférences', async () => {
    const token = await registerUser('pref1@test.fr');
    await setPreferences(token);
    await createRecipe(token, TARTE);

    const res = await exportAs(token, 'json');
    expect(res.body).not.toHaveProperty('preferences');
    expect(res.body).not.toHaveProperty('owner');
    // Ce qui reste est bien le contenu attendu.
    expect(res.body.recipes).toHaveLength(1);
  });

  it('l\'export d\'une recette isolée non plus', async () => {
    const token = await registerUser('pref8@test.fr');
    await setPreferences(token);
    await createRecipe(token, TARTE);
    const recipeId = (await findImported('pref8@test.fr', TARTE.title))!.id;

    const res = await request(app)
      .get('/api/v1/recipes/' + recipeId + '/export')
      .set('Authorization', bearer(token));
    expect(res.body).not.toHaveProperty('preferences');
    expect(res.body).not.toHaveProperty('owner');
  });

  it('aucun email n\'apparaît dans le fichier, quel que soit le format', async () => {
    const token = await registerUser('pref9@test.fr');
    await setPreferences(token);
    await createRecipe(token, TARTE);

    for (const format of ['json', 'csv', 'mealie'] as const) {
      const res = await exportAs(token, format);
      const contenu = format === 'json' ? JSON.stringify(res.body) : res.text;
      expect(contenu).not.toContain('pref9@test.fr');
    }
  });

  it('l\'import laisse les préférences du compte intactes', async () => {
    const author = await registerUser('pref2@test.fr');
    await setPreferences(author);
    await createRecipe(author, TARTE);
    const exported = await exportAs(author, 'json');

    const importer = await registerUser('pref3@test.fr');
    const res = await importFile(importer, JSON.stringify(exported.body), 'export.json');
    expect(res.body).toMatchObject({ created: 1 });
    expect(res.body).not.toHaveProperty('preferencesImported');

    const after = await getPreferences(importer);
    expect(after.body.allergies).toEqual([]);
    expect(after.body.defaultServings).toBe(2);
  });

  it('un fichier portant des préférences les voit ignorées', async () => {
    const importer = await registerUser('pref4@test.fr');

    // Fichier d'une version antérieure du format, préférences comprises.
    const ancien = {
      preferences: PREFERENCES,
      recipes: [{ title: 'Tarte tatin', ingredients: [], steps: [] }],
    };
    const res = await importFile(importer, JSON.stringify(ancien), 'ancien.json');
    expect(res.body).toMatchObject({ created: 1 });

    const after = await getPreferences(importer);
    expect(after.body.allergies).toEqual([]);
    expect(after.body.defaultServings).toBe(2);
  });

  it('le champ withPreferences n\'a plus cours et ne fait rien', async () => {
    const author = await registerUser('pref5@test.fr');
    await setPreferences(author);
    await createRecipe(author, TARTE);
    const exported = await exportAs(author, 'json');

    const importer = await registerUser('pref6@test.fr');
    const res = await request(app)
      .post(importUrl)
      .set('Authorization', bearer(importer))
      .field('withPreferences', 'true')
      .attach('file', Buffer.from(JSON.stringify(exported.body), 'utf8'), {
        filename: 'export.json',
        contentType: 'application/json',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ created: 1 });
    const after = await getPreferences(importer);
    expect(after.body.allergies).toEqual([]);
  });
});

describe('Import', () => {
  it('exige une authentification', async () => {
    const res = await request(app).post(importUrl);
    expect(res.status).toBe(401);
  });

  it('refuse une requête sans fichier', async () => {
    const token = await registerUser('import0@test.fr');
    const res = await request(app).post(importUrl).set('Authorization', bearer(token));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FILE_REQUIRED');
  });

  it.each(['json', 'csv', 'mealie'])(
    'restitue une recette identique après un aller-retour en %s',
    async (format) => {
      const author = await registerUser('rt-' + format + '-a@test.fr');
      await createRecipe(author, TARTE);
      const exported = await exportAs(author, format);
      const file = format === 'csv' ? exported.text : JSON.stringify(exported.body);

      const importer = await registerUser('rt-' + format + '-b@test.fr');
      const res = await importFile(importer, file, 'export.' + (format === 'csv' ? 'csv' : 'json'), format);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ format, created: 1, skipped: 0, errors: [] });

      // L'importeur devient créateur de la recette importée.
      const recipe = await findImported('rt-' + format + '-b@test.fr', TARTE.title);
      expect(recipe).not.toBeNull();
      expect(recipe!.description).toBe(TARTE.description);
      expect(recipe!.prepTimeMin).toBe(20);
      expect(recipe!.cookTimeMin).toBe(40);
      expect(recipe!.servings).toBe(6);
      expect(recipe!.steps!.map((step) => step.instruction)).toEqual(TARTE.steps);
      expect(tagNames(recipe!.tags!.map((tag) => tag.name))).toEqual(['dessert', 'facile']);

      const farine = recipe!.ingredients!.find((line) => line.ingredient?.name === 'farine');
      expect(Number(farine!.quantity)).toBe(200);
      expect(farine!.unit).toBe('g');
      expect(farine!.note).toBe('tamisée');
    },
  );

  it('importe une recette privée, sans reprendre la visibilité de la source', async () => {
    const author = await registerUser('vis-a@test.fr');
    await createRecipe(author, { ...TARTE, visibility: 'public' });
    const exported = await exportAs(author, 'json');

    const importer = await registerUser('vis-b@test.fr');
    await importFile(importer, JSON.stringify(exported.body), 'export.json');

    const recipe = await findImported('vis-b@test.fr', TARTE.title);
    expect(recipe!.visibility).toBe('private');
  });

  it('devine le format quand la requête ne le précise pas', async () => {
    const token = await registerUser('detect@test.fr');

    const mealie = JSON.stringify([{ name: 'Crêpes', recipeIngredient: [], recipeInstructions: [] }]);
    const guessedMealie = await importFile(token, mealie, 'mealie.json');
    expect(guessedMealie.body).toMatchObject({ format: 'mealie', created: 1 });

    const csv = 'title,steps\r\nGaufres,Mélanger';
    const guessedCsv = await importFile(token, csv, 'recettes.csv');
    expect(guessedCsv.body).toMatchObject({ format: 'csv', created: 1 });

    const natif = JSON.stringify({ recipes: [{ title: 'Clafoutis', steps: ['Cuire'] }] });
    const guessedJson = await importFile(token, natif, 'natif.json');
    expect(guessedJson.body).toMatchObject({ format: 'json', created: 1 });
  });

  it('lit un fichier Mealie écrit à la main : durées ISO, aliments et unités structurés', async () => {
    const token = await registerUser('mealie-in@test.fr');
    const file = JSON.stringify([
      {
        name: 'Pain maison',
        description: 'Croustillant',
        prepTime: 'PT1H30M',
        performTime: '45 minutes',
        recipeYield: '4 servings',
        orgURL: 'https://exemple.fr/pain',
        tags: [{ name: 'Boulangerie' }],
        recipeCategory: [{ name: 'Petit-déjeuner' }],
        recipeIngredient: [
          { quantity: 500, unit: { name: 'g' }, food: { name: 'farine' }, note: 'T65' },
          { quantity: 1, unit: null, food: null, note: 'sachet de levure', display: '1 sachet de levure' },
        ],
        recipeInstructions: [{ title: '', text: 'Pétrir' }, { text: 'Cuire au four' }],
      },
    ]);

    const res = await importFile(token, file, 'mealie.json', 'mealie');
    expect(res.body).toMatchObject({ created: 1, skipped: 0, errors: [] });

    const recipe = await findImported('mealie-in@test.fr', 'Pain maison');
    expect(recipe!.prepTimeMin).toBe(90);
    expect(recipe!.cookTimeMin).toBe(45);
    expect(recipe!.servings).toBe(4);
    expect(recipe!.source).toBe('https://exemple.fr/pain');
    expect(tagNames(recipe!.tags!.map((tag) => tag.name))).toEqual(['boulangerie', 'petit-déjeuner']);
    expect(recipe!.steps!.map((step) => step.instruction)).toEqual(['Pétrir', 'Cuire au four']);

    // Sans aliment structuré, le libellé de la note fait office de nom.
    const noms = recipe!.ingredients!.map((line) => line.ingredient?.name).sort();
    expect(noms).toEqual(['farine', 'sachet de levure']);
  });

  it('ignore les recettes déjà possédées plutôt que de les dupliquer', async () => {
    const token = await registerUser('doublon@test.fr');
    await createRecipe(token, TARTE);
    const exported = await exportAs(token, 'json');

    const res = await importFile(token, JSON.stringify(exported.body), 'export.json', 'json');
    expect(res.body).toMatchObject({ created: 0, skipped: 1, errors: [] });
    expect(await Recipe.count({ where: { title: TARTE.title } })).toBe(1);
  });

  it('poursuit malgré une recette invalide et la signale dans le rapport', async () => {
    const token = await registerUser('partiel@test.fr');
    const file = JSON.stringify({
      recipes: [
        { title: 'Valide', steps: ['Cuire'] },
        { title: '', steps: ['Sans titre'] },
        { title: 'Valide aussi' },
      ],
    });

    const res = await importFile(token, file, 'export.json', 'json');
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(2);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0]).toContain('sans titre');
  });

  it('refuse un fichier illisible en 422', async () => {
    const token = await registerUser('malforme@test.fr');

    const casse = await importFile(token, '{ ceci nest pas du json', 'export.json', 'json');
    expect(casse.status).toBe(422);
    expect(casse.body.error.code).toBe('MALFORMED_FILE');

    const vide = await importFile(token, JSON.stringify({ recipes: [] }), 'export.json', 'json');
    expect(vide.status).toBe(422);

    const sansEntete = await importFile(token, 'a,b\r\n1,2', 'export.csv', 'csv');
    expect(sansEntete.status).toBe(422);
  });
});
