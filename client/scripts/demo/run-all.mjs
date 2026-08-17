import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Joue tous les scénarios de démonstration du client à la suite, chacun dans
 * son propre processus — donc avec son propre navigateur et son propre
 * profil : un scénario qui échoue n'entraîne pas les autres, et aucune
 * session ne fuit de l'un vers le suivant.
 *
 * Usage : node scripts/demo/run-all.mjs [nom ...]
 *   sans argument, tous les scénarios ; sinon ceux nommés (« node
 *   scripts/demo/run-all.mjs auth »).
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/** Ordre de lecture : de l'entrée dans l'application vers ses fonctions. */
const SCENARIOS = ['auth', 'recettes', 'decouverte', 'cookbooks', 'messagerie'];

function runScenario(name) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(HERE, name + '.mjs')], { stdio: 'inherit' });
    child.on('exit', (code) => resolve(code === 0));
  });
}

async function main() {
  const asked = process.argv.slice(2);
  const unknown = asked.filter((name) => !SCENARIOS.includes(name));
  if (unknown.length > 0) {
    console.error('Scénario inconnu : ' + unknown.join(', '));
    console.error('Disponibles : ' + SCENARIOS.join(', '));
    process.exit(1);
  }

  const selected = asked.length > 0 ? asked : SCENARIOS;
  const failed = [];

  for (const name of selected) {
    const ok = await runScenario(name);
    if (!ok) {
      failed.push(name);
    }
    console.log('');
  }

  console.log('======================================');
  selected.forEach((name) => {
    console.log('  ' + (failed.includes(name) ? 'ECHEC' : 'ok   ') + '  ' + name);
  });

  if (failed.length > 0) {
    console.error('\n' + failed.length + ' scénario(s) en échec sur ' + selected.length + '.');
    process.exit(1);
  }
  console.log('\n' + selected.length + ' scénario(s) joués sans erreur.');
}

main();
