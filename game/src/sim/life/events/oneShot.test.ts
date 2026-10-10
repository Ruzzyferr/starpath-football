/**
 * One-shot decision cards + chance / certain choices (owner bug + spec, TestFlight build 7:
 * "the wheel failed, then I could pick the same option again and it worked").
 *
 * - every outcome of every choice changes something (no effect-free result);
 * - a chance choice's success and fail are different consequences;
 * - a certain choice never spins (no roll, no odds) and applies exactly its preview;
 * - resolving the same card twice is a no-op, also after a save → load round trip;
 * - certain choices use a broad mix of effect dimensions (money ≤ 30 %).
 *
 * EVENT_REPORT=1 prints the chance / certain counts and the dimension distribution.
 */
import { describe, expect, it } from 'vitest'
import { Rng, hashString } from '../../../core/rng'
import type { GameState } from '../../../core/types'
import { makeGame } from '../../game/testHelpers'
import { EVENT_ALREADY_RESOLVED, resolveEventChoice } from '../../game/actions'
import { ALL_EVENTS } from './content'
import { EventAlreadyResolvedError, absoluteWeek, buildVars, isEventResolved, pendingKey, resolveEvent, rollEvents } from './engine'
import { FLAG_ANSWERS, certainResult, choiceOdds, deltaValue, readAnswers, rollChoice, type OutcomeTier } from './odds'
import type { Delta, EventCtx, EventDef, EventVars } from './types'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const REPORT = !!env['EVENT_REPORT']

/** An Rng whose first draw is fixed (forces the wheel's band); later draws are a normal stream. */
class FirstDraw extends Rng {
  private armed?: boolean
  private readonly u: number
  constructor(u: number) {
    super(7)
    this.u = Math.floor(u * 4294967296) >>> 0
    this.armed = true
  }
  override nextUint(): number {
    if (this.armed) {
      this.armed = false
      return this.u
    }
    return super.nextUint()
  }
}

interface Card { def: EventDef; vars: EventVars; ctx: EventCtx }

function cards(s: GameState): Card[] {
  const out: Card[] = []
  for (const def of ALL_EVENTS) {
    let vars: EventVars
    try {
      vars = buildVars(s, new Rng(hashString(def.id)), def, def.triggers ?? ['weekly'])
    } catch {
      continue
    }
    out.push({ def, vars, ctx: { state: s, vars, absWeek: absoluteWeek(s.calendar), tags: [] } })
  }
  return out
}

const sig = (deltas: readonly Delta[]): string => JSON.stringify(deltas)

/** Owner's effect dimensions, by a delta's kind. */
function dimension(d: Delta): string {
  switch (d.kind) {
    case 'money': return 'money'
    case 'relation': case 'endRelation': return 'relationship'
    case 'reputation': case 'followers': return 'reputation/fame'
    case 'attr': return 'attribute XP'
    case 'discipline': case 'suspension': return 'discipline'
    case 'injury': return 'fitness'
    case 'stat':
      switch (d.key) {
        case 'fatigue': case 'energy': case 'health': case 'sharpness': return 'fitness'
        case 'form': return 'form'
        case 'managerTrust': return 'selection (manager trust)'
        case 'morale': return 'morale'
        case 'addiction': return 'discipline'
        case 'stress': return 'stress'
        default: return 'happiness'
      }
    default: return 'other (brand, sponsors, goals)'
  }
}

describe('decision cards: chance vs certain, every outcome real', () => {
  const s = makeGame(77)
  const all = cards(s)

  it('(a)+(b) no outcome is effect-free; a chance choice has distinct success and fail consequences', () => {
    const empty: string[] = []
    const same: string[] = []
    let chance = 0
    let certain = 0
    for (const { def, vars, ctx } of all) {
      def.choices.forEach((_c, i) => {
        const o = choiceOdds(s, def, i, vars)
        if (o.kind === 'certain') {
          certain++
          if (certainResult(ctx, def, i).deltas.length === 0) empty.push(`${def.id}#${i} certain`)
          return
        }
        chance++
        const S = Math.round(o.success * 100)
        const M = Math.round(o.mixed * 100)
        const draws: Partial<Record<OutcomeTier, number>> = { success: 0, fail: 0.995 }
        if (M > 0) draws.mixed = (S + M / 2) / 100
        const res: Partial<Record<OutcomeTier, Delta[]>> = {}
        for (const [tier, u] of Object.entries(draws) as [OutcomeTier, number][]) {
          const r = rollChoice(ctx, def, i, new FirstDraw(u))
          expect(r.tier, `${def.id}#${i}`).toBe(tier)
          res[tier] = r.result.deltas
          if (r.result.deltas.length === 0) empty.push(`${def.id}#${i} ${tier}`)
        }
        if (sig(res.success!) === sig(res.fail!)) same.push(`${def.id}#${i}`)
      })
    }
    if (REPORT) console.log(`choices: ${chance + certain} = chance ${chance} + certain ${certain}`)
    expect(empty).toEqual([])
    expect(same).toEqual([])
    expect(chance).toBeGreaterThan(300)
    expect(certain).toBeGreaterThan(300)
  })

  it('certain choices use a broad mix of effect dimensions; money is not the main effect of more than 30%', () => {
    const main: Record<string, number> = {}
    let n = 0
    for (const { def, vars, ctx } of all) {
      def.choices.forEach((_c, i) => {
        if (choiceOdds(s, def, i, vars).kind !== 'certain') return
        const deltas = certainResult(ctx, def, i).deltas
        if (!deltas.length) return
        const top = [...deltas].sort((a, b) => Math.abs(deltaValue(s, b)) - Math.abs(deltaValue(s, a)))[0]!
        const dim = dimension(top)
        main[dim] = (main[dim] ?? 0) + 1
        n++
      })
    }
    const rows = Object.entries(main).sort((a, b) => b[1] - a[1])
    if (REPORT) console.log(`certain choices by main effect (${n}):\n${rows.map(([k, v]) => `  ${k.padEnd(28)} ${String(v).padStart(4)}  ${Math.round((v / n) * 100)}%`).join('\n')}`)
    expect((main['money'] ?? 0) / n).toBeLessThanOrEqual(0.3)
    // At least eight different dimensions lead somewhere in the catalogue, none above 30 %.
    expect(rows.length).toBeGreaterThanOrEqual(8)
    for (const [k, v] of rows) expect(v / n, k).toBeLessThanOrEqual(0.3)
  })
})

describe('decision cards are one-shot', () => {
  /** A fresh career with one pending card of `def` (with a real uid). */
  function withCard(def: EventDef, seed = 21): GameState {
    const s = makeGame(seed)
    s.life.money = 1_000_000
    const vars = buildVars(s, new Rng(hashString(def.id)), def, def.triggers ?? ['weekly'])
    s.pendingEvents = [{ defId: def.id, vars, firedAt: { ...s.calendar }, uid: `${def.id}#1` }]
    return s
  }
  const firstOf = (kind: 'chance' | 'certain'): { def: EventDef; idx: number } => {
    const s = makeGame(21)
    s.life.money = 1_000_000
    for (const def of ALL_EVENTS) {
      if (def.choices.some((c) => c.requires)) continue
      const vars = buildVars(s, new Rng(hashString(def.id)), def, def.triggers ?? ['weekly'])
      const idx = def.choices.findIndex((_c, i) => choiceOdds(s, def, i, vars).kind === kind)
      if (idx >= 0) return { def, idx }
    }
    throw new Error(`no ${kind} choice`)
  }

  it('(c) a certain choice never spins: no roll, no odds, no game-rng draw for the decision, exactly the preview', () => {
    const { def, idx } = firstOf('certain')
    const s = withCard(def)
    const p = s.pendingEvents[0]!
    const preview = certainResult({ state: s, vars: p.vars, absWeek: absoluteWeek(s.calendar), tags: [] }, def, idx)
    const r = resolveEventChoice(s, p.uid!, idx)
    expect(r.ok).toBe(true)
    expect(r.value!.outcome).toBe('certain')
    expect(r.value!.roll).toBeUndefined()
    expect(r.value!.chance).toBeUndefined()
    expect(r.value!.text).toEqual(expect.objectContaining({ en: expect.any(String) }))
    expect(r.value!.deltas.length).toBeGreaterThan(0)
    // Applied deltas are the preview's (same kinds, in order; amounts may only be clamped).
    expect(r.value!.deltas.map((d) => d.kind)).toEqual(preview.deltas.filter((d) => r.value!.deltas.some((x) => x.kind === d.kind)).map((d) => d.kind))
    expect(readAnswers(s)[def.id]).toEqual(expect.objectContaining({ c: idx, o: 'certain' }))
  })

  it('(d) resolving the same card twice is a no-op (engine, action, and after a save/load round trip)', () => {
    const { def, idx } = firstOf('chance')
    const s = withCard(def)
    const p = s.pendingEvents[0]!
    const key = pendingKey(p)
    const first = resolveEventChoice(s, key, idx)
    expect(first.ok).toBe(true)
    expect(['success', 'mixed', 'fail']).toContain(first.value!.outcome)
    expect(s.pendingEvents).toHaveLength(0)
    expect(isEventResolved(s, key)).toBe(true)

    const snap = JSON.stringify(s)
    // Same key again (double tap / stale screen): refused, nothing changes, no second roll.
    const again = resolveEventChoice(s, key, idx)
    expect(again.ok).toBe(false)
    expect(again.error).toEqual(EVENT_ALREADY_RESOLVED)
    expect(JSON.stringify(s)).toBe(snap)
    // The engine refuses the stale pending object itself.
    expect(() => resolveEvent(s, new Rng(1), p, idx)).toThrow(EventAlreadyResolvedError)
    expect(JSON.stringify(s)).toBe(snap)

    // Reload (JSON round trip = what the save stores): the card is not back and stays answered.
    const loaded = JSON.parse(snap) as GameState
    expect(loaded.pendingEvents).toHaveLength(0)
    expect(resolveEventChoice(loaded, key, idx).ok).toBe(false)
    // Even if a stale copy of the card were pushed back (old autosave merged in), it cannot be answered again.
    loaded.pendingEvents.push(JSON.parse(JSON.stringify(p)))
    const before = JSON.stringify(loaded)
    expect(() => resolveEvent(loaded, new Rng(1), loaded.pendingEvents[0]!, idx)).toThrow(EventAlreadyResolvedError)
    expect(JSON.stringify(loaded)).toBe(before)
  })

  it('a stale index can never answer a different card: resolving by key targets exactly that card', () => {
    const { def, idx } = firstOf('certain')
    const other = ALL_EVENTS.find((e) => e.id !== def.id && !e.choices.some((c) => c.requires))!
    const s = withCard(def)
    const vars = buildVars(s, new Rng(5), other, other.triggers ?? ['weekly'])
    s.pendingEvents.push({ defId: other.id, vars, firedAt: { ...s.calendar }, uid: `${other.id}#2` })
    const key = s.pendingEvents[0]!.uid!
    expect(resolveEventChoice(s, key, idx).ok).toBe(true)
    // The double tap re-sends the same key: refused, the other card is untouched.
    expect(resolveEventChoice(s, key, idx).ok).toBe(false)
    expect(s.pendingEvents.map((p) => p.uid)).toEqual([`${other.id}#2`])
  })

  it('past answers matter: a backfire on a card lowers its odds next time; paying someone off makes the card come back', () => {
    const { def, idx } = firstOf('chance')
    const s = withCard(def)
    const vars = s.pendingEvents[0]!.vars
    const before = choiceOdds(s, def, idx, vars).success
    s.life.flags[FLAG_ANSWERS] = JSON.stringify({ [def.id]: { c: idx, o: 'fail', w: absoluteWeek(s.calendar) } })
    const after = choiceOdds(s, def, idx, vars)
    expect(after.success).toBeLessThan(before)
    expect(after.factors.some((f) => f.key === 'memory' && f.pts < 0)).toBe(true)
  })

  it('every fired card gets a unique uid', () => {
    const s = makeGame(5)
    const rng = new Rng(9)
    const seen: string[] = []
    for (let i = 0; i < 40; i++) {
      s.calendar.week = 1 + (i % 30)
      if (i % 30 === 0 && i) s.calendar.season++
      for (const p of rollEvents(s, rng, ['weekly'], 2, { fireChance: 1 })) {
        expect(p.uid).toBeTruthy()
        seen.push(p.uid!)
      }
      while (s.pendingEvents.length) {
        const r = resolveEventChoice(s, s.pendingEvents[0]!.uid!, 0)
        if (!r.ok) s.pendingEvents.shift()
      }
    }
    expect(seen.length).toBeGreaterThan(10)
    expect(new Set(seen).size).toBe(seen.length)
  })
})
