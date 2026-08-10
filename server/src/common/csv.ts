/**
 * Lecture et écriture CSV conformes au RFC 4180 : séparateur virgule,
 * guillemets doublés pour l'échappement, sauts de ligne autorisés à
 * l'intérieur d'un champ entre guillemets.
 *
 * Écrit à la main plutôt qu'ajouté en dépendance : le besoin se limite à ces
 * deux fonctions, et le cas qui compte vraiment - les cellules multilignes
 * produites par Excel ou LibreOffice - est justement celui que le RFC décrit.
 */

import { stripBom } from './text';

const QUOTE = '"';
const DELIMITER = ',';

/** Caractères qui obligent à entourer le champ de guillemets. */
const NEEDS_QUOTING = /["\r\n,]/;

function escapeField(value: string): string {
  if (!NEEDS_QUOTING.test(value)) {
    return value;
  }
  return QUOTE + value.split(QUOTE).join(QUOTE + QUOTE) + QUOTE;
}

/** Sérialise des lignes de cellules. Les fins de ligne sont en CRLF (RFC 4180). */
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeField).join(DELIMITER)).join('\r\n');
}

/**
 * Analyse un document CSV en tableau de lignes. Les lignes entièrement vides
 * sont écartées : un fichier se terminant par un saut de ligne ne doit pas
 * produire une dernière ligne fantôme.
 */
export function parseCsv(text: string): string[][] {
  const input = stripBom(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let index = 0;

  const endField = (): void => {
    row.push(field);
    field = '';
  };
  const endRow = (): void => {
    endField();
    rows.push(row);
    row = [];
  };

  while (index < input.length) {
    const char = input[index];

    if (quoted) {
      // Un guillemet doublé à l'intérieur d'un champ cité vaut un guillemet.
      if (char === QUOTE && input[index + 1] === QUOTE) {
        field += QUOTE;
        index += 2;
        continue;
      }
      if (char === QUOTE) {
        quoted = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    // Un guillemet n'ouvre un champ cité qu'en première position : ailleurs,
    // c'est un caractère ordinaire.
    if (char === QUOTE && field === '') {
      quoted = true;
      index += 1;
      continue;
    }
    if (char === DELIMITER) {
      endField();
      index += 1;
      continue;
    }
    if (char === '\r' || char === '\n') {
      endRow();
      index += char === '\r' && input[index + 1] === '\n' ? 2 : 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (field !== '' || row.length > 0) {
    endRow();
  }
  return rows.filter((cells) => cells.some((cell) => cell !== ''));
}
