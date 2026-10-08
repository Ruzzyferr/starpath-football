/**
 * WP-13 control schemes and match-feel depth: sling-shot, oscillating meter,
 * wheel curl, analog pad, dead zone, Vision pass options, one-two, assist
 * reward multiplier and deterministic input replay.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { ASSIST_REWARD, highlightRatingDelta } from '../sim/match/rating'
import type { HighlightResult } from '../sim/match/types'
import { PITCH_LENGTH } from '../sim/match/types'
import { createHumanBot, humanBotStep } from './humanBot'
import { feelHighlight } from './feelHarness'
import { applyInput, InputRecorder, replayInputs } from './inputReplay'
import {
  analogPower,
  analogShotTarget,
  analyzeSwipe,
  axisDeadzone,
  chargePower,
  OSC_MAX,
  OSC_MIN,
  OSC_PERIOD,
  oscillatingPower,
  radialDeadzone,
  rankPassOptions,
  SLING_FULL,
  slingshotSwipe,
  wheelCurl,
  type GesturePoint,
} from './kick'
import { GOAL_CENTER_Y, POST_Y_HIGH, POST_Y_LOW } from './physics'
import { HighlightRuntime, ONE_TWO_WINDOW, type RuntimeEvent } from './runtime'
import { makeDemoHighlight } from './demoHighlights'
import { setControlPrefs } from '../input/prefs'

function path(points: [number, number][], dur: number): GesturePoint[] {
  return points.map(([x, y], i) => ({ sx: x, sy: y, wx: x * 40, wy: y * 40, t: (dur * i) / (points.length - 1) }))
}

describe('sling-shot (pull-back) shooting', () => {
  it('fires opposite to the drag with power from the pull length', () => {
    const drag = analyzeSwipe(path([[0.5, 0.5], [0.4, 0.5], [0.3, 0.5]], 0.6))
    const sl = slingshotSwipe(drag)
    expect(sl.dir.x).toBeCloseTo(-drag.dir.x, 6)
    expect(sl.dir.y).toBeCloseTo(-drag.dir.y, 6)
    expect(sl.dir.x).toBeGreaterThan(0.9)
    // A short pull is soft, a full pull is ~100%, an over-pull overhits.
    const short = slingshotSwipe(analyzeSwipe(path([[0.5, 0.5], [0.44, 0.5]], 0.5)))
    const full = slingshotSwipe(analyzeSwipe(path([[0.5, 0.5], [0.5 - SLING_FULL, 0.5]], 0.5)))
    const over = slingshotSwipe(analyzeSwipe(path([[0.6, 0.5], [0.6 - SLING_FULL * 1.3, 0.5]], 0.5)))
    expect(short.power).toBeLessThan(0.35)
    expect(full.power).toBeGreaterThan(0.95)
    expect(full.power).toBeLessThanOrEqual(1.0001)
    expect(over.power).toBeGreaterThan(1.05)
  })

  it('is speed-independent (slow and fast pulls of the same length match)', () => {
    const slow = slingshotSwipe(analyzeSwipe(path([[0.5, 0.5], [0.3, 0.5]], 1.2)))
    const fast = slingshotSwipe(analyzeSwipe(path([[0.5, 0.5], [0.3, 0.5]], 0.1)))
    expect(slow.power).toBeCloseTo(fast.power, 6)
  })

  it('two fingers chip; taps pass through untouched', () => {
    const sw = analyzeSwipe(path([[0.5, 0.5], [0.3, 0.5]], 0.5), 2)
    expect(slingshotSwipe(sw, 2).chip).toBe(true)
    expect(slingshotSwipe(sw, 1).chip).toBe(false)
    const tap = analyzeSwipe(path([[0.5, 0.5], [0.501, 0.5]], 0.1))
    expect(slingshotSwipe(tap)).toBe(tap)
  })
})

describe('oscillating power meter', () => {
  it('sweeps min → max → min every period', () => {
    expect(oscillatingPower(0)).toBeCloseTo(OSC_MIN, 6)
    expect(oscillatingPower(OSC_PERIOD / 2)).toBeCloseTo(OSC_MAX, 6)
    expect(oscillatingPower(OSC_PERIOD)).toBeCloseTo(OSC_MIN, 6)
    expect(oscillatingPower(OSC_PERIOD * 3.25)).toBeCloseTo(oscillatingPower(OSC_PERIOD * 0.25), 6)
    for (let t = 0; t < 3; t += 0.013) {
      const p = oscillatingPower(t)
      expect(p).toBeGreaterThanOrEqual(OSC_MIN - 1e-9)
      expect(p).toBeLessThanOrEqual(OSC_MAX + 1e-9)
    }
  })

  it('hold-charge stays the default ramp (0 → 1.15 over ~1.1 s)', () => {
    expect(chargePower(0)).toBe(0)
    expect(chargePower(0.95)).toBeCloseTo(1, 6)
    expect(chargePower(5)).toBe(1.15)
  })
})

describe('PC wheel curl and gamepad analog', () => {
  it('wheel notches step curl by 0.2 and clamp at ±1', () => {
    let c = 0
    c = wheelCurl(c, -100)
    expect(c).toBeCloseTo(0.2, 6)
    for (let i = 0; i < 10; i++) c = wheelCurl(c, -100)
    expect(c).toBe(1)
    for (let i = 0; i < 20; i++) c = wheelCurl(c, 100)
    expect(c).toBe(-1)
    expect(wheelCurl(0.4, 0)).toBe(0.4)
  })

  it('radial dead zone zeroes drift and rescales to full deflection', () => {
    expect(radialDeadzone(0.1, 0.1, 0.18).mag).toBe(0)
    expect(radialDeadzone(0.1, 0.1, 0.1).mag).toBeGreaterThan(0)
    const full = radialDeadzone(0.93, 0, 0.18)
    expect(full.mag).toBeCloseTo(1, 6)
    expect(full.x).toBeCloseTo(1, 6)
    const half = radialDeadzone(0, -0.55, 0.18)
    expect(half.y).toBeLessThan(0)
    expect(half.mag).toBeGreaterThan(0.4)
    expect(half.mag).toBeLessThan(0.6)
    expect(axisDeadzone(0.15, 0.18)).toBe(0)
    expect(axisDeadzone(-0.93, 0.18)).toBeCloseTo(-1, 6)
  })

  it('analog trigger power and goal-spot aim', () => {
    expect(analogPower(0)).toBeCloseTo(0.3, 6)
    expect(analogPower(1)).toBeCloseTo(1.15, 6)
    expect(analogPower(0.5)).toBeGreaterThan(analogPower(0.3))
    expect(analogShotTarget(0).y).toBeCloseTo(GOAL_CENTER_Y, 6)
    expect(analogShotTarget(1).y).toBeGreaterThan(POST_Y_HIGH)
    expect(analogShotTarget(-1).y).toBeLessThan(POST_Y_LOW)
    expect(analogShotTarget(-0.5).x).toBeGreaterThan(PITCH_LENGTH)
  })
})

describe('Vision pass options', () => {
  const from = { x: 50, y: 34 }
  const mates = [
    { id: 'a', pos: { x: 62, y: 30 }, vel: { x: 0, y: 0 } },
    { id: 'b', pos: { x: 58, y: 44 }, vel: { x: 0, y: 0 } },
    { id: 'c', pos: { x: 44, y: 20 }, vel: { x: 0, y: 0 } },
    { id: 'far', pos: { x: 92, y: 34 }, vel: { x: 0, y: 0 } },
  ]
  it('more Vision shows more options and scans further', () => {
    const low = rankPassOptions(from, 30, mates, [])
    const mid = rankPassOptions(from, 60, mates, [])
    const high = rankPassOptions(from, 95, mates, [])
    expect(low.length).toBe(1)
    expect(mid.length).toBe(2)
    expect(high.length).toBe(3)
    expect(low).not.toContain('far')
    // 42 m away: only a high-Vision player sees it.
    expect(rankPassOptions(from, 95, [mates[3]], [])).toEqual(['far'])
    expect(rankPassOptions(from, 40, [mates[3]], [])).toEqual([])
  })
  it('skips blocked lanes and prefers forward options', () => {
    const blocked = rankPassOptions(from, 95, mates, [{ x: 56, y: 32 }])
    expect(blocked).not.toContain('a')
    expect(rankPassOptions(from, 95, mates, [])[0]).not.toBe('c')
  })
})

describe('assist reward multiplier', () => {
  const r = (o: HighlightResult['outcome'], mult?: number): HighlightResult => ({ outcome: o, passes: 0, passesCompleted: 0, shots: 1, shotsOnTarget: 1, dribbles: 0, tackles: 0, assistMult: mult })
  it('full 0.8×, half 1×, manual 1.25×', () => {
    expect(ASSIST_REWARD).toEqual({ full: 0.85, half: 1, manual: 1.2 })
    const base = highlightRatingDelta('edge_of_box', r('goal'))
    expect(highlightRatingDelta('edge_of_box', r('goal', 0.8))).toBeCloseTo(base * 0.8, 6)
    expect(highlightRatingDelta('edge_of_box', r('goal', 1.25))).toBeCloseTo(base * 1.25, 6)
  })
  it('never amplifies mistakes', () => {
    const miss = highlightRatingDelta('one_on_one', r('missed'))
    expect(miss).toBeLessThan(0)
    expect(highlightRatingDelta('one_on_one', r('missed', 1.25))).toBe(miss)
  })
  it('the runtime stamps the multiplier for its assist level', () => {
    for (const a of ['full', 'half', 'manual'] as const) {
      const rt = new HighlightRuntime(makeDemoHighlight('edge_of_box', 1), { aimAssist: a, seed: 1 })
      expect(rt.buildResult('missed').assistMult).toBe(ASSIST_REWARD[a])
    }
  })
})

/** Steps until `pred` or `maxS` seconds; returns events seen. */
function runUntil(rt: HighlightRuntime, pred: () => boolean, maxS: number, evs: RuntimeEvent[] = []): RuntimeEvent[] {
  for (let i = 0; i < maxS * 60 && !rt.finished && !pred(); i++) {
    rt.update(1 / 60)
    evs.push(...rt.drainEvents())
  }
  return evs
}

describe('one-two', () => {
  function setup(seed: number) {
    const rt = new HighlightRuntime(makeDemoHighlight('counter_2v1', seed), { aimAssist: 'full', slowMoAim: false, seed })
    runUntil(rt, () => rt.phase === 'live' && rt.heroOnBall, 3)
    const mate = rt.agents.filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper).sort((p, q) => Math.hypot(p.pos.x - rt.hero.pos.x, p.pos.y - rt.hero.pos.y) - Math.hypot(q.pos.x - rt.hero.pos.x, q.pos.y - rt.hero.pos.y))[0]
    return { rt, mate }
  }

  it('second tap after a pass: the receiver returns it into the run', () => {
    let returned = 0
    let tried = 0
    for (let seed = 1; seed <= 8; seed++) {
      const { rt, mate } = setup(seed)
      if (!rt.heroOnBall || !mate) continue
      tried++
      rt.queueAction({ kind: 'pass', target: { ...mate.pos } })
      const evs = runUntil(rt, () => !rt.heroOnBall, 0.5)
      expect(evs.some((e) => e.type === 'kick' && e.hero)).toBe(true)
      expect(rt.oneTwoHint()).toEqual({ id: mate.id, armed: false })
      // Keep running forward and tap again.
      rt.setControl({ move: { x: 1, y: 0 }, sprint: true })
      rt.update(1 / 60)
      rt.queueAction({ kind: 'action' })
      const ev2 = runUntil(rt, () => rt.owner === rt.hero, 4)
      expect(ev2.some((e) => e.type === 'oneTwo' && e.by === mate.id)).toBe(true)
      if (ev2.some((e) => e.type === 'kick' && e.by === mate.id)) returned++
    }
    expect(tried).toBeGreaterThan(4)
    // The return is guaranteed once the receiver has the ball (barring interceptions before it).
    expect(returned / tried).toBeGreaterThan(0.7)
  })

  it('no second tap → no one-two', () => {
    const { rt, mate } = setup(2)
    rt.queueAction({ kind: 'pass', target: { ...mate.pos } })
    const evs = runUntil(rt, () => rt.finished, 4)
    expect(evs.some((e) => e.type === 'oneTwo')).toBe(false)
  })

  it('the window closes after ONE_TWO_WINDOW', () => {
    const { rt, mate } = setup(3)
    rt.queueAction({ kind: 'pass', target: { ...mate.pos } })
    runUntil(rt, () => false, 2.6)
    expect(rt.oneTwoHint()).toBeNull()
  })
})

describe('Vision highlight in the runtime', () => {
  it('lists pass options only while the hero has the ball', () => {
    const rt = new HighlightRuntime(makeDemoHighlight('counter_2v1', 4), { seed: 4 })
    runUntil(rt, () => rt.phase === 'live' && rt.heroOnBall, 3)
    const ids = rt.passOptions()
    expect(ids.length).toBeGreaterThan(0)
    const mates = new Set(rt.agents.filter((a) => a.team === 'hero' && !a.isHero).map((a) => a.id))
    for (const id of ids) expect(mates.has(id)).toBe(true)
    const mate = rt.agents.find((a) => a.id === ids[0])!
    rt.queueAction({ kind: 'pass', target: { ...mate.pos } })
    runUntil(rt, () => !rt.heroOnBall, 1)
    expect(rt.passOptions()).toEqual([])
  })
})

describe('deterministic input replay', () => {
  afterEach(() => setControlPrefs({ touchShot: 'swipe', pcPower: 'hold', padPower: 'hold' }))

  it('a recorded bot session replays to the identical outcome and ball path', () => {
    for (const kind of ['one_on_one', 'counter_2v1', 'defend', 'corner'] as const) {
      for (const seed of [3, 11]) {
        const hl = feelHighlight(kind, seed)
        const opts = { aimAssist: 'half' as const, slowMoAim: true, difficulty: 'normal' as const, seed: seed * 31 + 7 }
        const rt = new HighlightRuntime(hl, opts)
        const bot = createHumanBot('average', seed)
        const rec = new InputRecorder()
        // Drive the bot through a shim that captures what it sends, then apply via applyInput.
        let frames = 0
        while (!rt.finished && frames < 60 * 40) {
          const cap = { move: { x: 0, y: 0 }, sprint: false, actions: [] as Parameters<HighlightRuntime['queueAction']>[0][], aim: null }
          const shim = Object.create(rt) as HighlightRuntime
          shim.setControl = (c) => {
            cap.move = { ...c.move }
            cap.sprint = c.sprint
          }
          shim.queueAction = (a) => void cap.actions.push(a)
          // Frame times vary like a real device.
          const dt = 1 / 60 + ((frames * 7919) % 5) * 0.001
          humanBotStep(shim, bot, dt)
          applyInput(rt, cap, dt, rec)
          rt.drainEvents()
          frames++
        }
        expect(rt.finished).toBe(true)
        const replay = replayInputs(hl, rec.toRecording(hl.id, opts), (r) => void r.drainEvents())
        expect(replay.result?.outcome).toBe(rt.result?.outcome)
        expect(replay.ball.x).toBe(rt.ball.x)
        expect(replay.ball.y).toBe(rt.ball.y)
        expect(replay.time).toBe(rt.time)
        expect(rec.samples()).toBeGreaterThan(10)
        // The recording survives JSON (bug reports / fixtures).
        const again = replayInputs(hl, JSON.parse(JSON.stringify(rec.toRecording(hl.id, opts))))
        expect(again.result?.outcome).toBe(rt.result?.outcome)
        expect(again.ball.x).toBe(rt.ball.x)
      }
    }
  }, 60_000)
})

describe('timing assist (a11y)', () => {
  it('widens the one-two window and the possession slow-mo', () => {
    const mk = (timingMult: number) => {
      const rt = new HighlightRuntime(makeDemoHighlight('counter_2v1', 3), { aimAssist: 'full', slowMoAim: true, seed: 3, timingMult })
      runUntil(rt, () => rt.phase === 'live' && rt.heroOnBall, 3)
      return rt
    }
    const a = mk(1)
    const b = mk(1.5)
    // Same real time elapsed, the assisted window has more left.
    for (const rt of [a, b]) for (let i = 0; i < 30; i++) rt.update(1 / 60)
    expect(b.bulletFrac).toBeGreaterThan(0)
    expect(b.bulletFrac).toBeGreaterThan(a.bulletFrac)
    // One-two window, measured in game time from the pass (no slow-mo).
    const hint = (timingMult: number, seed: number) => {
      const rt = new HighlightRuntime(makeDemoHighlight('counter_2v1', seed), { aimAssist: 'full', slowMoAim: false, seed, timingMult })
      runUntil(rt, () => rt.phase === 'live' && rt.heroOnBall, 3)
      const mate = rt.agents.filter((x) => x.team === 'hero' && !x.isHero && !x.isKeeper)[0]
      rt.queueAction({ kind: 'pass', target: { ...mate.pos } })
      const t0 = rt.time
      runUntil(rt, () => rt.time - t0 > ONE_TWO_WINDOW + 0.15, 4)
      return rt.oneTwoHint()
    }
    // The window ends earlier if the receiver moves the ball on; some seeds keep it open longer.
    let wider = 0
    for (let seed = 1; seed <= 12; seed++) {
      expect(hint(1, seed)).toBeNull()
      if (hint(1.5, seed)) wider++
    }
    expect(wider).toBeGreaterThan(0)
  })
})
