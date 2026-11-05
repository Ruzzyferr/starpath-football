// Performance / size budgets enforced in CI (2.9#72, #73, #22).
//   node scripts/check-budgets.mjs [--dist dist] [--print]
// Reads scripts/budgets.json, measures the built web bundle (gzip, as served) and exits 1 on any breach.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { basename, join, extname, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

const gz = (file) => gzipSync(readFileSync(file), { level: 9 }).length

/** Measure a dist folder. Pure aside from reading files. */
export function measure(dist) {
  const files = walk(dist)
  const js = files.filter((f) => extname(f) === '.js' && !f.endsWith('sw.js'))
  const css = files.filter((f) => extname(f) === '.css')
  const audio = files.filter((f) => ['.mp3', '.ogg', '.wav', '.m4a', '.flac'].includes(extname(f)))
  // Translation overlays (src/i18n/overlay/<lang>.json): one lazy chunk per language, a device loads at most one.
  const isOverlay = (f) => /^(es|pt|de|fr|it|id)-[\w-]+\.js$/.test(basename(f))
  const overlays = js.filter(isOverlay).map((f) => ({ f, gz: gz(f), size: statSync(f).size }))
  const jsGz = js.filter((f) => !isOverlay(f)).map((f) => ({ f, gz: gz(f) }))
  const total = files.filter((f) => !isOverlay(f)).reduce((n, f) => n + statSync(f).size, 0) + Math.max(0, ...overlays.map((x) => x.size))
  return {
    jsTotalGzKB: jsGz.reduce((n, x) => n + x.gz, 0) / 1024,
    jsLargestGzKB: Math.max(0, ...jsGz.map((x) => x.gz)) / 1024,
    // Everything a cold start needs before the match: all JS except the lazily loaded Phaser match chunk.
    jsInitialGzKB: jsGz.filter((x) => !/MatchScene|phaser/i.test(x.f)).reduce((n, x) => n + x.gz, 0) / 1024,
    cssTotalGzKB: css.reduce((n, f) => n + gz(f), 0) / 1024,
    // Counts the largest overlay once: what one device downloads.
    distTotalKB: total / 1024,
    audioFileBytes: audio.reduce((n, f) => n + statSync(f).size, 0),
    jsChunks: jsGz.length,
    localeOverlayGzKB: Math.max(0, ...overlays.map((x) => x.gz)) / 1024,
  }
}

export function check(measured, budgets) {
  const failures = []
  for (const [key, max] of Object.entries(budgets)) {
    if (key.startsWith('_')) continue
    const v = measured[key]
    if (v === undefined) failures.push(`${key}: unknown budget key`)
    else if (v > max) failures.push(`${key}: ${v.toFixed(1)} > budget ${max}`)
  }
  return failures
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const di = args.indexOf('--dist')
  const dist = resolve(di >= 0 ? args[di + 1] : join(here, '..', 'dist'))
  const budgets = JSON.parse(readFileSync(join(here, 'budgets.json'), 'utf8'))
  const m = measure(dist)
  for (const [k, v] of Object.entries(m)) console.log(`${k.padEnd(18)} ${Number(v).toFixed(1)}${budgets[k] !== undefined ? `  (budget ${budgets[k]})` : ''}`)
  const bad = check(m, budgets)
  if (bad.length) {
    console.error('\nBUDGET BREACH:\n  ' + bad.join('\n  '))
    process.exit(1)
  }
  console.log('\nAll budgets met.')
}
