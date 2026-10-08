/**
 * Event linter (2.4#7): no zero-sum dilemma where one party's loss exceeds 1.5x
 * the other party's gain inside a single choice. Effects are functions, so the
 * linter evaluates each choice on sample states (the same exercise content.test
 * uses) and inspects the relation deltas it produces.
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../../../core/rng'
import { ALL_EVENTS } from './content'
import { buildVars } from './engine'
import { makeTestState } from './testFixture'
import type { EventCtx } from './types'

export const MAX_LOSS_TO_GAIN = 1.5

/** Violations of the loss <= 1.5 x gain rule for one choice's relation deltas. */
export function dilemmaViolation(rel: readonly { target: string; amount: number }[]): string | null {
  const gain = rel.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0)
  if (gain <= 0) return null
  for (const r of rel) {
    if (r.amount < 0 && -r.amount > MAX_LOSS_TO_GAIN * gain) return `${r.target} loses ${-r.amount} for a total gain of ${gain}`
  }
  return null
}

describe('event dilemma linter (2.4#7)', () => {
  it('flags a lopsided trade and accepts a fair one', () => {
    expect(dilemmaViolation([{ target: 'fans', amount: 10 }, { target: 'manager', amount: -20 }])).toMatch(/manager/)
    expect(dilemmaViolation([{ target: 'fans', amount: 10 }, { target: 'manager', amount: -15 }])).toBeNull()
    expect(dilemmaViolation([{ target: 'manager', amount: -30 }])).toBeNull() // a pure cost is not a dilemma
  })

  it('no event choice trades more than 1.5x its gain as loss to another party', () => {
    const bad: string[] = []
    for (const def of ALL_EVENTS) {
      def.choices.forEach((choice, ci) => {
        for (let seed = 1; seed <= 3; seed++) {
          const state = makeTestState({ seed, partner: true, money: 2_000_000, reputation: 50 })
          const rng = new Rng(seed * 31 + ci)
          const vars = buildVars(state, rng, def, [], undefined)
          const ctx: EventCtx = { state, vars, absWeek: 0, tags: [] }
          try {
            const res = choice.effects(ctx, rng)
            const rel = res.deltas.flatMap((d) => (d.kind === 'relation' ? [{ target: d.target, amount: d.amount }] : []))
            const v = dilemmaViolation(rel)
            if (v) bad.push(`${def.id}#${ci}: ${v}`)
          } catch { /* exercised elsewhere */ }
        }
      })
    }
    expect([...new Set(bad)]).toEqual([])
  })
})
