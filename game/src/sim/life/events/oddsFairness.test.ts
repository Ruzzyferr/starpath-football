/**
 * Odds fairness audit (tester feedback, TestFlight build 6: "at 75% it failed three
 * times in a row — do the choices really follow their chance?").
 *
 * - The % on the card is exactly the probability the roll uses (whole percent, no
 *   hidden modifiers after display), and success + mixed + fail = 100.
 * - Over 10k rolls the measured rate sits within ±1.5 points of the shown one.
 * - Consecutive cards draw fresh numbers from the persistent game rng: no reused
 *   draw, no per-day seed, no correlation between one card and the next.
 *
 * ODDS_REPORT=1 prints the measured rates.
 */
import { describe, expect, it } from 'vitest'
import { Rng, hashString } from '../../../core/rng'
import type { GameState, PendingEvent } from '../../../core/types'
import { makeGame } from '../../game/testHelpers'
import { resolveEventChoice } from '../../game/actions'
import { ALL_EVENTS } from './content'
import { absoluteWeek, buildVars, describeEvent } from './engine'
import { MIXED_SHARE, choiceOdds, rollChoice, rollTier, type ChoiceOdds } from './odds'
import type { EventCtx, EventDef, EventVars } from './types'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const REPORT = !!env['ODDS_REPORT']
const N = 10_000
const TOL = 1.5 // percentage points

interface Row { def: EventDef; idx: number; vars: EventVars; odds: ChoiceOdds }

function rolledChoices(s: GameState): Row[] {
  const rows: Row[] = []
  for (const def of ALL_EVENTS) {
    let vars: EventVars
    try {
      vars = buildVars(s, new Rng(hashString(def.id)), def, def.triggers ?? ['weekly'])
    } catch {
      continue
    }
    def.choices.forEach((_c, idx) => {
      const odds = choiceOdds(s, def, idx, vars)
      if (!odds.noRisk) rows.push({ def, idx, vars, odds })
    })
  }
  return rows
}

const pctOf = (x: number): number => Math.round(x * 100)

describe('decision-card odds are honest', () => {
  it('shown odds are whole percentages that add up to exactly 100', () => {
    const s = makeGame(31)
    const rows = rolledChoices(s)
    expect(rows.length).toBeGreaterThan(100)
    for (const r of rows) {
      for (const x of [r.odds.success, r.odds.mixed, r.odds.fail]) expect(Math.abs(x * 100 - Math.round(x * 100))).toBeLessThan(1e-9)
      expect(pctOf(r.odds.success) + pctOf(r.odds.mixed) + pctOf(r.odds.fail)).toBe(100)
    }
  })

  it('the card view shows exactly the odds the roll then uses (no modifier after display)', () => {
    const s = makeGame(32)
    for (const def of ALL_EVENTS.slice(0, 120)) {
      let vars: EventVars
      try {
        vars = buildVars(s, new Rng(hashString(def.id)), def, def.triggers ?? ['weekly'])
      } catch {
        continue
      }
      const pe: PendingEvent = { defId: def.id, vars, firedAt: { ...s.calendar } }
      const view = describeEvent(s, pe, 'en')
      if (!view) continue
      const ctx: EventCtx = { state: s, vars, absWeek: absoluteWeek(s.calendar), tags: [] }
      view.choices.forEach((c, idx) => {
        if (!c.enabled || !c.odds) return
        const rolled = rollChoice(ctx, def, idx, new Rng(idx + 1))
        expect(rolled.odds.success).toBe(c.odds.success)
        expect(rolled.odds.mixed).toBe(c.odds.mixed)
        expect(rolled.odds.fail).toBe(c.odds.fail)
        // The tier is exactly the band the draw fell in.
        if (!rolled.odds.noRisk) expect(rolled.tier).toBe(rollTier(rolled.odds, rolled.roll))
      })
    }
  })

  it.each([25, 50, 75, 90])('shown p=%i → measured rate within ±1.5 points over 10k sequential rolls', (p) => {
    const mixed = Math.round((100 - p) * MIXED_SHARE.low)
    const o = { success: p / 100, mixed: mixed / 100 }
    const rng = new Rng(`fairness:${p}`) // one persistent stream, like the game's
    const seen = { success: 0, mixed: 0, fail: 0 }
    for (let i = 0; i < N; i++) seen[rollTier(o, rng.next())]++
    const rate = (k: keyof typeof seen) => (seen[k] / N) * 100
    if (REPORT) console.log(`shown ${p}% / ${mixed}% / ${100 - p - mixed}%  →  measured ${rate('success').toFixed(2)}% / ${rate('mixed').toFixed(2)}% / ${rate('fail').toFixed(2)}%`)
    expect(Math.abs(rate('success') - p)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(rate('mixed') - mixed)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(rate('fail') - (100 - p - mixed))).toBeLessThanOrEqual(TOL)
  })

  it('real cards near 25/50/75/90%: rollChoice over 10k sequential draws matches the shown %', () => {
    // A struggling, an average and a thriving hero, so the real cards span the whole range.
    const heroes = [-1, 0, 1].map((k) => {
      const g = makeGame(33)
      for (const a of Object.keys(g.hero.attrs) as (keyof typeof g.hero.attrs)[]) g.hero.attrs[a] = 52 + k * 30
      g.hero.morale = 55 + k * 40
      g.hero.managerTrust = 50 + k * 45
      g.life.stress = 30 - k * 25
      for (const rel of Object.values(g.life.relationships)) rel.value = k * 70
      return g
    })
    const rows = heroes.flatMap((g) => rolledChoices(g).map((r) => ({ ...r, g })))
    const rng = new Rng('fairness:real')
    for (const target of [25, 50, 75, 90]) {
      const r = rows.reduce((a, b) => (Math.abs(pctOf(b.odds.success) - target) < Math.abs(pctOf(a.odds.success) - target) ? b : a))
      const ctx: EventCtx = { state: r.g, vars: r.vars, absWeek: absoluteWeek(r.g.calendar), tags: [] }
      const shown = pctOf(choiceOdds(ctx.state, r.def, r.idx, r.vars).success)
      expect(Math.abs(shown - target)).toBeLessThanOrEqual(3)
      let ok = 0
      for (let i = 0; i < N; i++) if (rollChoice(ctx, r.def, r.idx, rng).tier === 'success') ok++
      const rate = (ok / N) * 100
      if (REPORT) console.log(`${r.def.id}#${r.idx}: shown ${shown}%  measured ${rate.toFixed(2)}%`)
      expect(Math.abs(rate - shown)).toBeLessThanOrEqual(TOL)
    }
  })

  it('consecutive cards are independent: no reused draw, no streak correlation', () => {
    const o = { success: 0.75, mixed: 0.11 }
    const rng = new Rng('fairness:streak')
    const ok: boolean[] = []
    for (let i = 0; i < 4 * N; i++) ok.push(rollTier(o, rng.next()) === 'success')
    const p = ok.filter(Boolean).length / ok.length
    // P(success | previous failed) == P(success)
    let afterMiss = 0
    let afterMissOk = 0
    let triples = 0
    for (let i = 1; i < ok.length; i++) {
      if (!ok[i - 1]) { afterMiss++; if (ok[i]) afterMissOk++ }
      if (i >= 2 && !ok[i] && !ok[i - 1] && !ok[i - 2]) triples++
    }
    const condP = afterMissOk / afterMiss
    // Lag-1 autocorrelation of the success indicator.
    const xs = ok.map((b) => (b ? 1 : 0) - p)
    let num = 0
    let den = 0
    for (let i = 0; i < xs.length; i++) { den += xs[i]! * xs[i]!; if (i > 0) num += xs[i]! * xs[i - 1]! }
    const r1 = num / den
    const tripleRate = triples / (ok.length - 2)
    if (REPORT) console.log(`P(success)=${(p * 100).toFixed(2)}%  P(success|prev miss)=${(condP * 100).toFixed(2)}%  lag1 r=${r1.toFixed(4)}  3 misses in a row=${(tripleRate * 100).toFixed(2)}% (expected ${(0.25 ** 3 * 100).toFixed(2)}%)`)
    expect(Math.abs(condP - p) * 100).toBeLessThanOrEqual(TOL * 1.5)
    expect(Math.abs(r1)).toBeLessThan(0.02)
    expect(Math.abs(tripleRate - 0.25 ** 3) * 100).toBeLessThan(0.5)
  })

  it('in the game, two identical cards resolved back to back get different, fresh draws from the saved rng', () => {
    const s = makeGame(34)
    const rows = rolledChoices(s)
    const r = rows.find((x) => !x.def.choices[x.idx]!.requires && pctOf(x.odds.success) >= 60 && pctOf(x.odds.success) <= 85)!
    const draws: number[] = []
    for (let i = 0; i < 40; i++) {
      s.pendingEvents = [{ defId: r.def.id, vars: r.vars, firedAt: { ...s.calendar }, uid: `${r.def.id}#t${i}` }]
      const before = JSON.stringify(s.rng)
      const res = resolveEventChoice(s, 0, r.idx)
      if (!res.ok || !res.value) continue
      expect(JSON.stringify(s.rng)).not.toBe(before) // the persistent stream advanced
      expect(res.value.roll).toBeGreaterThanOrEqual(0)
      expect(res.value.roll).toBeLessThan(1)
      expect(res.value.outcome).toBe(rollTier({ success: res.value.chance!, mixed: res.value.mixedChance! }, res.value.roll!))
      draws.push(res.value.roll!)
    }
    expect(draws.length).toBeGreaterThan(20)
    expect(new Set(draws).size).toBe(draws.length) // never the same draw twice
  })
})
