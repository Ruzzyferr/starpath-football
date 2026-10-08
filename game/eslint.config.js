import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist/**', 'release/**', 'node_modules/**', 'android/**', 'ios/**', 'test-results/**', 'playwright-report/**', 'electron/**', 'scripts/**', '*.config.*', 'public/**', 'build-resources/**', '**/*.cjs', '**/*.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.es2022 } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Hooks rules only apply to components; `useStorage` / Playwright's `use` are not hooks.
      'react-hooks/exhaustive-deps': 'warn',
      'no-useless-assignment': 'warn',
      // Pragmatic: the codebase uses `any` in save migrations / debug hooks and deliberate empty catches.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
  { files: ['src/**/*.tsx'], rules: { 'react-hooks/rules-of-hooks': 'error' } },
  { files: ['**/*.test.ts'], rules: { 'no-irregular-whitespace': 'off' } },
  // The simulation is deterministic and headless: no DOM, no Phaser, no wall-clock or global randomness.
  {
    files: ['src/sim/**/*.ts', 'src/core/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-globals': ['error',
        { name: 'window', message: 'sim/core must stay headless.' },
        { name: 'document', message: 'sim/core must stay headless.' },
        { name: 'localStorage', message: 'sim/core must stay headless.' },
        { name: 'navigator', message: 'sim/core must stay headless.' },
      ],
      'no-restricted-imports': ['error', { patterns: [
        { group: ['phaser', 'phaser/*'], message: 'sim/core must not depend on Phaser.' },
        { group: ['**/ui/**', '**/game/*Scene*', '**/platform/**'], message: 'sim/core must not depend on UI or platform layers.' },
        { group: ['**/store-iap/**', '**/telemetry/**', '**/audio/**'], message: 'Purchases, telemetry and audio must never influence the simulation (cosmetic isolation).' },
      ] }],
      'no-restricted-properties': ['error',
        { object: 'Date', property: 'now', message: 'Pass time in explicitly (determinism).' },
        { object: 'Math', property: 'random', message: 'Use the seeded RNG.' },
      ],
    },
  },
)
