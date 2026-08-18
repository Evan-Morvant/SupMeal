import { Client } from 'pg';

/**
 * Réécriture des horodatages.
 *
 * Tout le peuplement passe par l'API : c'est ce qui garantit qu'il ne contient
 * rien d'impossible. Mais l'API horodate au présent, et une base « utilisée
 * depuis huit mois » dont toutes les lignes datent de la même seconde se
 * trahit au premier coup d'œil — dans un fil de discussion surtout, où
 * quarante messages afficheraient la même heure.
 *
 * Cette passe finale est donc écrite en SQL, faute d'un champ que l'API
 * accepterait, et elle ne touche qu'aux dates de création : rien n'y est
 * inséré, rien n'y est supprimé.
 */

/**
 * Connexion d'essai, jouée avant la moindre écriture. Sans elle, une URL
 * erronée ne se découvrirait qu'à la dernière étape, sur une base déjà
 * remplie de lignes datées d'aujourd'hui.
 */
export async function verifierAcces(url) {
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.end();
}

export async function appliquerDates(url, entrees, journaliser) {
  const parTable = new Map();
  for (const { table, id, at } of entrees) {
    if (!parTable.has(table)) {
      parTable.set(table, []);
    }
    parTable.get(table).push([id, at]);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    // Toutes les tables ne portent pas `updated_at` : les invitations et les
    // messages, par exemple, ne se modifient pas.
    const { rows } = await client.query(
      "SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at'",
    );
    const modifiables = new Set(rows.map((row) => row.table_name));

    for (const [table, lignes] of parTable) {
      // Une seule requête par table : la liste des couples est passée en
      // paramètres et jointe à la table par identifiant.
      const valeurs = lignes
        .map((_, i) => '($' + (i * 2 + 1) + '::uuid, $' + (i * 2 + 2) + '::timestamptz)')
        .join(', ');
      const parametres = lignes.flat();

      // `updated_at` suit `created_at` : une recette créée il y a huit mois et
      // modifiée « aujourd'hui » sortirait en tête du tri par date de mise à
      // jour.
      await client.query(
        'UPDATE ' + table + ' AS cible SET created_at = source.moment' +
          (modifiables.has(table) ? ', updated_at = source.moment' : '') +
          ' FROM (VALUES ' + valeurs + ') AS source(id, moment) WHERE cible.id = source.id',
        parametres,
      );
      journaliser(table, lignes.length);
    }
  } finally {
    await client.end();
  }
}

/**
 * Suppression ciblée des comptes du jeu de données, pour le rejouer à neuf.
 * Les cascades de la base emportent recettes, cookbooks et discussions ; rien
 * d'autre n'est touché, les comptes créés à la main comme ceux des scénarios
 * de démonstration restent en place.
 */
export async function effacerComptes(url, domaine, journaliser) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rowCount } = await client.query('DELETE FROM users WHERE email LIKE $1', [
      '%@' + domaine,
    ]);
    journaliser(rowCount);
  } finally {
    await client.end();
  }
}
