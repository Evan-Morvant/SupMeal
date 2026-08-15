import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Joue tous les scénarios de démonstration à la suite, chacun dans son propre
 * processus : un scénario qui échoue n'entraîne pas les autres, et le
 * cloisonnement est réel, pas seulement de principe.
 *
 * Usage : node scripts/demo/run-all.mjs [nom ...]
 *   sans argument, tous les scénarios ; sinon ceux nommés (« node
 *   scripts/demo/run-all.mjs recipes search »).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Ordre de lecture : des fondations vers les fonctionnalités composées. */
const SCENARIOS = [
  'auth',
  'users',
  'recipes',
  'search',
  'catalog',
  'suggestions',
  'reviews',
  'cookbooks',
  'comments',
  'meal-plan',
  'shopping-lists',
  'chat',
  'import-export',
];

function runScenario(name) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(HERE, name + '.mjs')], {
      stdio: 'inherit',
    });
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
