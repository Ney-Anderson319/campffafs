import { defineConfig } from 'vitest/config';

// Testes das regras de segurança. Rodam contra os emuladores do Firebase:
//   npm run test:rules
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
