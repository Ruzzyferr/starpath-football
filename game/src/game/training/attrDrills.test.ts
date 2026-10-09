/**
 * The attribute drills (owner requirement: every stat is trainable through a playable drill):
 * explosive starts (Acceleration), core & contact (Balance), switch of play (Long Passing),
 * reading the game (Anticipation) and pressing (Work Rate).
 */
import { describe, expect, it } from 'vitest'
import { flatAttrs } from '../setup'
import type { AttributeKey, Attributes } from '../../core/types'
import { createDrill } from './drills'
import type { DrillBase } from './base'
import type { Drill, DrillKind, DrillResult, DrillVariant } from './types'
import { idle, pressBot, readingBot, sprintBot, switchBot, type Bot, type Mem } from './attrDrillBots'
import { DRILL_FOR_TRAINING, performanceFromPoints, sprintPoints } from './scoring'
import type { SprintDrill } from './drills/sprint'

function play(d: Drill & DrillBase, bot: Bot): DrillResult {
  const s: Mem = { t: 0, mem: {} }
  for (let i = 0; i < 60 * 90 && !d.finished; i++) {
    s.t += 1 / 60
    d.update(1 / 60, bot(d, s))
  }
  expect(d.finished).toBe(true)
  return d.result()
}
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

interface Case { kind: DrillKind; variant: DrillVariant; good: Bot; meh: Bot; key: AttributeKey[] }
const CASES: Case[] = [
  { kind: 'sprint', variant: 'standard', good: sprintBot(true), meh: sprintBot(false), key: ['acceleration'] },
  { kind: 'sprint', variant: 'contact', good: sprintBot(true), meh: sprintBot(false), key: ['balance'] },
  { kind: 'crossing', variant: 'switch', good: switchBot(true), meh: switchBot(false), key: ['longPassing'] },
  { kind: 'interception', variant: 'standard', good: readingBot(true), meh: readingBot(false), key: ['anticipation'] },
  { kind: 'interception', variant: 'press', good: pressBot(true), meh: pressBot(false), key: ['workRate'] },
]
const make = (c: Case, seed: number, attrs: Attributes = flatAttrs(65)) => createDrill(c.kind, { attrs, seed, aimAssist: 'half', variant: c.variant })
const debug = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.DRILL_DEBUG

describe('attribute drills', () => {
  for (const c of CASES) {
    const name = `${c.kind}/${c.variant}`
    it(`${name}: skilled play beats sloppy play beats doing nothing`, () => {
      const seeds = [1, 2, 3]
      const good = seeds.map((s) => play(make(c, s), c.good))
      const meh = seeds.map((s) => play(make(c, s), c.meh))
      const none = seeds.map((s) => play(make(c, s), () => idle))
      const pg = avg(good.map((r) => r.performance))
      const pm = avg(meh.map((r) => r.performance))
      const pn = avg(none.map((r) => r.performance))
      if (debug) console.log(name, { pg, pm, pn, pts: good.map((r) => r.points), meh: meh.map((r) => r.points), stats: good[0]!.stats, mehStats: meh[0]!.stats })
      expect(pg).toBeGreaterThan(pm + 0.1)
      expect(pm).toBeGreaterThanOrEqual(pn)
      expect(pg).toBeGreaterThan(0.75)
      expect(pn).toBeLessThan(0.3)
    })

    it(`${name}: deterministic, and a better ${c.key.join('/')} raises the score`, () => {
      expect(play(make(c, 21), c.good)).toEqual(play(make(c, 21), c.good))
      const withAttr = (v: number): Attributes => {
        const at = { ...flatAttrs(60) }
        for (const k of c.key) at[k] = v
        return at
      }
      const run = (v: number) => avg([1, 2, 3, 4, 5, 6].map((seed) => play(make(c, seed, withAttr(v)), c.good).points))
      const weak = run(25)
      const strong = run(95)
      if (debug) console.log(name, 'attr', { weak, strong })
      expect(strong).toBeGreaterThan(weak * 1.05)
    })
  }

  it('sprint: a tap before the light is a false start; the brace window only exists in the contact variant', () => {
    const d = createDrill('sprint', { attrs: flatAttrs(65), seed: 3, variant: 'standard' }) as SprintDrill & DrillBase
    let fs = 0
    for (let i = 0; i < 60 * 3; i++) {
      d.update(1 / 60, d.live && !d.state.green ? { ...idle, actions: [{ kind: 'action' }] } : idle)
      fs = d.result().stats.falseStarts ?? 0
      if (fs > 0) break
    }
    expect(fs).toBeGreaterThan(0)
    const contact = play(createDrill('sprint', { attrs: flatAttrs(65), seed: 3, variant: 'contact' }), sprintBot(true))
    expect(contact.stats.braced ?? 0).toBeGreaterThan(0)
    const plain = play(createDrill('sprint', { attrs: flatAttrs(65), seed: 3, variant: 'standard' }), sprintBot(true))
    expect(plain.stats.braced ?? 0).toBe(0)
    // Points: reaction and the brace matter.
    expect(sprintPoints({ reaction: 'perfect', time: 2.6, dip: true, combo: 0 })).toBeGreaterThan(sprintPoints({ reaction: 'slow', time: 2.6, dip: true, combo: 0 }))
    expect(sprintPoints({ reaction: 'good', time: 2.8, dip: false, braced: true, combo: 0 })).toBeGreaterThan(sprintPoints({ reaction: 'good', time: 2.8, dip: false, braced: false, combo: 0 }))
  })

  it('every attribute session with a drill maps to a drill whose score is a 0..1 performance', () => {
    for (const [type, d] of Object.entries(DRILL_FOR_TRAINING)) {
      if (!d) continue
      expect(performanceFromPoints(d.kind, 0, d.variant), type).toBe(0)
      expect(performanceFromPoints(d.kind, 1e6, d.variant), type).toBe(1)
      const drill = createDrill(d.kind, { attrs: flatAttrs(60), seed: 1, variant: d.variant })
      expect(drill.kind).toBe(d.kind)
      expect(Number.isFinite(drill.view().span)).toBe(true)
    }
  })
})
