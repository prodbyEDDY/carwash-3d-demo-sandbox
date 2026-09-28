import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Next требует jsx:preserve в tsconfig; vite транспилирует JSX сам.
  oxc: { jsx: { runtime: 'automatic' } },
  // Алиас @/ из tsconfig.paths: компоненты shadcn импортируют через него.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
  },
});
