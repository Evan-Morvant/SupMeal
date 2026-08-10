import { describe, it, expect } from 'vitest';
import { parseCsv, toCsv } from '../src/common/csv';

describe('Utilitaire CSV', () => {
  it('cite les champs qui contiennent un séparateur, un guillemet ou un saut de ligne', () => {
    const csv = toCsv([['simple', 'a,b', 'il a dit "oui"', 'ligne1\nligne2']]);
    expect(csv).toBe('simple,"a,b","il a dit ""oui""","ligne1\nligne2"');
  });

  it('relit ce qu\'il a écrit, y compris les cellules multilignes', () => {
    const rows = [
      ['title', 'steps'],
      ['Tarte, maison', 'Mélanger\nCuire 40 "min"'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it('accepte les fins de ligne CRLF comme LF', () => {
    expect(parseCsv('a,b\r\nc,d\ne,f')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ]);
  });

  it('ignore le BOM et la ligne vide finale', () => {
    expect(parseCsv('﻿title,tags\r\nTarte,dessert\r\n')).toEqual([
      ['title', 'tags'],
      ['Tarte', 'dessert'],
    ]);
  });

  it('traite un guillemet en milieu de champ comme un caractère ordinaire', () => {
    expect(parseCsv('moule 5" de diamètre,ok')).toEqual([['moule 5" de diamètre', 'ok']]);
  });
});
