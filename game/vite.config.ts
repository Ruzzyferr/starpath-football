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
    /** trial | premium | auto (see src/store-iap/flavor.ts). */
    __SP_FLAVOR__: JSON.stringify(process.env.SP_FLAVOR ?? 'auto'),
  },
  // Oldest engines the shipped bundle must parse in (see src/platform/compat.ts MIN_CHROME and
  // compat.node.test.ts): Android System WebView / Chrome 80 (ES2020 syntax: no `||=`, no class
  // fields, no top-level await) and iOS 15 WKWebView. Newer runtime APIs are polyfilled in
  // src/platform/polyfills.ts; CSS is lowered by Lightning CSS (inset, colour fallbacks) where it can.
  build: {
    target: ['es2020', 'chrome80', 'safari15'],
    cssTarget: ['chrome80', 'safari15'],
    chunkSizeWarningLimit: 2000,
  },
  // The e2e suite (playwright.config.ts) runs without HMR so edits made while it runs cannot reload pages mid-test.
  server: process.env.E2E_NO_HMR ? { hmr: false, watch: { ignored: ['**/*'] } } : undefined,
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // CI runners are several times slower than a dev machine (and coverage adds more): give the default 5 s timeout headroom there.
    testTimeout: process.env.CI ? 60_000 : 5_000,
    hookTimeout: process.env.CI ? 120_000 : 10_000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov', 'json-summary'],
      include: ['src/sim/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/sim/**/testFixtures.ts', 'src/sim/**/testHelpers.ts', 'src/sim/game/balanceSim.ts'],
      // Floors for sim/** = measured level minus a small margin; raise them as coverage grows.
      thresholds: { lines: 94, functions: 93, branches: 81, statements: 91 },
    },
  },
})
