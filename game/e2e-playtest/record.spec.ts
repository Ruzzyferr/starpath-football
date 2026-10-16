/**
 * Playtest recorder: every match moment, played by human-like touch personas
 * on a phone. Per attempt: video (Playwright), frames every ~350 ms, the input
 * log, what the game recognised (gesture probe) and screen geometry.
 * Output: $PT_OUT/<kind>/<persona>-s<seed>/{f00.jpg…, run.json}
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { test } from '@playwright/test'
import { ALL_KINDS } from '../src/game/demoHighlights'
import { PERSONAS, Thumbs, gestureProbe, humanStep, rng, sceneInfo, sleep, type Info } from './bot'
import { howToFor, matchTutorialKey } from '../src/ui/tutorial/howTo'
import { tr as helpTr } from '../src/i18n/sections/help'

/** The how-to card a player reads before this moment in the app (goal, touch controls, tip), in Turkish. */
function howToCard(kind: string): string {
  const h = howToFor(matchTutorialKey(kind))
  if (!h) return ''
  const goal = typeof h.goal === 'string' ? h.goal : h.goal.tr
  const touch = (helpTr.hints.touch as Record<string, string>)
  const controls = h.groups.map((g) => touch[g]).filter(Boolean).join(' ')
  return `HEDEF: ${goal} | KONTROL: ${controls} | İPUCU: ${h.tip.tr}`
}

const OUT = process.env.PT_OUT ?? 'test-results/playtest-out'
const KINDS = (process.env.PT_KINDS ? process.env.PT_KINDS.split(',') : [...ALL_KINDS]).filter(Boolean)
const SEEDS = Number(process.env.PT_SEEDS ?? 2)
const PERS = (process.env.PT_PERSONAS ?? 'casual,average').split(',')

for (const kind of KINDS) {
  for (const pname of PERS) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      test(`${kind} · ${pname} · seed ${seed}`, async ({ page }, ti) => {
        const persona = PERSONAS[pname]!
        const dir = `${OUT}/${kind}/${pname}-s${seed}`
        mkdirSync(dir, { recursive: true })
        // The demo's dev toolbar off: the match fills the phone screen as in the app.
        await page.addInitScript(() => {
          document.addEventListener('DOMContentLoaded', () => {
            const st = document.createElement('style')
            st.textContent = '#bar{position:absolute!important;left:-9999px!important}#help{display:none!important}'
            document.head.appendChild(st)
          })
        })
        await page.goto(`/match-demo.html?kind=${kind}&seed=${seed * 7 + 1}&lang=tr`)
        await page.waitForFunction(() => !!(globalThis as unknown as { __spScene?: unknown }).__spScene, undefined, { timeout: 60_000 })
        const cdp = await page.context().newCDPSession(page)
        const r = rng(seed * 1000 + kind.length * 17 + pname.length)
        const th = new Thumbs(cdp, r, persona)
        const frames: { t: number; file: string; phase: string; heroOnBall: boolean; carrier: string | null; result: string | null }[] = []
        const decisions: { t: number; kind: string; why: string }[] = []
        let first: Info | null = null
        let last: Info | null = null
        const t0 = Date.now()
        let lastShot = -1e9
        let shotN = 0
        const st = { lastOwnerHero: false, actedAt: -1e9, now: 0 }
        let stuck = 0
        while (Date.now() - t0 < 75_000) {
          const info = await sceneInfo(page)
          if (!info) {
            await sleep(80)
            continue
          }
          if (!first && info.phase === 'live') first = info
          last = info
          const now = Date.now() - t0
          st.now = now
          if (now - lastShot > 350 && shotN < 70) {
            const file = `f${String(shotN).padStart(2, '0')}.jpg`
            await page.screenshot({ path: `${dir}/${file}`, type: 'jpeg', quality: 55 })
            frames.push({ t: now, file, phase: info.phase, heroOnBall: info.heroOnBall, carrier: info.agents?.find((a) => a.owner)?.id ?? null, result: info.result })
            lastShot = now
            shotN++
          }
          if (info.finished || info.phase === 'done' || info.phase === 'post') {
            await th.releaseStick()
            // Let the outcome card render.
            await sleep(900)
            await page.screenshot({ path: `${dir}/end.jpg`, type: 'jpeg', quality: 60 })
            break
          }
          // Set-piece picker (DOM): read it, pick a zone / nudge the wall, then take it — like a person.
          const picker = page.locator('.sp-pick')
          if (await picker.isVisible().catch(() => false)) {
            await sleep(persona.react[0] * 3)
            const zones = picker.locator('button[data-pick^="zone:"]')
            const nz = await zones.count()
            if (nz) {
              const z = zones.nth(Math.floor(r() * nz))
              th.note(`picker: ${(await z.textContent()) ?? ''}`)
              await z.tap().catch(() => undefined)
              await sleep(250)
            }
            const go = picker.locator('button[data-pick="take"], button[data-pick="ok"]').first()
            th.note('picker: take / ok')
            await go.tap().catch(() => undefined)
            await sleep(200)
            continue
          }
          if (info.phase !== 'live' || info.paused) {
            stuck++
            // A pause gate / hint overlay: a person taps it away after reading.
            if (stuck % 25 === 24) {
              const c = info.canvas
              th.note('tap to continue (paused / intro)')
              await th.tap({ x: c.left + c.width / 2, y: c.top + c.height * 0.4 }, 'tap to continue')
            }
            await sleep(80)
            continue
          }
          stuck = 0
          const d = await humanStep(th, info, persona, st)
          if (d.kind !== 'move' && d.kind !== 'wait') {
            st.actedAt = Date.now() - t0
            decisions.push({ t: st.actedAt, kind: d.kind, why: d.why })
          }
          await sleep(60)
        }
        await th.releaseStick()
        const probe = await gestureProbe(page)
        const gf = first?.goalFrame
        const keeper = first?.agents?.find((a) => a.keeper && a.team === 'opp')
        const geom = gf
          ? {
              goalWidthPx: Math.hypot(gf.postR.x - gf.postL.x, gf.postR.y - gf.postL.y),
              goalHeightPx: Math.hypot(gf.barL.x - gf.postL.x, gf.barL.y - gf.postL.y),
              keeperHeightPx: keeper ? Math.hypot(keeper.head.x - keeper.feet.x, keeper.head.y - keeper.feet.y) : null,
              heroToGoalM: first ? 105 - first.heroWorld.x : null,
              heroLateralM: first ? first.heroWorld.y - 34 : null,
            }
          : null
        const summary = await page.locator('#result').textContent().catch(() => null)
        const run = {
          kind,
          howTo: howToCard(kind),
          summary,
          persona: pname,
          seed,
          result: last?.result ?? null,
          finished: !!last?.finished,
          durationMs: Date.now() - t0,
          decisions,
          inputs: th.log,
          recognised: probe.gestures.map((g) => g.outcome),
          kicks: probe.kicks.length,
          events: (last?.events ?? []).map((e) => Object.entries(e).filter(([, v]) => typeof v !== 'object').map(([k, v]) => `${k}=${v}`).join(' ')),
          geom,
          frames,
          video: ti.outputPath(''),
        }
        writeFileSync(`${dir}/run.json`, JSON.stringify(run, null, 1))
      })
    }
  }
}
