import zlib from 'zlib';

/**
 * Visuel de couverture des recettes du jeu de données.
 *
 * Une base « vivante » sans images donne une grille de vignettes vides, ce qui
 * dessert l'application autant qu'une base creuse. Faute de photographies
 * libres de droits embarquables dans le dépôt, on peint ici un aplat dérivé du
 * titre : anneaux concentriques repris du logo, teinte tirée entre le corail et
 * le violet de la charte. Ce n'est pas une photo et ça n'essaie pas de le
 * faire croire — c'est une couverture, comme une jaquette de livre.
 *
 * L'encodeur PNG est écrit ici plutôt qu'importé : le serveur n'a aucune
 * dépendance de traitement d'image, et en ajouter une pour un script de
 * peuplement serait payer cher un aplat de 720 pixels de large.
 */

const LARGEUR = 720;
const HAUTEUR = 480;

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const TABLE_CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let reste = n;
    for (let bit = 0; bit < 8; bit += 1) {
      reste = (reste & 1) === 1 ? 0xedb88320 ^ (reste >>> 1) : reste >>> 1;
    }
    table[n] = reste;
  }
  return table;
})();

function crc32(buffer) {
  let reste = 0xffffffff;
  for (const octet of buffer) {
    reste = TABLE_CRC[(reste ^ octet) & 0xff] ^ (reste >>> 8);
  }
  return (reste ^ 0xffffffff) >>> 0;
}

/** Bloc PNG : longueur, type, données, CRC calculé sur type + données. */
function bloc(type, donnees) {
  const entete = Buffer.alloc(8);
  entete.writeUInt32BE(donnees.length, 0);
  entete.write(type, 4, 'ascii');

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([entete.subarray(4), donnees])), 0);
  return Buffer.concat([entete, donnees, crc]);
}

/** Encodage PNG truecolor 8 bits, sans filtre de ligne (octet 0 en tête). */
function encoderPng(largeur, hauteur, pixels) {
  const ligne = largeur * 3;
  const brut = Buffer.alloc((ligne + 1) * hauteur);
  for (let y = 0; y < hauteur; y += 1) {
    pixels.copy(brut, y * (ligne + 1) + 1, y * ligne, (y + 1) * ligne);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 2; // truecolor RGB

  return Buffer.concat([
    SIGNATURE,
    bloc('IHDR', ihdr),
    bloc('IDAT', zlib.deflateSync(brut, { level: 9 })),
    bloc('IEND', Buffer.alloc(0)),
  ]);
}

function hslVersRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, v, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  return [(r + m) * 255, (v + m) * 255, (b + m) * 255];
}

/** Empreinte stable du titre : la même recette garde la même couverture. */
function empreinte(texte) {
  let valeur = 2166136261;
  for (let i = 0; i < texte.length; i += 1) {
    valeur ^= texte.charCodeAt(i);
    valeur = Math.imul(valeur, 16777619);
  }
  return (valeur >>> 0) / 4294967295;
}

/**
 * Teinte tirée entre le corail (14°) et le violet (247°) en passant par les
 * magentas, jamais par les verts : la charte reste lisible d'une carte à
 * l'autre.
 */
function teinte(t) {
  return (14 - 127 * t + 360) % 360;
}

/** Couverture de deux couleurs sur trois : au-delà, ça n'a plus l'air choisi. */
function melanger(fond, dessus, opacite) {
  return [
    fond[0] + (dessus[0] - fond[0]) * opacite,
    fond[1] + (dessus[1] - fond[1]) * opacite,
    fond[2] + (dessus[2] - fond[2]) * opacite,
  ];
}

/** Bord adouci sur un pixel et demi : sans quoi le disque crénelle. */
function couverture(distance, rayon) {
  return Math.min(1, Math.max(0, (rayon - distance) / 1.5));
}

export function coverPng(titre) {
  const graine = empreinte(titre);
  const variante = (graine * 7) % 1;
  const h = teinte(graine);

  // Une seule figure : l'assiette du logo, cadrée de trop près pour tenir
  // entière. C'est ce recadrage qui fait la composition.
  const rayon = HAUTEUR * (0.46 + variante * 0.24);
  const centreX = LARGEUR * (0.18 + graine * 0.7);
  const centreY = HAUTEUR * (0.3 + variante * 0.4);
  const anneau = rayon * 0.74;

  const disque = hslVersRgb(h, 0.42, 0.74);
  const trait = hslVersRgb(h, 0.44, 0.84);

  const pixels = Buffer.alloc(LARGEUR * HAUTEUR * 3);
  for (let y = 0; y < HAUTEUR; y += 1) {
    // Dégradé vertical du fond, du plus clair en haut.
    const fond = hslVersRgb(h, 0.26, 0.96 - (y / HAUTEUR) * 0.07);
    for (let x = 0; x < LARGEUR; x += 1) {
      const distance = Math.hypot(x - centreX, y - centreY);
      let couleur = melanger(fond, disque, couverture(distance, rayon));
      // Anneau intérieur, seul rappel du cadran de temps de l'application.
      const surLAnneau = 1 - Math.min(1, Math.abs(distance - anneau) / 2.5);
      couleur = melanger(couleur, trait, surLAnneau * 0.9);

      const p = (y * LARGEUR + x) * 3;
      pixels[p] = couleur[0];
      pixels[p + 1] = couleur[1];
      pixels[p + 2] = couleur[2];
    }
  }

  return encoderPng(LARGEUR, HAUTEUR, pixels);
}
