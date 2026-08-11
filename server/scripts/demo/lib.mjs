/**
 * Socle commun aux scénarios de démonstration.
 *
 * Ces scripts s'adressent à une API réellement en marche, là où les tests
 * d'intégration montent l'application en mémoire sur une base jetable : ils
 * vérifient donc aussi ce que les tests ne voient pas — le serveur démarre,
 * les migrations sont passées, la configuration tient debout.
 *
 * Chaque scénario crée ses propres comptes, horodatés, et ne suppose rien de
 * l'état de la base : ils se rejouent autant de fois que voulu, dans
 * n'importe quel ordre, sans purge préalable.
 */

export const API = process.env.API_URL ?? 'http://localhost:4000';
export const BASE = API + '/api/v1';

/** Mot de passe unique des comptes de démonstration. */
export const PASSWORD = 'motdepasse123';

/** Horodatage de la série, pour que deux exécutions ne se marchent pas dessus. */
const RUN = Date.now();
let accountSeq = 0;
let checks = 0;

export function section(title) {
  console.log('\n--- ' + title);
}

export function log(step, detail) {
  console.log('    ' + step + ' : ' + detail);
}

/** Vérification attendue vraie. L'échec interrompt le scénario. */
export function check(condition, label) {
  if (!condition) {
    throw new Error(label);
  }
  checks += 1;
  console.log('  ok  ' + label);
}

/** Vérification d'égalité, qui montre l'écart plutôt que de le taire. */
export function checkEqual(actual, expected, label) {
  const shown = JSON.stringify(actual);
  const wanted = JSON.stringify(expected);
  if (shown !== wanted) {
    throw new Error(label + '\n      attendu : ' + wanted + '\n      reçu    : ' + shown);
  }
  checks += 1;
  console.log('  ok  ' + label);
}

async function readBody(res) {
  const text = await res.text();
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    // Les exports CSV ne sont pas du JSON : le texte brut fait l'affaire.
    return text;
  }
}

/**
 * Contrôle du code de retour. `expect` sert aux cas où l'échec *est* le
 * comportement attendu (403 sur une recette d'autrui, 404 sur un cookbook dont
 * on n'est pas membre) : ces refus valent démonstration au même titre que les
 * succès. Une liste de codes couvre ce qui dépend de la configuration de
 * l'instance plutôt que du code, comme un fournisseur OAuth2 renseigné ou non.
 */
async function handle(method, path, res, expect) {
  const body = await readBody(res);
  const accepted = expect === undefined ? null : [expect].flat();

  // Le limiteur anti-bruteforce plafonne les routes d'authentification, et une
  // série complète crée bien plus de comptes que la valeur par défaut n'en
  // tolère : le dire ici évite de chercher l'erreur dans le scénario.
  if (res.status === 429 && !(accepted ?? []).includes(429)) {
    throw new Error(
      method + ' ' + path + " -> 429 : plafond du limiteur atteint.\n" +
        '      Relancez l API avec AUTH_RATE_LIMIT_MAX=100000 pour jouer la série entière.',
    );
  }

  if (accepted === null) {
    if (!res.ok) {
      throw new Error(method + ' ' + path + ' -> ' + res.status + ' ' + JSON.stringify(body));
    }
  } else if (!accepted.includes(res.status)) {
    throw new Error(
      method +
        ' ' +
        path +
        ' -> attendu ' +
        accepted.join(' ou ') +
        ', reçu ' +
        res.status +
        ' ' +
        JSON.stringify(body),
    );
  }
  return body;
}

/** Appel JSON. Rend la réponse complète, en-têtes compris. */
export async function callFull(method, path, { token, body, expect, query } = {}) {
  const url = new URL(BASE + path);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const res = await fetch(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token === undefined ? {} : { Authorization: 'Bearer ' + token }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { status: res.status, headers: res.headers, body: await handle(method, path, res, expect) };
}

/** Appel JSON réduit au corps de la réponse, cas de loin le plus courant. */
export async function call(method, path, options = {}) {
  const { body } = await callFull(method, path, options);
  return body;
}

/** Envoi d'un fichier en multipart : image de recette, fichier d'import. */
export async function sendFile(path, { token, filename, contentType, content, fields, expect } = {}) {
  const form = new FormData();
  Object.entries(fields ?? {}).forEach(([key, value]) => form.append(key, value));
  form.append('file', new Blob([content], { type: contentType }), filename);

  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: token === undefined ? {} : { Authorization: 'Bearer ' + token },
    body: form,
  });
  return handle('POST', path, res, expect);
}

/**
 * Compte neuf, immédiatement utilisable. L'identifiant est relu sur `/auth/me`,
 * que l'inscription ne renvoie pas : les scénarios en ont besoin pour désigner
 * un membre ou vérifier une propriété.
 */
export async function register(prefix) {
  accountSeq += 1;
  const email = prefix + '-' + RUN + '-' + accountSeq + '@demo.fr';
  const tokens = await call('POST', '/auth/register', {
    body: { email, password: PASSWORD, displayName: prefix },
  });
  const profile = await call('GET', '/auth/me', { token: tokens.accessToken });

  return {
    id: profile.id,
    email,
    displayName: prefix,
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

/** PNG 1x1 valide, de quoi exercer l'upload sans embarquer d'image réelle. */
export const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Date décalée de `days` jours, au format attendu par le planning. */
export function isoDate(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function ping() {
  try {
    await call('GET', '/health');
  } catch (err) {
    throw new Error(
      'API injoignable sur ' +
        API +
        "\n      Lancez « npm run dev » dans server/, ou pointez ailleurs avec API_URL.\n      Détail : " +
        err.message,
    );
  }
}

/**
 * Point d'entrée commun : vérifie que l'API répond, joue le scénario, puis
 * sort avec un code non nul au moindre écart — ce que le script d'ensemble
 * comme un enchaînement CI savent lire.
 */
export async function main(title, run) {
  console.log('=== ' + title + ' (' + API + ')');
  try {
    await ping();
    await run();
  } catch (err) {
    console.error('\nECHEC : ' + err.message);
    process.exit(1);
  }
  console.log('\n=== ' + title + ' : ' + checks + ' vérification(s) OK');
  // Sortie explicite : un WebSocket encore ouvert retiendrait sinon le process.
  process.exit(0);
}
