import { defineConfig, mergeConfig } from 'vitest/config';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import browserConfig from '../wellcircle-web/vite.config.js';
import { fileURLToPath } from 'node:url';

export default mergeConfig(browserConfig, defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { alias: [
    { find: '@testing-library/react', replacement: require.resolve('@testing-library/react') },
  ] },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: [fileURLToPath(new URL('./src/test/setup.js', import.meta.url))],
    include: ['../wellcircle-web/src/test/**/*.test.{js,jsx}'],
    restoreMocks: true,
    css: false,
    env: { VITE_USE_MOCK: 'true', VITE_APP_SURFACE: 'web' },
  },
}));
