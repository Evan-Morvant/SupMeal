import { spawn, spawnSync } from 'node:child_process';

/**
 * Lance un PostgreSQL jetable, exécute Vitest avec les variables
 * d'environnement de test, puis supprime le conteneur quoi qu'il arrive.
 */
const CONTAINER = 'supmeal-test-db';
const PORT = '55432';
const DATABASE_URL = 'postgres://supmeal:test@localhost:' + PORT + '/supmeal_test';

function docker(args) {
  return spawnSync('docker', args, { encoding: 'utf8' });
}

function cleanup() {
  docker(['rm', '-f', CONTAINER]);
}

async function waitReady(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (docker(['exec', CONTAINER, 'pg_isready', '-U', 'supmeal', '-d', 'supmeal_test']).status === 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Postgres de test non prêt dans les temps');
}

async function main() {
  cleanup();
  console.log('Démarrage du Postgres de test...');
  const run = docker([
    'run', '-d', '--name', CONTAINER,
    '-e', 'POSTGRES_USER=supmeal',
    '-e', 'POSTGRES_PASSWORD=test',
    '-e', 'POSTGRES_DB=supmeal_test',
    '-p', PORT + ':5432',
    'postgres:16-alpine',
  ]);
  if (run.status !== 0) {
    console.error(run.stderr);
    throw new Error('Impossible de démarrer le Postgres de test');
  }
  await waitReady(30000);

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL,
    CLIENT_ORIGIN: 'http://localhost:8080',
    API_PUBLIC_URL: 'http://localhost:4000',
    GITHUB_CLIENT_ID: 'test_github_id',
    GITHUB_CLIENT_SECRET: 'test_github_secret',
    GOOGLE_CLIENT_ID: 'test_google_id',
    GOOGLE_CLIENT_SECRET: 'test_google_secret',
  };

  // Migrations via tsx (Umzug importe des .ts, que seul tsx sait charger).
  console.log('Application des migrations sur la base de test...');
  const migrate = spawnSync('npx', ['tsx', 'src/db/migrate.ts', 'up'], {
    stdio: 'inherit',
    shell: true,
    env,
  });
  if (migrate.status !== 0) {
    throw new Error('Échec des migrations sur la base de test');
  }

  console.log('Lancement de Vitest...\n');
  const vitest = spawn('npx', ['vitest', 'run', ...process.argv.slice(2)], {
    stdio: 'inherit',
    shell: true,
    env,
  });

  vitest.on('exit', (code) => {
    cleanup();
    process.exit(code ?? 1);
  });
}

main().catch((err) => {
  console.error(err);
  cleanup();
  process.exit(1);
});
