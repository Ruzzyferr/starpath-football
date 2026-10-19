// Builds the real game for the web into dist/play/ without touching game/src or game/dist.
//
// Flavour: SP_FLAVOR=premium. The repo's `demo` flavour is a kiosk build (store-iap/demo.ts): it wipes
// the career after 90 s without input and after 15 minutes of play, which is wrong for a visitor who
// wants to play their own career. `premium` is the full, unlocked career. On the web (not a
// Capacitor shell, not a dev server) the purchase provider is `UnavailableProvider`
// (store-iap/service.ts getProvider), so storeAvailable() is false: no shop UI, no wallet calls, no
// AdMob, no requests to the shop server. VITE_SHOP_API is also pointed at an unroutable value as a
// second lock, so even a future code path could not reach the real server.
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const game = resolve(site, '../game')
const out = resolve(site, 'dist/play')
if (!existsSync(resolve(game, 'node_modules'))) {
  console.error('game/node_modules is missing: run `npm ci` in game/ first')
  process.exit(1)
}
rmSync(out, { recursive: true, force: true })
const r = spawnSync('npx', ['vite', 'build', '--outDir', JSON.stringify(out), '--emptyOutDir'], {
  cwd: game,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, SP_FLAVOR: 'premium', VITE_SHOP_API: 'https://shop.invalid' },
})
if (r.status !== 0) process.exit(r.status ?? 1)
// The dev-only highlight player is not part of the public build.
rmSync(resolve(out, 'match-demo.html'), { force: true })
rmSync(resolve(out, 'audio-lab.html'), { force: true })
console.log('built', out)
