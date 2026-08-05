import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Une seule base de test partagée -> pas de parallélisme entre fichiers.
    fileParallelism: false,
    setupFiles: ['test/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
