import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

/**
 * Socle des scénarios de démonstration du client : pendant de
 * `server/scripts/demo/lib.mjs`, mais un cran plus haut — il conduit un vrai
 * navigateur par le protocole DevTools de Chrome. Voir le README du dossier.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/** Interface à conduire. Le serveur de développement Vite par défaut. */
export const WEB = process.env.WEB_URL ?? 'http://localhost:5173';

/** Mot de passe unique des comptes de démonstration, comme côté serveur. */
export const PASSWORD = 'motdepasse123';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  join(process.env.LOCALAPPDATA ?? '', 'Google\\Chrome\\Application\\chrome.exe'),
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter((path) => typeof path === 'string' && path.length > 0);

/** Nom du scénario en cours, déduit du fichier lancé. */
const SCENARIO = basename(process.argv[1] ?? 'demo.mjs').replace(/\.mjs$/, '');

const SHOTS = resolve(process.env.SHOTS_DIR ?? join(HERE, '..', '..', 'screenshots'), SCENARIO);

let checks = 0;
let shots = 0;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

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

/** Adresse d'un compte propre à cette exécution : les scénarios se rejouent. */
export function account(name) {
  return name + '.' + Date.now() + '@supmeal.test';
}

function findChrome() {
  const found = CHROME_CANDIDATES.find((path) => existsSync(path));
  if (found === undefined) {
    throw new Error(
      'Chrome introuvable. Renseignez CHROME_PATH avec le chemin de l’exécutable.',
    );
  }
  return found;
}

/*
 * Chrome choisit son port (`--remote-debugging-port=0`) et l'écrit dans son
 * profil : deux scénarios lancés de suite ne peuvent donc pas se disputer un
 * numéro fixe.
 */
async function launchChrome() {
  const profile = join(tmpdir(), 'supmeal-demo-' + process.pid);
  mkdirSync(profile, { recursive: true });

  const child = spawn(
    findChrome(),
    [
      ...(process.env.HEADFUL === '1' ? [] : ['--headless=new']),
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--remote-debugging-port=0',
      '--user-data-dir=' + profile,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  const portFile = join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await sleep(200);
    if (existsSync(portFile)) {
      const port = readFileSync(portFile, 'utf8').split('\n')[0].trim();
      if (port.length > 0) {
        return { child, profile, port };
      }
    }
  }
  child.kill();
  throw new Error("Chrome n'a pas ouvert son port de débogage");
}

/** Connexion à une cible et émission de commandes CDP numérotées. */
async function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;

  await new Promise((ok, ko) => {
    socket.addEventListener('open', ok, { once: true });
    socket.addEventListener('error', () => ko(new Error('connexion CDP refusée')), {
      once: true,
    });
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const entry = pending.get(message.id);
    if (entry === undefined) {
      return; // événement non sollicité
    }
    pending.delete(message.id);
    if (message.error !== undefined) {
      entry.ko(new Error(message.error.message));
      return;
    }
    entry.ok(message.result);
  });

  return {
    send(method, params = {}) {
      return new Promise((ok, ko) => {
        const id = nextId;
        nextId += 1;
        pending.set(id, { ok, ko });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => socket.close(),
  };
}

/** Surface offerte aux scénarios. */
function makePage(cdp) {
  const page = {
    /** Navigue vers un chemin de l'application (« /login »). */
    async goto(path) {
      await cdp.send('Page.navigate', { url: WEB + path });
      await sleep(900);
    },

    async evaluate(expression) {
      const result = await cdp.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails !== undefined) {
        throw new Error(result.exceptionDetails.text + ' — ' + expression);
      }
      return result.result.value;
    },

    /*
     * Renseigne un champ comme le ferait une frappe. Poser `.value` seul ne
     * prévient pas React, qui n'écoute que l'événement : le formulaire
     * paraîtrait rempli à l'écran et vide au moment de la soumission.
     */
    async fill(selector, value) {
      await page.evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (el === null) { throw new Error('champ introuvable : ' + ${JSON.stringify(selector)}); }
        // Le setter natif dépend de la balise : celui d'un input appliqué à un
        // select lèverait une « illegal invocation ».
        const proto = el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement
          : el instanceof HTMLSelectElement
            ? HTMLSelectElement
            : HTMLInputElement;
        Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`);
    },

    /*
     * Résout le contrôle d'un libellé, par `for` ou par imbrication. C'est la
     * façon dont un utilisateur désigne un champ — « le champ Titre » — et
     * elle survit au renommage des classes comme au réordonnancement du
     * formulaire. Si le libellé n'existe pas, c'est le formulaire qui est à
     * corriger, pas le sélecteur.
     */
    async controlOfLabel(label) {
      return page.evaluate(`(() => {
        const needle = ${JSON.stringify(label)}.trim().toLowerCase();
        const found = [...document.querySelectorAll('label')].find((node) =>
          (node.textContent ?? '').trim().toLowerCase().startsWith(needle));
        if (found === undefined) { throw new Error('libellé introuvable : ' + needle); }
        const control = found.htmlFor !== ''
          ? document.getElementById(found.htmlFor)
          : found.querySelector('input, select, textarea');
        if (control === null) { throw new Error('libellé sans contrôle : ' + needle); }
        // Marqueur temporaire : donne une prise stable pour l'appel suivant.
        control.dataset.demoTarget = 'y';
        return true;
      })()`);
    },

    /** Renseigne le champ désigné par son libellé, quelle qu'en soit la balise. */
    async fillByLabel(label, value) {
      await page.controlOfLabel(label);
      await page.fill('[data-demo-target]', value);
      await page.evaluate(
        `document.querySelector('[data-demo-target]').removeAttribute('data-demo-target')`,
      );
    },

    async click(selector) {
      await page.evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (el === null) { throw new Error('élément introuvable : ' + ${JSON.stringify(selector)}); }
        el.click();
        return true;
      })()`);
    },

    /**
     * Frappe une touche sur un élément. Sert aux commandes clavier de
     * l'interface — Entrée pour valider un jeton de saisie, Échap pour
     * refermer une liste de suggestions.
     */
    async press(selector, key) {
      await page.evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (el === null) { throw new Error('élément introuvable : ' + ${JSON.stringify(selector)}); }
        el.focus();
        const init = { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true };
        el.dispatchEvent(new KeyboardEvent('keydown', init));
        el.dispatchEvent(new KeyboardEvent('keyup', init));
        return true;
      })()`);
    },

    /** Clique le premier élément dont le texte contient `text`. */
    async clickText(selector, text) {
      await page.evaluate(`(() => {
        const needle = ${JSON.stringify(text)}.toLowerCase();
        const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
          .find((node) => (node.textContent ?? '').toLowerCase().includes(needle));
        if (el === undefined) { throw new Error('texte introuvable : ' + needle); }
        el.click();
        return true;
      })()`);
    },

    async waitFor(selector, timeout = 10000) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        if (await page.exists(selector)) {
          return;
        }
        await sleep(150);
      }
      throw new Error('attente dépassée pour : ' + selector);
    },

    /**
     * Attend qu'un texte apparaisse. Nécessaire là où l'écran passe par un
     * état de chargement : le rail est en place bien avant que la liste des
     * recettes ne soit revenue du réseau.
     */
    async waitForText(selector, text, timeout = 10000) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const content = await page.text(selector);
        if (content.toLowerCase().includes(text.toLowerCase())) {
          return;
        }
        await sleep(200);
      }
      throw new Error('texte jamais apparu dans ' + selector + ' : ' + text);
    },

    async exists(selector) {
      return page.evaluate(`document.querySelector(${JSON.stringify(selector)}) !== null`);
    },

    async count(selector) {
      return page.evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
    },

    async text(selector) {
      return page.evaluate(
        `(document.querySelector(${JSON.stringify(selector)})?.textContent ?? '').trim()`,
      );
    },

    /** Chemin courant, pour vérifier qu'une redirection a bien eu lieu. */
    async path() {
      return page.evaluate('location.pathname + location.search');
    },

    async wait(ms) {
      await sleep(ms);
    },

    async resize(width, height) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 860,
      });
      await sleep(350);
    },

    /**
     * Capture destinée au manuel utilisateur. On attend les polices : sans
     * cela la première image du lot sort composée en police de repli.
     */
    async shot(name, options = {}) {
      await page.evaluate('document.fonts.ready.then(() => true)');
      await sleep(120);
      /*
       * En capture pleine page, un élément `sticky` se fige au milieu de
       * l'image : le rail de navigation apparaîtrait flottant à mi-hauteur.
       * On le rend statique le temps du cliché.
       */
      if (options.full === true) {
        // Seuls les éléments réellement `sticky` sont touchés : tout remettre
        // en `static` casserait les positionnements absolus de l'interface.
        await page.evaluate(`(() => {
          window.__demoStuck = [...document.querySelectorAll('*')]
            .filter((el) => getComputedStyle(el).position === 'sticky');
          window.__demoStuck.forEach((el) => { el.style.position = 'relative'; });
          window.scrollTo(0, 0);
          return window.__demoStuck.length;
        })()`);
        await sleep(150);
      }
      const result = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: options.full === true,
      });
      if (options.full === true) {
        await page.evaluate(
          `(window.__demoStuck ?? []).forEach((el) => { el.style.position = ''; }) ?? true`,
        );
      }
      mkdirSync(SHOTS, { recursive: true });
      const file = join(SHOTS, name + '.png');
      writeFileSync(file, Buffer.from(result.data, 'base64'));
      shots += 1;
      console.log('  img ' + name + '.png');
      return file;
    },

    /** Erreurs remontées par la page, collectées depuis son chargement. */
    async pageErrors() {
      return page.evaluate('JSON.stringify(window.__demoErrors ?? [])');
    },
  };

  return page;
}

/**
 * Enveloppe d'un scénario : ouvre le navigateur, joue le parcours, rend
 * compte, et referme quoi qu'il arrive.
 */
export async function main(run, options = {}) {
  const started = Date.now();
  let chrome;
  let browser;
  const opened = [];

  try {
    chrome = await launchChrome();
    const version = await (await fetch(`http://127.0.0.1:${chrome.port}/json/version`)).json();
    browser = await connect(version.webSocketDebuggerUrl);

    /*
     * Chaque page ouverte vit dans son propre contexte de navigation : stockage
     * et cookies isolés, donc **une session par page**. C'est ce qui permet à
     * un scénario de faire dialoguer deux comptes à la fois, seule façon
     * d'éprouver une diffusion temps réel.
     */
    async function openPage() {
      const { browserContextId } = await browser.send('Target.createBrowserContext');
      const { targetId } = await browser.send('Target.createTarget', {
        url: 'about:blank',
        browserContextId,
      });
      const cdp = await connect(
        `ws://127.0.0.1:${chrome.port}/devtools/page/${targetId}`,
      );

      await cdp.send('Page.enable');
      await cdp.send('Runtime.enable');
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: options.width ?? 1280,
        height: options.height ?? 900,
        deviceScaleFactor: 1,
        mobile: false,
      });

      // Posé avant toute navigation : une erreur muette à l'écran doit se voir.
      await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `window.__demoErrors = [];
          window.addEventListener('error', (e) => window.__demoErrors.push(String(e.message)));
          window.addEventListener('unhandledrejection', (e) => window.__demoErrors.push(String(e.reason)));`,
      });

      const page = makePage(cdp);
      /** Ouvre une seconde page, indépendante : autre session, autre compte. */
      page.fork = openPage;
      opened.push({ cdp, browserContextId });
      return page;
    }

    console.log('=== ' + SCENARIO + ' — ' + WEB);
    await run(await openPage());

    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      '\n' + checks + ' vérification(s), ' + shots + ' capture(s), ' + seconds + ' s.',
    );
  } catch (error) {
    console.error('\nECHEC — ' + error.message);
    process.exitCode = 1;
  } finally {
    for (const entry of opened) {
      entry.cdp.close();
      await browser
        ?.send('Target.disposeBrowserContext', { browserContextId: entry.browserContextId })
        .catch(() => undefined);
    }
    browser?.close();
    chrome?.child.kill();
    if (chrome !== undefined) {
      await sleep(400);
      /*
       * Le profil est jetable, mais sous Windows Chrome garde un instant la
       * main sur ses fichiers de télémétrie : l'effacement est tenté, jamais
       * exigé. Le faire échouer ici masquerait le résultat du scénario, qui
       * est la seule chose qui compte.
       */
      try {
        rmSync(chrome.profile, { recursive: true, force: true, maxRetries: 3 });
      } catch {
        /* un dossier temporaire de plus, sans conséquence */
      }
    }
  }
}
