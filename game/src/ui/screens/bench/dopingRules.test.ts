/**
 * Doping test balance (docs/BALANCE.md "Agenda minigames"): simulated GOOD and
 * SLOPPY players at Composure (= discipline) 40..90, 300 tests each.
 *  - GOOD: watches the needle with a human reaction lag (0.28 s, some
 *    misjudgement), switches no faster than every 0.18 s, reads the form
 *    order (5% slips, ~1.3 s a form);
 *  - SLOPPY: a slow, noisy hand (0.42 s lag, drifts off for moments), taps
 *    the forms in table order and in a rush.
 * Each test draws a sharper or shakier day (lag ×0.75–1.35, misjudgement
 * ×0.6–1.6). Pass = grade B (0.6). Targets: a starting hero (~40) with good input
 * passes 60–75%, monotonic in the stats, good ≫ sloppy (20+ points).
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../../../core/rng'
import {
  BREATH_SECONDS, DOPING_PASS, bandCenter, breathStep, calmScore, dopingParams, dopingPerformance, formsScore, inBand, needleAt,
} from './dopingRules'

export const LEVELS = [40, 50, 60, 70, 80, 90] as const
const TRIALS = 300
const DT = 1 / 60

interface Hand { lag: number; noise: number; minSwitch: number; lapse: number; formTime: [number, number]; slip: number }
export const GOOD: Hand = { lag: 0.28, noise: 0.04, minSwitch: 0.18, lapse: 0, formTime: [1.3, 0.3], slip: 0.05 }
export const SLOPPY: Hand = { lag: 0.42, noise: 0.07, minSwitch: 0.25, lapse: 0.2, formTime: [0.8, 0.25], slip: 0.45 }

/** One played test: { calm, forms, perf }. */
export function playDoping(level: number, base: Hand, rng: Rng): { calm: number; forms: number; perf: number } {
  const p = dopingParams(level, level)
  // Nobody plays the same twice: a sharper or a shakier day.
  const hand: Hand = { ...base, lag: base.lag * rng.range(0.75, 1.35), noise: base.noise * rng.range(0.6, 1.6) }
  const phase = rng.range(0, 6.28)
  const tphase = rng.range(0, 6.28)
  let v = 0.35
  let hold = false
  let lastSwitch = -1
  let inside = 0
  let lapseUntil = -1
  const hist: { n: number; c: number }[] = []
  const steps = Math.round(BREATH_SECONDS / DT)
  for (let i = 0; i < steps; i++) {
    const t = i * DT
    const needle = needleAt(v, t, p, tphase)
    const c = bandCenter(t, phase)
    if (inBand(needle, c, p)) inside += DT
    hist.push({ n: needle, c })
    // Drifting off for a moment (sloppy): the hand keeps doing what it did.
    if (hand.lapse && t > lapseUntil && rng.chance(hand.lapse * DT)) lapseUntil = t + rng.range(0.6, 1.4)
    if (t >= lapseUntil && t - lastSwitch >= hand.minSwitch) {
      const seen = hist[Math.max(0, hist.length - 1 - Math.round(hand.lag / DT))]!
      const want = seen.n + rng.normal(0, hand.noise) < seen.c
      if (want !== hold) {
        hold = want
        lastSwitch = t
      }
    }
    v = breathStep(v, hold, DT)
  }
  const calm = calmScore(inside)
  // Forms: the right order unless a slip; each slip costs a tap and a little time.
  let el = 0
  let miss = 0
  for (let f = 0; f < 3; f++) {
    while (rng.chance(hand.slip) && miss < 6) {
      miss++
      el += Math.max(0.3, rng.normal(hand.formTime[0], hand.formTime[1]))
    }
    el += Math.max(0.4, rng.normal(hand.formTime[0], hand.formTime[1]))
  }
  const forms = formsScore(el, miss, 3, p)
  return { calm, forms, perf: dopingPerformance(calm, forms) }
}

export function dopingCurve(hand: Hand): { pass: number[]; perf: number[] } {
  const pass: number[] = []
  const perf: number[] = []
  for (const lv of LEVELS) {
    const rng = new Rng(`doping:${lv}:${hand.lag}`)
    let ok = 0
    let sum = 0
    for (let i = 0; i < TRIALS; i++) {
      const r = playDoping(lv, hand, rng)
      sum += r.perf
      if (r.perf >= DOPING_PASS) ok++
    }
    pass.push(Math.round((ok / TRIALS) * 100))
    perf.push(Math.round((sum / TRIALS) * 100) / 100)
  }
  return { pass, perf }
}

describe('doping test rules follow Composure and the input', () => {
  it('Composure widens the band, calms the hand and gives the forms more time', () => {
    const lo = dopingParams(40, 40)
    const hi = dopingParams(90, 90)
    expect(hi.band).toBeGreaterThan(lo.band)
    expect(hi.tremor).toBeLessThan(lo.tremor)
    expect(hi.formsFull).toBeGreaterThan(lo.formsFull)
  })

  it('achievable for a starting hero, monotonic, good ≫ sloppy', () => {
    const good = dopingCurve(GOOD)
    const sloppy = dopingCurve(SLOPPY)
    console.log(`\ndoping\n| player | ${LEVELS.join(' | ')} |\n| good pass | ${good.pass.map((x) => `${x}%`).join(' | ')} |\n| good avg | ${good.perf.join(' | ')} |\n| sloppy pass | ${sloppy.pass.map((x) => `${x}%`).join(' | ')} |\n| sloppy avg | ${sloppy.perf.join(' | ')} |`)
    expect(good.pass[0]).toBeGreaterThanOrEqual(58)
    expect(good.pass[0]).toBeLessThanOrEqual(78)
    for (let i = 1; i < LEVELS.length; i++) {
      expect(good.pass[i]).toBeGreaterThanOrEqual(good.pass[i - 1]! - 1)
      expect(good.perf[i]).toBeGreaterThanOrEqual(good.perf[i - 1]!)
      expect(sloppy.perf[i]).toBeGreaterThanOrEqual(sloppy.perf[i - 1]!)
    }
    LEVELS.forEach((_l, i) => expect(good.pass[i]! - sloppy.pass[i]!).toBeGreaterThanOrEqual(20))
    expect(Math.max(...sloppy.pass)).toBeLessThan(60)
  })
})
