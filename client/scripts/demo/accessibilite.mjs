import { PASSWORD, account, check, checkEqual, log, main, section } from './lib.mjs';

/**
 * Audit d'accessibilité, passé sur chaque écran principal. Il ne remplace pas
 * un test avec un lecteur d'écran, mais il attrape ce qui se vérifie sans
 * jugement : un bouton sans nom, une image sans alternative, un champ sans
 * libellé, une hiérarchie de titres trouée.
 *
 * Usage : node scripts/demo/accessibilite.mjs
 */

/**
 * Relevé des manquements d'une page. Exécuté dans le navigateur, sur le DOM
 * réellement rendu — les éléments masqués sont écartés, ils ne concernent
 * personne.
 */
const AUDIT = `(() => {
  const problemes = [];
  const visible = (el) => {
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };

  // Un nom accessible : contenu textuel, aria-label, ou titre d'image.
  const nom = (el) => {
    const aria = el.getAttribute('aria-label');
    if (aria !== null && aria.trim() !== '') { return aria; }
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy !== null) {
      const cible = document.getElementById(labelledBy);
      if (cible !== null && (cible.textContent ?? '').trim() !== '') { return cible.textContent; }
    }
    const texte = (el.innerText ?? el.textContent ?? '').trim();
    if (texte !== '') { return texte; }
    const image = el.querySelector('img[alt]:not([alt=""]), svg[aria-label]');
    return image === null ? '' : 'image';
  };

  const titres = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(visible);
  const niveaux = titres.map((el) => Number(el.tagName.slice(1)));
  const h1 = niveaux.filter((n) => n === 1).length;
  if (h1 !== 1) { problemes.push('titres : ' + h1 + ' <h1> au lieu d un seul'); }
  niveaux.forEach((niveau, index) => {
    if (index > 0 && niveau > niveaux[index - 1] + 1) {
      problemes.push('titres : saut de h' + niveaux[index - 1] + ' a h' + niveau + ' (' + titres[index].innerText.slice(0, 30) + ')');
    }
  });

  [...document.querySelectorAll('img')].filter(visible).forEach((img) => {
    if (img.getAttribute('alt') === null && img.getAttribute('aria-hidden') !== 'true') {
      problemes.push('image sans alternative : ' + img.src.slice(-40));
    }
  });

  [...document.querySelectorAll('button, a[href]')].filter(visible).forEach((el) => {
    if (nom(el).trim() === '') {
      problemes.push('commande sans nom accessible : <' + el.tagName.toLowerCase() + '> ' + (el.className || '').slice(0, 30));
    }
  });

  [...document.querySelectorAll('input, select, textarea')].filter(visible).forEach((el) => {
    const parLabel = el.id !== '' && document.querySelector('label[for="' + CSS.escape(el.id) + '"]') !== null;
    const imbrique = el.closest('label') !== null;
    if (!parLabel && !imbrique && (el.getAttribute('aria-label') ?? '') === '') {
      problemes.push('champ sans libelle : ' + el.tagName.toLowerCase() + ' ' + (el.type ?? ''));
    }
  });

  /*
   * Contraste du texte sur son fond effectif. WCAG AA demande 4.5:1, ou 3:1
   * pour un texte large (18,66 px, ou 14 px en gras). Le fond se cherche en
   * remontant les ancetres : un element transparent n'en a pas.
   */
  const canal = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const luminance = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
  const lire = (couleur) => {
    const parts = couleur.match(/[0-9.]+/g);
    return parts === null ? null : parts.slice(0, 3).map(Number);
  };
  /*
   * Une couleur de texte semi-transparente doit etre composee sur son fond
   * avant d'etre mesuree : la lire telle quelle reviendrait a evaluer l'encre
   * pleine, et laisserait passer precisement les teintes les plus pales.
   */
  const alphaDe = (couleur) => {
    const parts = couleur.match(/[0-9.]+/g);
    return parts !== null && parts.length > 3 ? Number(parts[3]) : 1;
  };
  const composer = (couleur, fond) => {
    const a = alphaDe(couleur);
    const c = lire(couleur);
    return c === null ? null : c.map((v, i) => a * v + (1 - a) * fond[i]);
  };
  const opaque = (couleur) => {
    const parts = couleur.match(/[0-9.]+/g);
    return parts !== null && (parts.length < 4 || Number(parts[3]) > 0.95);
  };
  const fondDe = (el) => {
    let noeud = el;
    while (noeud !== null) {
      const fond = getComputedStyle(noeud).backgroundColor;
      if (opaque(fond) && fond !== 'transparent') { return lire(fond); }
      noeud = noeud.parentElement;
    }
    return [255, 255, 255];
  };

  const porteurs = [...document.querySelectorAll('p, span, a, button, li, h1, h2, h3, label, dd, dt')]
    .filter(visible)
    .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== ''));

  const vus = new Set();
  porteurs.forEach((el) => {
    const style = getComputedStyle(el);
    const fond = fondDe(el);
    const texte = composer(style.color, fond);
    if (texte === null) { return; }
    const clair = Math.max(luminance(texte), luminance(fond));
    const sombre = Math.min(luminance(texte), luminance(fond));
    const rapport = (clair + 0.05) / (sombre + 0.05);
    const taille = parseFloat(style.fontSize);
    const gras = Number(style.fontWeight) >= 700;
    const seuil = taille >= 24 || (taille >= 18.66 && gras) ? 3 : 4.5;
    if (rapport < seuil) {
      const cle = style.color + '|' + rapport.toFixed(2);
      if (!vus.has(cle)) {
        vus.add(cle);
        problemes.push(
          'contraste ' + rapport.toFixed(2) + ':1 (seuil ' + seuil + ') — ' +
          style.color + ' sur fond, ex. « ' + (el.innerText ?? '').trim().slice(0, 30) + ' »',
        );
      }
    }
  });

  // Plusieurs reperes de meme role doivent se distinguer par leur nom.
  ['nav', 'main'].forEach((role) => {
    const reperes = [...document.querySelectorAll(role)].filter(visible);
    if (reperes.length > 1) {
      const nommes = reperes.filter((el) => (el.getAttribute('aria-label') ?? '') !== '');
      if (nommes.length < reperes.length) {
        problemes.push(reperes.length + ' <' + role + '> dont ' + (reperes.length - nommes.length) + ' sans nom');
      }
    }
  });

  return problemes;
})()`;

async function auditer(page, chemin, libelle) {
  await page.goto(chemin);
  await page.wait(1100);
  const problemes = await page.evaluate(AUDIT);
  problemes.forEach((probleme) => log(libelle, probleme));
  checkEqual(problemes, [], 'aucun manquement sur ' + libelle);
}

main(async (page) => {
  section('Pages ouvertes aux visiteurs');
  await auditer(page, '/', 'accueil visiteur');
  await auditer(page, '/discover', 'découverte');
  await auditer(page, '/login', 'connexion');
  await auditer(page, '/register', 'inscription');
  await auditer(page, '/cgu', 'conditions d’utilisation');

  section('Espace connecté');
  await page.goto('/register');
  await page.waitFor('form');
  await page.fillByLabel('Nom affiché', 'Camille Roux');
  await page.fillByLabel('Adresse e-mail', account('a11y'));
  await page.fillByLabel('Mot de passe', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitFor('nav[aria-label="Navigation principale"]');

  await page.goto('/recipes/new');
  await page.waitFor('form');
  await page.fillByLabel('Titre', 'Recette accessible');
  await page.fill('[aria-label^="Nom de l"][aria-label$="1"]', 'sel');
  await page.fill('[aria-label="Étape 1"]', 'Mélanger.');
  await page.clickText('button[type="submit"]', 'Enregistrer la recette');
  await page.waitFor('h1');
  await page.wait(700);
  const detail = await page.path();

  await auditer(page, '/recipes', 'mes recettes');
  await auditer(page, detail, 'détail de recette');
  await auditer(page, '/recipes/new', 'formulaire de recette');
  await auditer(page, '/cookbooks', 'cookbooks');
  await auditer(page, '/planning', 'planning');
  await auditer(page, '/shopping-lists', 'listes de courses');
  await auditer(page, '/settings', 'paramètres');
  await auditer(page, '/settings/preferences', 'préférences');
  await auditer(page, '/settings/donnees', 'données');

  section('Navigation au clavier');
  // Le focus doit rester visible : sans anneau, on ne sait plus où l'on est.
  const anneau = await page.evaluate(`(() => {
    const cible = document.querySelector('main a, main button');
    cible.focus();
    const style = getComputedStyle(cible, ':focus-visible');
    return style.outlineStyle !== 'none' || style.outlineWidth !== '0px';
  })()`);
  check(anneau === true, 'les éléments focalisables portent un anneau de focus');

  checkEqual(await page.pageErrors(), '[]', 'aucune erreur de page pendant l’audit');
});
