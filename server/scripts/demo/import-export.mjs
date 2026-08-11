import { call, callFull, check, checkEqual, main, register, section, sendFile } from './lib.mjs';

/**
 * Import et export : les trois formats (natif, CSV, Mealie), les trois
 * périmètres (compte, cookbook, recette) et les règles de l'import —
 * l'importeur devient créateur, les recettes arrivent privées, les doublons
 * sont ignorés, les préférences ne suivent que sur demande.
 *
 * Usage : node scripts/demo/import-export.mjs
 */

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
    { name: 'pommes', quantity: 4 },
    { name: 'sel' },
  ],
  steps: ['Préparer la pâte', 'Éplucher les pommes', 'Enfourner 40 min'],
};

const PREFERENCES = {
  diets: ['végétarien'],
  allergies: ['arachides', 'gluten'],
  preferredCuisines: ['italienne'],
  defaultServings: 4,
};

/** Envoie un contenu au point d'import et rend le rapport. */
function importer(token, content, { format, withPreferences, filename, expect } = {}) {
  const fields = {};
  if (format !== undefined) {
    fields.format = format;
  }
  if (withPreferences !== undefined) {
    fields.withPreferences = withPreferences;
  }
  return sendFile('/import', {
    token,
    filename: filename ?? 'export.json',
    contentType: filename?.endsWith('.csv') === true ? 'text/csv' : 'application/json',
    content,
    fields,
    expect,
  });
}

/** Corps d'export prêt à être réimporté : texte pour le CSV, JSON sinon. */
function fileOf(response, format) {
  return format === 'csv' ? response.body : JSON.stringify(response.body);
}

async function run() {
  const chef = await register('chef');
  await call('PUT', '/users/me/preferences', { token: chef.token, body: PREFERENCES });
  await call('POST', '/recipes', { token: chef.token, body: TARTE });

  section('Export complet du compte');
  const complet = await callFull('GET', '/export', { token: chef.token });
  check(
    /attachment; filename="supmeal-export-\d{4}-\d{2}-\d{2}\.json"/.test(
      complet.headers.get('content-disposition') ?? '',
    ),
    'export : fichier daté, proposé en pièce jointe',
  );
  check(
    typeof complet.body.warning === 'string' && complet.body.warning.includes('en clair'),
    "export : l'avertissement sur les données en clair est présent",
  );
  checkEqual(complet.body.recipes.length, 1, 'export : la recette est là');
  checkEqual(complet.body.preferences, PREFERENCES, 'export complet : les préférences y figurent');
  checkEqual(
    complet.body.recipes[0].ingredients[0],
    { name: 'farine', quantity: 200, unit: 'g', note: 'tamisée' },
    'export : les ingrédients gardent quantité, unité et note',
  );

  section('Les trois formats');
  const csv = await callFull('GET', '/export', { token: chef.token, query: { format: 'csv' } });
  check(csv.headers.get('content-type').includes('text/csv'), 'export CSV : bon type de contenu');
  check(csv.body.split('\r\n')[0].includes('en clair'), 'export CSV : la légende porte l avertissement');
  check(csv.body.includes('200|g|farine|tamisée'), 'export CSV : les ingrédients sont décomposés');

  const mealie = await callFull('GET', '/export', {
    token: chef.token,
    query: { format: 'mealie' },
  });
  const recetteMealie = mealie.body[0];
  checkEqual(recetteMealie.name, TARTE.title, 'export Mealie : le titre passe sous « name »');
  checkEqual(recetteMealie.slug, 'tarte-aux-pommes', 'export Mealie : le slug est calculé');
  checkEqual(recetteMealie.prepTime, 'PT20M', 'export Mealie : durée en ISO 8601');
  checkEqual(recetteMealie.performTime, 'PT40M', 'export Mealie : la cuisson passe sous performTime');
  checkEqual(recetteMealie.recipeYield, '6 portions', 'export Mealie : les portions');

  section('Aller-retour, dans les trois formats');
  for (const format of ['json', 'csv', 'mealie']) {
    const exported = await callFull('GET', '/export', { token: chef.token, query: { format } });
    const importeur = await register('importeur-' + format);
    const rapport = await importer(importeur.token, fileOf(exported, format), {
      filename: format === 'csv' ? 'export.csv' : 'export.json',
    });

    checkEqual(rapport.format, format, format + ' : le format est reconnu au contenu, sans être dit');
    checkEqual(rapport.created, 1, format + ' : une recette importée');
    checkEqual(rapport.errors, [], format + ' : aucune erreur');

    const chezLImporteur = await call('GET', '/recipes', { token: importeur.token });
    const reprise = chezLImporteur.items[0];
    checkEqual(reprise.title, TARTE.title, format + ' : le titre est restitué');
    checkEqual(reprise.ownerId, importeur.id, format + " : l'importeur devient créateur");
    checkEqual(reprise.visibility, 'private', format + ' : la recette importée arrive privée');
  }

  section('Import : doublons et erreurs');
  const aRejouer = await callFull('GET', '/export', { token: chef.token });
  const rejoue = await importer(chef.token, JSON.stringify(aRejouer.body), { format: 'json' });
  checkEqual(rejoue.created, 0, 'réimporter son propre export ne crée rien');
  checkEqual(rejoue.skipped, 1, 'la recette déjà possédée est ignorée : import idempotent');

  const partiel = await importer(
    chef.token,
    JSON.stringify({
      recipes: [
        { title: 'Recette valide', steps: ['Cuire'] },
        { title: '', steps: ['Sans titre'] },
        { title: 'Autre recette valide' },
      ],
    }),
    { format: 'json' },
  );
  checkEqual(partiel.created, 2, 'une recette invalide n interrompt pas les autres');
  checkEqual(partiel.errors.length, 1, 'et elle est consignée dans le rapport');
  check(partiel.errors[0].includes('sans titre'), 'le rapport nomme la recette fautive');

  await importer(chef.token, '{ ceci nest pas du json', { format: 'json', expect: 422 });
  check(true, 'un fichier illisible est refusé en 422');

  await importer(chef.token, JSON.stringify({ recipes: [] }), { format: 'json', expect: 422 });
  check(true, 'un fichier sans aucune recette est refusé en 422');

  section('Import : fichier Mealie écrit à la main');
  const mealieBrut = JSON.stringify([
    {
      name: 'Pain maison',
      prepTime: 'PT1H30M',
      performTime: '45 minutes',
      recipeYield: '4 servings',
      orgURL: 'https://exemple.fr/pain',
      tags: [{ name: 'Boulangerie' }],
      recipeCategory: [{ name: 'Petit-déjeuner' }],
      recipeIngredient: [
        { quantity: 500, unit: { name: 'g' }, food: { name: 'farine' }, note: 'T65' },
        { quantity: 1, unit: null, food: null, note: 'sachet de levure' },
      ],
      recipeInstructions: [{ text: 'Pétrir' }, { text: 'Cuire au four' }],
    },
  ]);
  const boulanger = await register('boulanger');
  const rapportMealie = await importer(boulanger.token, mealieBrut, { format: 'mealie' });
  checkEqual(rapportMealie.created, 1, 'fichier Mealie importé');

  const pains = await call('GET', '/recipes', { token: boulanger.token, query: { q: 'pain' } });
  const pain = await call('GET', '/recipes/' + pains.items[0].id, { token: boulanger.token });
  checkEqual(pain.prepTimeMin, 90, 'durée ISO « PT1H30M » lue en 90 minutes');
  checkEqual(pain.cookTimeMin, 45, 'durée en texte libre « 45 minutes » lue elle aussi');
  checkEqual(pain.servings, 4, '« 4 servings » donne 4 portions');
  checkEqual(
    pain.tags.map((tag) => tag.name).sort(),
    ['Boulangerie', 'Petit-déjeuner'],
    'les catégories Mealie rejoignent les tags',
  );
  checkEqual(
    pain.ingredients.map((line) => line.name).sort(),
    ['farine', 'sachet de levure'],
    "sans aliment structuré, la note de Mealie fait office de nom d'ingrédient",
  );

  section('Export d une recette isolée');
  const mesRecettes = await call('GET', '/recipes', { token: chef.token, query: { q: 'tarte' } });
  const tarteId = mesRecettes.items[0].id;
  const uneRecette = await callFull('GET', '/recipes/' + tarteId + '/export', { token: chef.token });
  check(
    /filename="supmeal-tarte-aux-pommes-\d{4}-\d{2}-\d{2}\.json"/.test(
      uneRecette.headers.get('content-disposition') ?? '',
    ),
    'export unitaire : le fichier porte le nom de la recette',
  );
  checkEqual(uneRecette.body.recipes.length, 1, 'export unitaire : une seule recette');
  checkEqual(uneRecette.body.cookbooks, [], 'export unitaire : aucun cookbook');
  checkEqual(uneRecette.body.preferences, null, 'export unitaire : pas de préférences');

  const destinataire = await register('destinataire');
  const recuUnitaire = await importer(destinataire.token, JSON.stringify(uneRecette.body));
  checkEqual(recuUnitaire.created, 1, 'export unitaire : le fichier se réimporte tel quel');

  section('Export d un cookbook');
  const cookbook = await call('POST', '/cookbooks', {
    token: chef.token,
    body: { name: 'Recettes de Noël' },
  });
  await call('POST', '/cookbooks/' + cookbook.id + '/recipes', {
    token: chef.token,
    body: { title: 'Bûche au chocolat', steps: ['Rouler'] },
  });

  const exportCookbook = await callFull('GET', '/cookbooks/' + cookbook.id + '/export', {
    token: chef.token,
  });
  check(
    /filename="supmeal-recettes-de-noel-\d{4}-\d{2}-\d{2}\.json"/.test(
      exportCookbook.headers.get('content-disposition') ?? '',
    ),
    'export cookbook : le fichier porte le nom du cookbook',
  );
  checkEqual(
    exportCookbook.body.recipes.map((recipe) => recipe.title),
    ['Bûche au chocolat'],
    'export cookbook : seules les recettes du cookbook, pas les recettes personnelles',
  );
  checkEqual(
    exportCookbook.body.cookbooks[0].recipeTitles,
    ['Bûche au chocolat'],
    'export cookbook : sa composition est jointe',
  );
  checkEqual(
    exportCookbook.body.preferences,
    null,
    'export cookbook : sans les préférences de celui qui exporte',
  );

  const invite = await register('invite');
  const invitation = await call('POST', '/cookbooks/' + cookbook.id + '/invitations', {
    token: chef.token,
    body: { email: invite.email, role: 'READER' },
  });
  await call('POST', '/invitations/' + invitation.token + '/accept', { token: invite.token });
  const parLeLecteur = await call('GET', '/cookbooks/' + cookbook.id + '/export', {
    token: invite.token,
  });
  checkEqual(parLeLecteur.recipes.length, 1, 'export cookbook : ouvert au lecteur du cookbook');

  const etranger = await register('etranger');
  await call('GET', '/cookbooks/' + cookbook.id + '/export', { token: etranger.token, expect: 404 });
  check(true, 'export cookbook : introuvable pour un non-membre (404)');

  section('Préférences à l import');
  const sansPrefs = await register('sans-prefs');
  const rapportSansPrefs = await importer(sansPrefs.token, JSON.stringify(complet.body));
  checkEqual(
    rapportSansPrefs.preferencesImported,
    false,
    'les préférences ne sont pas reprises par défaut',
  );
  const prefsIntactes = await call('GET', '/users/me/preferences', { token: sansPrefs.token });
  checkEqual(prefsIntactes.allergies, [], 'les préférences du compte sont restées intactes');

  const avecPrefs = await register('avec-prefs');
  const rapportAvecPrefs = await importer(avecPrefs.token, JSON.stringify(complet.body), {
    withPreferences: 'true',
  });
  checkEqual(rapportAvecPrefs.preferencesImported, true, 'withPreferences=true : elles sont reprises');
  const prefsReprises = await call('GET', '/users/me/preferences', { token: avecPrefs.token });
  checkEqual(prefsReprises, PREFERENCES, 'les préférences du fichier remplacent celles du compte');

  const viaCsv = await register('via-csv');
  const rapportCsv = await importer(viaCsv.token, csv.body, {
    filename: 'export.csv',
    withPreferences: 'true',
  });
  checkEqual(
    rapportCsv.preferencesImported,
    false,
    'un CSV ne porte pas de préférences : rien à reprendre, même sur demande',
  );
}

main('Import / Export', run);
