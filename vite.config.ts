import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

// `base` stays relative so the build works from any folder; `vite build --base=/x/` overrides it.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
