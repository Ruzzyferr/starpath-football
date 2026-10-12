/**
 * Playtester build 9 (pressing, real iPhone): "I run straight at the man pressing PRESS and pass THROUGH him and the
 * ball — 5–6 times in a row". Every kind where the opponent has the ball, played the way that phone user did:
 * joystick straight at the carrier, SPRINT held (when on screen), the red context button (PRESS / TACKLE / BLOCK /
 * INTERCEPT) tapped every 0.3 s with the stick direction — only what a touch screen sends. A ghost = the hero's body
 * overlapping the carrier's (< 0.6 m) with the ball at his feet. Report: REPRO=1 npx vitest run
 * src/game/pressRepro.test.ts --silent=false (REPRO_N per cell).
 */
import { describe, expect, it } from 'vitest'
import { contextActions, type ActionId } from './actionSet'
import { FEEL_KINDS, type FeelKind } from './feelHarness'
import { shortPassReception } from './intentHarness'
import { matrixHighlight, type OppStrength } from './kindMatrix'
import { dist, norm, sub } from './model'
import { HighlightRuntime, TACKLE_REACH } from './runtime'
import { tierSuccess, momentTier } from '../sim/match/tier'
import type { HighlightKind } from '../sim/match/types'

const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}

const RED: readonly ActionId[] = ['press', 'tackle', 'block', 'intercept']

/** The kinds where the opponent has the ball and the hero has to win it (the report covers every kind). */
const PRESS_KINDS: readonly FeelKind[] = ['defend', 'defend_1v1', 'press_trap', 'interception', 'recovery_run', 'block', 'shoulder_duel']

interface ChargeLog {
  /** An opponent (not a keeper) had the ball at some point. */
  defended: boolean
  /** The hero's body overlapped the carrier's (< 0.6 m) — passed through him. */
  overlap: boolean
  /** Came within standing-tackle reach of the carrier. */
  reach: boolean
  /** Any challenge of his (tackle won / lost, foul, shoulder, block). */
  contest: boolean
  success: boolean
}

function chargeTrial(kind: FeelKind, seed: number, level: number | null, opp: OppStrength): ChargeLog {
  const rt = new HighlightRuntime(matrixHighlight(kind, seed, level, opp), { aimAssist: 'half', slowMoAim: true, difficulty: 'normal', seed: seed * 7919 + 13 })
  const dt = 1 / 60
  let lastTap = -1
  const log: ChargeLog = { defended: false, overlap: false, reach: false, contest: false, success: false }
  const heroId = rt.hero.id
  for (let f = 0; f < 60 * 90 && !rt.finished; f++) {
    const t = f * dt
    const ids = contextActions(rt.actionContext())
    const o = rt.owner
    if (o && o.team === 'opp' && !o.isKeeper && !rt.hero.isKeeper) {
      log.defended = true
      const dir = norm(sub(o.pos, rt.hero.pos))
      rt.setControl({ move: dir, sprint: ids.includes('sprint') })
      const red = RED.find((r) => ids.includes(r))
      if (red && t - lastTap > 0.3) {
        rt.queueAction({ kind: 'btn', id: red, dir })
        lastTap = t
      }
      const d = dist(o.pos, rt.hero.pos)
      if (d < TACKLE_REACH) log.reach = true
      if (d < 0.6 && rt.hero.state === 'run') log.overlap = true
    } else rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
    rt.update(dt)
    for (const e of rt.drainEvents()) {
      if ((e.type === 'tackle' && e.by === heroId) || (e.type === 'foul' && e.by === heroId) || (e.type === 'shoulder' && (e.by === heroId || e.on === heroId)) || (e.type === 'block' && e.by === heroId)) log.contest = true
    }
  }
  log.success = tierSuccess(rt.result?.tier ?? momentTier(kind as HighlightKind, rt.result ?? { outcome: 'timeout' }))
  return log
}

interface ChargeRates {
  def: number
  overlap: number
  reach: number
  /** Contest share of the trials that reached him. */
  contestInReach: number
  success: number
}

function chargeRates(kind: FeelKind, level: number | null, opp: OppStrength, n: number): ChargeRates {
  let def = 0
  let overlap = 0
  let reach = 0
  let contestInReach = 0
  let success = 0
  for (let s = 1; s <= n; s++) {
    const l = chargeTrial(kind, s, level, opp)
    if (!l.defended) continue
    def++
    if (l.overlap) overlap++
    if (l.reach) {
      reach++
      if (l.contest) contestInReach++
    }
    if (l.success) success++
  }
  return { def, overlap: def ? overlap / def : 0, reach: def ? reach / def : 0, contestInReach: reach ? contestInReach / reach : 1, success: def ? success / def : 0 }
}

describe('pressing on a phone (playtester build 9): the hero never goes through the carrier', () => {
  for (const k of PRESS_KINDS) {
    it(`${k}: straight run + the red button — no overlap, a challenge when he gets there`, () => {
      for (const [lv, opp] of [[null, 'average'], [40, 'strong']] as const) {
        const r = chargeRates(k, lv, opp, 40)
        const line = `${k} ${lv ?? 'start'}/${opp} ${JSON.stringify(r)}`
        expect(r.overlap, line).toBe(0)
        // TACKLE / PRESS on screen: in reach is a challenge (the carrier may still get his pass away first when hurried).
        // (Counted in trials: at 40 vs strong only a handful get there — at most one in four, or one, without a contest.)
        const reached = Math.round(r.reach * r.def)
        const without = reached - Math.round(r.contestInReach * reached)
        if (k !== 'block' && k !== 'shoulder_duel' && k !== 'recovery_run') expect(without, line).toBeLessThanOrEqual(Math.max(1, Math.floor(reached * 0.25)))
      }
    }, 120_000)
  }
})

describe('bodies are swept: no approach speed skips the contact step', () => {
  it('a hero 1 m in front of the carrier at 120 m/s (2 m a step) ends on his own side, a body apart', () => {
    const rt = new HighlightRuntime(matrixHighlight('defend', 3, null, 'average'), { aimAssist: 'half', slowMoAim: true, difficulty: 'normal', seed: 3 * 7919 + 13 })
    for (let f = 0; f < 600 && !(rt.phase === 'live' && rt.owner && rt.owner.team === 'opp'); f++) rt.update(1 / 60)
    const o = rt.owner!
    expect(o.team).toBe('opp')
    const dir = norm(sub(o.pos, rt.hero.pos))
    rt.hero.pos = { x: o.pos.x - dir.x * 1.0, y: o.pos.y - dir.y * 1.0 }
    rt.hero.prev.x = rt.hero.pos.x
    rt.hero.prev.y = rt.hero.pos.y
    rt.hero.vel = { x: dir.x * 120, y: dir.y * 120 }
    rt.setControl({ move: dir, sprint: true })
    rt.update(1 / 60)
    const rel = sub(rt.hero.pos, o.pos)
    expect(rel.x * dir.x + rel.y * dir.y, 'still on the side he came from').toBeLessThan(0)
    expect(dist(rt.hero.pos, o.pos)).toBeGreaterThan(0.6)
  })
})

describe('pass reception through the PASS button (playtester build 9: well-played passes not received)', () => {
  it('a clean short pass to a free team-mate is received ≥ 85 % even at 40', () => {
    expect(shortPassReception(40, 150).rate).toBeGreaterThanOrEqual(0.85)
  }, 120_000)
})

describe.runIf(ENV.REPRO === '1')('press report (phone path: straight run + red button)', () => {
  it('every kind', () => {
    const n = Number(ENV.REPRO_N ?? 100)
    const p = (x: number) => Math.round(x * 100)
    for (const k of FEEL_KINDS) {
      const a = chargeRates(k, null, 'average', n)
      if (!a.def) continue
      const w = chargeRates(k, 40, 'strong', n)
      console.log(`REPRO ${k} | def ${a.def} | start/avg overlap ${p(a.overlap)} reach ${p(a.reach)} contestInReach ${p(a.contestInReach)} win ${p(a.success)} | 40/strong overlap ${p(w.overlap)} reach ${p(w.reach)} contestInReach ${p(w.contestInReach)} win ${p(w.success)}`)
    }
    expect(true).toBe(true)
  }, 900_000)
})
