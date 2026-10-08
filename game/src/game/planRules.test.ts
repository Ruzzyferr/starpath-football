/**
 * Plan-constant regression tests for the live match (docs/ANALIZ-VE-PLAN.md
 * §2.1, rows closed in the S21 sweep; ids are GAP-AUDIT row numbers).
 */
import { describe, expect, it } from 'vitest'
import { ASSIST_REWARD } from '../sim/match/rating'
import { clampDeadzone, padTriggers, PAD_DEADZONE_MAX, PAD_DEADZONE_MIN } from './input'
import { analyzeSwipe, POWER_BANDS, powerSpread, type GesturePoint } from './kick'
import { kickEvents } from './inputReplay'
import { bulletWindowFor, dribbleReach, magnetMate, PASS_MAGNET } from './runtime'
import { looseBallWin, standingTackleWin, TACKLE_RANGE } from './ai'

/** A swipe of `dur` seconds along +x with ease-in speed, sampled at `hz`. */
function sampled(hz: number, dur = 0.24): GesturePoint[] {
  const n = Math.max(2, Math.round(dur * hz) + 1)
  return Array.from({ length: n }, (_, i) => {
    const t = (dur * i) / (n - 1)
    const x = 0.6 * (t / dur) ** 2
    return { sx: x, sy: 0, wx: x * 40, wy: 0, t }
  })
}

describe('2.1#18 release velocity from the last 80 ms of samples', () => {
  it('is independent of the pointer sampling rate', () => {
    const s30 = analyzeSwipe(sampled(30)).speed
    const s60 = analyzeSwipe(sampled(60)).speed
    const s120 = analyzeSwipe(sampled(120)).speed
    expect(Math.abs(s30 - s120) / s120).toBeLessThan(0.12)
    expect(Math.abs(s60 - s120) / s120).toBeLessThan(0.06)
    // The tail of an accelerating swipe is faster than its average.
    expect(s120).toBeGreaterThan(0.6 / 0.24)
  })
})

describe('2.1#19 power bands and red-zone composure spread', () => {
  it('green/yellow/red cut-offs at 60 % and 85 %', () => {
    expect(POWER_BANDS).toEqual({ yellow: 0.6, red: 0.85 })
  })
  it('red band drifts up to +15 % at Composure 0, nothing at 100, no drift below 85 %', () => {
    expect(powerSpread(0.8, 0)).toBe(1)
    expect(powerSpread(1, 0)).toBeCloseTo(1.15, 6)
    expect(powerSpread(1, 100)).toBeCloseTo(1, 6)
    expect(powerSpread(0.925, 50)).toBeCloseTo(1 + 0.15 * 0.5 * 0.5, 6)
    // Overhit past full power spreads fast.
    expect(powerSpread(1.1, 100)).toBeGreaterThan(1.4)
  })
})

describe('2.1#24 gamepad: analog power on the right trigger, dead zone 5–25 %', () => {
  it('maps triggers by scheme', () => {
    expect(padTriggers('analog')).toEqual({ power: 7, sprint: 6 })
    expect(padTriggers('hold').sprint).toBe(7)
  })
  it('clamps the dead zone', () => {
    expect(clampDeadzone(0.4)).toBe(PAD_DEADZONE_MAX)
    expect(clampDeadzone(0)).toBe(PAD_DEADZONE_MIN)
    expect(clampDeadzone(0.18)).toBe(0.18)
    expect(PAD_DEADZONE_MAX).toBe(0.25)
  })
})

describe('2.1#26 bullet-time window', () => {
  it('is 1.2 s + Composure × 0.02 s, halved under 2 m pressure', () => {
    expect(bulletWindowFor(80, 10)).toBeCloseTo(2.8, 6)
    expect(bulletWindowFor(0, 10)).toBeCloseTo(1.2, 6)
    expect(bulletWindowFor(80, 1.5)).toBeCloseTo(1.4, 6)
  })
})

describe('2.1#28/#29 assist reward and pass magnet', () => {
  it('reward multipliers ×0.85 / ×1.0 / ×1.2', () => {
    expect(ASSIST_REWARD).toEqual({ full: 0.85, half: 1, manual: 1.2 })
  })
  it('full assist snaps a free-space pass to a mate within 1.5 m; half/manual never', () => {
    const mates = [{ id: 'a', pos: { x: 50, y: 30 } }, { id: 'b', pos: { x: 60, y: 30 } }]
    expect(PASS_MAGNET).toBe(1.5)
    expect(magnetMate({ x: 51.2, y: 30.5 }, mates, 'full')?.id).toBe('a')
    expect(magnetMate({ x: 52, y: 30 }, mates, 'full')).toBeNull()
    expect(magnetMate({ x: 50.2, y: 30 }, mates, 'half')).toBeNull()
    expect(magnetMate({ x: 50.2, y: 30 }, mates, 'manual')).toBeNull()
  })
})

describe('2.1#34 kick input events {t, dx, dy, curve, lift}', () => {
  it('extracts swipe/shoot/pass kicks with their time from the applied frames', () => {
    const sw = analyzeSwipe([
      { sx: 0, sy: 0, wx: 0, wy: 0, t: 0 },
      { sx: 0.3, sy: -0.05, wx: 12, wy: -2, t: 0.1 },
    ])
    const ev = kickEvents([
      { dt: 0.5, move: { x: 1, y: 0 } },
      { dt: 0.25, actions: [{ kind: 'swipe', swipe: sw }] },
      { dt: 0.25, actions: [{ kind: 'shoot', target: { x: 105, y: 31 }, power: 0.9, curl: -0.4, chip: true }] },
      { dt: 0.1, actions: [{ kind: 'pass', target: { x: 80, y: 20 }, lofted: false }, { kind: 'action' }] },
    ])
    expect(ev.map((e) => e.kind)).toEqual(['swipe', 'shoot', 'pass'])
    expect(ev[0].t).toBe(0.5)
    expect(ev[0].dx).toBeCloseTo(sw.dir.x * sw.length, 3)
    expect(ev[1]).toMatchObject({ t: 0.75, dx: 105, dy: 31, curve: -0.4, lift: 1, power: 0.9 })
    expect(ev[2]).toMatchObject({ t: 1, lift: 0, curve: 0 })
    // A bug-report attachment of a busy moment stays tiny.
    expect(JSON.stringify(Array.from({ length: 12 }, () => ev).flat()).length).toBeLessThan(4096)
  })
})

describe('2.1#36 dribble knock-on distance', () => {
  it('Dribbling 40 → 1.6 m, 80 → 0.9 m, sprint +40 %', () => {
    expect(dribbleReach(40, false)).toBeCloseTo(1.6, 6)
    expect(dribbleReach(80, false)).toBeCloseTo(0.9, 6)
    expect(dribbleReach(40, true)).toBeCloseTo(2.24, 6)
    expect(dribbleReach(60, false)).toBeLessThan(dribbleReach(50, false))
  })
})

describe('2.1#37 / #74 tackles and the loose ball', () => {
  it('AI challenge range 1.2 m; ×1.25 win when the ball is > 0.8 m from his feet', () => {
    expect(TACKLE_RANGE).toBe(1.2)
    expect(looseBallWin(0.4, 1.0)).toBeCloseTo(0.5, 6)
    expect(looseBallWin(0.4, 0.5)).toBe(0.4)
    expect(looseBallWin(0.9, 1.0)).toBe(0.94)
  })
  it('hero standing tackle on a loose ball wins ≥ 70 %; at his feet it is early (beaten on failure)', () => {
    expect(standingTackleWin(0.3, 1.0)).toEqual({ win: 0.7, early: false })
    expect(standingTackleWin(0.8, 1.0).win).toBe(0.8)
    expect(standingTackleWin(0.3, 0.5)).toEqual({ win: 0.3, early: true })
  })
})
