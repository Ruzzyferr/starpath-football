import preact from '@preact/preset-vite'
import { defineConfig } from 'vitest/config'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { starpathServiceWorker } from './scripts/sw-plugin.ts'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
function gitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev'
  } catch {
    return process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev'
  }
}

export default defineConfig({
  plugins: [preact(), starpathServiceWorker()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_COMMIT__: JSON.stringify(gitCommit()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  // The e2e suite (playwright.config.ts) runs without HMR so edits made while it runs cannot reload pages mid-test.
  server: process.env.E2E_NO_HMR ? { hmr: false, watch: { ignored: ['**/*'] } } : undefined,
  test: { globals: true, environment: 'node', include: ['src/**/*.test.ts'] },
})
