import preact from '@preact/preset-vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [preact()],
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  // The e2e suite (playwright.config.ts) runs without HMR so edits made while it runs cannot reload pages mid-test.
  server: process.env.E2E_NO_HMR ? { hmr: false, watch: { ignored: ['**/*'] } } : undefined,
  test: { globals: true, environment: 'node', include: ['src/**/*.test.ts'] },
})
