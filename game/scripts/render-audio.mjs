/**
 * Renders every audio-lab scenario (music tracks, stings, crowd states, UI
 * sounds) offline in headless Chrome through the real mixer and writes WAVs
 * plus a level report. Fails (exit 1) if any render clips (peak >= -1 dBFS),
 * contains NaN, or is mostly silent.
 *
 *   node scripts/render-audio.mjs [outDir] [scenarioFilter]
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const outDir = resolve(process.argv[2] ?? 'test-results/audio')
const filter = process.argv[3] ? new RegExp(process.argv[3]) : null
/** --raw: render 40 dB down (no compression) and report levels +40 dB: what hits the limiter. */
const RAW = process.argv.includes('--raw')
const PORT = 5301
mkdirSync(outDir, { recursive: true })

const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
  env: { ...process.env, E2E_NO_HMR: '1' },
})
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not start')), 60000)
  server.stderr.on('data', (d) => process.stderr.write(d))
  server.stdout.on('data', (d) => {
    if (String(d).includes('Local')) {
      clearTimeout(t)
      res()
    }
  })
})

let failed = false
const report = []
try {
  let browser
  try {
    browser = await chromium.launch({ channel: 'chrome' })
  } catch {
    browser = await chromium.launch()
  }
  const page = await browser.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('[page]', m.text())
  })
  await page.goto(`http://127.0.0.1:${PORT}/audio-lab.html`)
  await page.waitForFunction(() => !!window.__renderAudio)
  const ids = (await page.evaluate(() => window.__audioScenarios)).filter((id) => !filter || filter.test(id))
  for (const id of ids) {
    const t0 = Date.now()
    const res = await page.evaluate(([sid, raw]) => window.__renderAudio(sid, { wav: !raw, raw }), [id, RAW])
    if (res.wav) writeFileSync(join(outDir, `${id}.wav`), Buffer.from(res.wav, 'base64'))
    const s = res.stats
    const problems = []
    if (!(s.peakDb < -1)) problems.push(`peak ${s.peakDb.toFixed(2)} dBFS >= -1`)
    if (s.nan > 0) problems.push(`${s.nan} NaN`)
    if (s.silentRatio > (id.startsWith('ui') || id.startsWith('sting') ? 0.6 : 0.25)) problems.push(`${Math.round(s.silentRatio * 100)}% silent windows`)
    if (s.rmsDb < -40) problems.push(`rms ${s.rmsDb.toFixed(1)} dBFS too quiet`)
    if (RAW) problems.length = 0
    if (problems.length) failed = true
    const line = `${id.padEnd(26)} peak ${s.peakDb.toFixed(1).padStart(6)} dBFS  rms ${s.rmsDb.toFixed(1).padStart(6)}  win ${s.minWindowDb.toFixed(1)}..${s.maxWindowDb.toFixed(1)}  silent ${(s.silentRatio * 100).toFixed(0)}%  NaN ${s.nan}  cpu ${(res.cpu * 100).toFixed(1)}%${problems.length ? '  FAIL: ' + problems.join(', ') : ''}`
    console.log(line)
    report.push({ id, ...s, cpu: res.cpu, problems })
  }
  await browser.close()
} finally {
  if (process.platform === 'win32' && server.pid) spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
  else server.kill()
}
writeFileSync(join(outDir, 'levels.json'), JSON.stringify(report, null, 2))
console.log(failed ? 'LEVEL CHECK FAILED' : 'level check ok', '→', outDir)
process.exit(failed ? 1 : 0)
