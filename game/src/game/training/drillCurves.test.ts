/**
 * Balance harness for the training drills (BALANCE.md "Training drills"). Every session drill is
 * played by a good and a sloppy input bot across hero levels 40..90 and opponent strengths.
 * DRILL_CURVES=1 prints the tables; the assertions pin the curve's shape.
 */
import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_KEYS, type AttributeKey, type Attributes } from '../../core/types'
import { createDrill } from './drills'
import { BOTS, divingBot, keeperBot, finishingGood, finishingMeh, GOOD_HAND, humanize, playDrill, rondoQuick, rondoSlow, setPieceBot, SLOPPY_HAND, type Bot } from './drillBots'
import { pressBot, readingBot, sprintBot, switchBot } from './attrDrillBots'
import type { DrillKind, DrillVariant } from './types'

export interface CurveCase { id: string; kind: DrillKind; variant: DrillVariant; good: Bot; /** Decision bot for the human profile (default: good). */ human?: Bot; meh: Bot; key: AttributeKey[]; opp: boolean; /** Seeds per point (short drills need more). */ seeds?: number }
export const CURVE_CASES: CurveCase[] = [
  { id: 'finishing', kind: 'finishing', variant: 'standard', good: finishingGood, meh: finishingMeh, key: ['finishing', 'shooting', 'composure'], opp: true, seeds: 24 },
  { id: 'setPiece', kind: 'finishing', variant: 'setPiece', good: setPieceBot(true), meh: setPieceBot(false), key: ['setPieces', 'curve'], opp: true, seeds: 40 },
  { id: 'passing', kind: 'passing', variant: 'standard', good: BOTS.passing.good, meh: BOTS.passing.meh, key: ['passing', 'vision', 'firstTouch'], opp: false },
  { id: 'rondo', kind: 'passing', variant: 'rondo', good: rondoQuick, meh: rondoSlow, key: ['passing', 'vision', 'firstTouch'], opp: true },
  { id: 'dribbling', kind: 'dribbling', variant: 'standard', good: BOTS.dribbling.good, meh: BOTS.dribbling.meh, key: ['dribbling', 'agility', 'firstTouch'], opp: true, seeds: 64 },
  { id: 'fitness', kind: 'fitness', variant: 'standard', good: BOTS.fitness.good, meh: BOTS.fitness.meh, key: ['stamina', 'pace'], opp: false },
  { id: 'goalkeeping', kind: 'goalkeeping', variant: 'standard', good: BOTS.goalkeeping.good, meh: BOTS.goalkeeping.meh, key: ['reflexes', 'handling', 'gkPositioning', 'diving'], opp: true, seeds: 40 },
  { id: 'diving', kind: 'goalkeeping', variant: 'diving', good: divingBot, human: keeperBot(true), meh: keeperBot(false), key: ['diving'], opp: true, seeds: 40 },
  { id: 'crossing', kind: 'crossing', variant: 'standard', good: BOTS.crossing.good, meh: BOTS.crossing.meh, key: ['crossing', 'curve'], opp: false },
  { id: 'switch', kind: 'crossing', variant: 'switch', good: switchBot(true), meh: switchBot(false), key: ['longPassing'], opp: false },
  { id: 'heading', kind: 'heading', variant: 'standard', good: BOTS.heading.good, meh: BOTS.heading.meh, key: ['heading', 'jumping'], opp: true },
  { id: 'tackling', kind: 'tackling', variant: 'standard', good: BOTS.tackling.good, meh: BOTS.tackling.meh, key: ['tackling', 'positioning'], opp: true, seeds: 48 },
  { id: 'distribution', kind: 'distribution', variant: 'standard', good: BOTS.distribution.good, meh: BOTS.distribution.meh, key: ['gkDistribution', 'handling'], opp: true, seeds: 32 },
  { id: 'sprint', kind: 'sprint', variant: 'standard', good: sprintBot(true), meh: sprintBot(false), key: ['acceleration'], opp: false },
  { id: 'contact', kind: 'sprint', variant: 'contact', good: sprintBot(true), meh: sprintBot(false), key: ['balance'], opp: false },
  { id: 'reading', kind: 'interception', variant: 'standard', good: BOTS.interception.good, human: readingBot(true, true), meh: BOTS.interception.meh, key: ['anticipation'], opp: true, seeds: 40 },
  { id: 'pressing', kind: 'interception', variant: 'press', good: pressBot(true), meh: pressBot(false), key: ['workRate'], opp: true },
]

export const LEVELS = [40, 50, 60, 70, 80, 90]
/** Weak / average / strong opposition for a level-50 hero. */
export const OPP_LEVELS = [40, 56, 72]
const seedsFor = (c: CurveCase): number[] => Array.from({ length: c.seeds ?? 16 }, (_, i) => i + 1)
/** A hero at level v: every attribute (goalkeeping ones included) at v. */
export const levelAttrs = (v: number): Attributes => Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, v])) as Attributes
/** A level-50 hero whose drill attributes are at v. */
const keyAttrs = (c: CurveCase, v: number): Attributes => ({ ...levelAttrs(50), ...Object.fromEntries(c.key.map((k) => [k, v])) })

export function perf(c: CurveCase, attrs: Attributes, bot: Bot, opponent?: number, seeds = seedsFor(c), raw = false): number {
  const ps = seeds.map((seed) => {
    const r = playDrill(createDrill(c.kind, { attrs, seed, aimAssist: 'half', variant: c.variant, ...(opponent ? { opponent } : {}) }), bot)
    return raw ? r.points / 100 : r.performance
  })
  return Math.round((ps.reduce((a, b) => a + b, 0) / ps.length) * 100)
}

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const only = env.DRILL_ONLY ? env.DRILL_ONLY.split(',') : null

describe.runIf(env.DRILL_CURVES)('drill curves (report)', () => {
  for (const c of CURVE_CASES.filter((x) => !only || only.includes(x.id))) {
    it(c.id, async () => {
      const hg = humanize(c.human ?? c.good, GOOD_HAND)
      const hm = humanize(c.meh, SLOPPY_HAND)
      const perfect = LEVELS.map((v) => perf(c, levelAttrs(v), c.good))
      const good = LEVELS.map((v) => perf(c, levelAttrs(v), hg))
      const meh = LEVELS.map((v) => perf(c, levelAttrs(v), hm))
      const keyG = LEVELS.map((v) => perf(c, keyAttrs(c, v), hg))
      const opp = c.opp ? OPP_LEVELS.map((o) => perf(c, levelAttrs(50), hg, o)) : []
      const statsOf = (bot: Bot) => {
        const tot: Record<string, number> = {}
        for (const seed of seedsFor(c)) for (const [k, v] of Object.entries(playDrill(createDrill(c.kind, { attrs: levelAttrs(50), seed, aimAssist: 'half', variant: c.variant }), bot).stats)) tot[k] = Math.round(((tot[k] ?? 0) + v / seedsFor(c).length) * 10) / 10
        return JSON.stringify(tot)
      }
      const p50 = perf(c, levelAttrs(50), hg, undefined, seedsFor(c), true)
      const p90 = perf(c, levelAttrs(90), hg, undefined, seedsFor(c), true)
      const gamma = Math.min(2.2, Math.max(0.85, Math.log(0.92 / 0.67) / Math.log(Math.max(1.01, p90 / p50))))
      const suggest = `suggest: par ${Math.round(p50 / Math.pow(0.67, 1 / gamma))} curve ${gamma.toFixed(2)} (pts50 ${p50} pts90 ${p90})`
      const rawRow = env.DRILL_STATS ? `| good pts | ${LEVELS.map((v) => perf(c, levelAttrs(v), hg, undefined, seedsFor(c), true)).join(' | ')} |
| sloppy pts | ${LEVELS.map((v) => perf(c, levelAttrs(v), hm, undefined, seedsFor(c), true)).join(' | ')} |` : ''
      const dbg = env.DRILL_STATS ? [rawRow, `stats@50 good ${statsOf(hg)}`, `stats@50 sloppy ${statsOf(hm)}`, `stats@50 perfect ${statsOf(c.good)}`].join('\n') : ''
      const row = (n: string, xs: number[]) => `| ${n} | ${xs.join(' | ')} |`
      const out = [`### ${c.id} (${c.key.join(', ')})`, `| input | ${LEVELS.join(' | ')} |`, row('bot (perfect)', perfect), row('good', good), row('sloppy', meh), row('good, key only', keyG), c.opp ? `opp 40/56/72 @50 good: ${opp.join(' / ')}` : '', env.DRILL_SUGGEST ? suggest : '', dbg].join('\n')
      if (env.DRILL_OUT) ((await import('node:fs')) as unknown as { appendFileSync(p: string, d: string): void }).appendFileSync(env.DRILL_OUT, out + '\n\n')
      else console.log(out)
      expect(good.length).toBe(LEVELS.length)
    }, 300_000)
  }
})

/**
 * Pinned shape of every drill's curve (BALANCE.md "Training drills"): a starting hero with good input
 * passes, success climbs with the attributes, sloppy input stays well behind, a stronger opposition
 * scores lower. Tolerances absorb seed noise; the report above prints the full tables.
 */
describe.skipIf(env.DRILL_CURVES)('drill curves (pinned)', () => {
  for (const c of CURVE_CASES) {
    it(`${c.id}: achievable at 50, monotonic in the attributes, sloppy behind, opposition matters`, () => {
      const hg = humanize(c.human ?? c.good, GOOD_HAND)
      const hm = humanize(c.meh, SLOPPY_HAND)
      const g = Object.fromEntries([40, 50, 70, 90].map((v) => [v, perf(c, levelAttrs(v), hg)])) as Record<number, number>
      const m50 = perf(c, levelAttrs(50), hm)
      const m90 = perf(c, levelAttrs(90), hm)
      // A starting hero (≈ 50) with good input passes (grade B+ ≈ 60–75 %, a little slack for seed noise).
      expect(g[50]!).toBeGreaterThanOrEqual(55)
      expect(g[50]!).toBeLessThanOrEqual(80)
      // Monotonic in the attributes; a strong hero is clearly better.
      expect(g[40]!).toBeLessThanOrEqual(g[50]! + 3)
      expect(g[50]!).toBeLessThanOrEqual(g[70]! + 3)
      expect(g[70]!).toBeLessThanOrEqual(g[90]! + 3)
      expect(g[90]!).toBeGreaterThanOrEqual(g[50]! + 15)
      // Sloppy input struggles at every level.
      expect(m50).toBeLessThanOrEqual(g[50]! - 14)
      expect(m90).toBeLessThanOrEqual(g[90]! - 20)
      if (c.opp) {
        const [weak, , strong] = OPP_LEVELS.map((o) => perf(c, levelAttrs(50), hg, o))
        expect(strong!).toBeLessThan(weak! - 3)
        expect(strong!).toBeLessThanOrEqual(g[50]! + 2)
      }
    }, 300_000)
  }
})
