import { describe, expect, it } from 'vitest'
import {
  COOLDOWN, DECISION_KINDS, MAX_PER_MATCH, MAX_MINUTE, MIN_MINUTE, decisionDef, pickDecision, resolveDecision, type DecisionContext,
} from './decisions'

const base: DecisionContext = {
  seed: 'fx1', minute: 30, shown: 0, lastMinute: -99, heroOnPitch: true, diff: 0, last: null, isCaptain: false, heroOvr: 70, heroYellow: 0,
}

/** All minutes of a match in which a window opens for these inputs. */
function openings(over: Partial<DecisionContext>, seeds = 40): number {
  let n = 0
  for (let k = 0; k < seeds; k++) for (let m = 1; m <= 90; m++) if (pickDecision({ ...base, ...over, seed: `s${k}`, minute: m })) n++
  return n
}

describe('decision window rules', () => {
  it('is deterministic', () => {
    for (let m = 1; m <= 90; m++) expect(pickDecision({ ...base, minute: m, diff: -1 })).toBe(pickDecision({ ...base, minute: m, diff: -1 }))
  })
  it('respects the per-match cap, cooldown and minute bounds', () => {
    expect(openings({ shown: MAX_PER_MATCH, diff: -1 })).toBe(0)
    expect(openings({ lastMinute: 100, diff: -1 })).toBe(0)
    for (let m = 1; m < MIN_MINUTE; m++) expect(pickDecision({ ...base, minute: m, diff: -1, last: { type: 'penalty', own: true, minute: m } })).toBeNull()
    for (let m = MAX_MINUTE + 1; m <= 95; m++) expect(pickDecision({ ...base, minute: m, diff: -1, last: { type: 'goal', own: true, minute: m } })).toBeNull()
    expect(pickDecision({ ...base, minute: 40, lastMinute: 40 - COOLDOWN + 1, last: { type: 'penalty', own: true, minute: 40 } })).toBeNull()
  })
  it('never opens while the hero is off the pitch', () => {
    expect(openings({ heroOnPitch: false, diff: -1 })).toBe(0)
  })
  it('opens a penalty window right after an own penalty and a captain call after an opponent card', () => {
    let pen = 0
    let ref = 0
    for (let k = 0; k < 30; k++) {
      if (pickDecision({ ...base, seed: `p${k}`, last: { type: 'penalty', own: true, minute: 30 } }) === 'penaltyTaker') pen++
      if (pickDecision({ ...base, seed: `p${k}`, isCaptain: true, last: { type: 'yellow', own: false, minute: 30 } }) === 'refCall') ref++
    }
    expect(pen).toBeGreaterThan(20)
    expect(ref).toBeGreaterThan(10)
    expect(pickDecision({ ...base, isCaptain: false, last: { type: 'yellow', own: false, minute: 30 } })).not.toBe('refCall')
  })
  it('a full match never shows more than the cap, spaced by the cooldown', () => {
    for (let k = 0; k < 60; k++) {
      let shown = 0
      let last = -99
      const at: number[] = []
      for (let m = 1; m <= 95; m++) {
        const kind = pickDecision({ ...base, seed: `f${k}`, minute: m, shown, lastMinute: last, diff: -1, isCaptain: true, last: { type: m % 7 === 0 ? 'goal' : 'yellow', own: m % 7 === 0, minute: m } })
        if (kind) { shown++; last = m; at.push(m) }
      }
      expect(at.length).toBeLessThanOrEqual(MAX_PER_MATCH)
      if (at.length === 2) expect(at[1]! - at[0]!).toBeGreaterThanOrEqual(COOLDOWN)
    }
  })
})

describe('decision content and outcomes', () => {
  it('every kind has 2-3 bilingual options and a valid default', () => {
    for (const k of DECISION_KINDS) {
      const d = decisionDef(k, 70)
      expect(d.options.length).toBeGreaterThanOrEqual(2)
      expect(d.options.length).toBeLessThanOrEqual(3)
      expect(d.options.some((o) => o.id === d.fallback)).toBe(true)
      for (const x of [d.title, d.prompt, ...d.options.flatMap((o) => [o.label, o.hint])]) {
        expect(x.tr.length).toBeGreaterThan(1)
        expect(x.en.length).toBeGreaterThan(1)
      }
    }
  })
  it('resolves deterministically; gambles land either way over many seeds', () => {
    const d = decisionDef('provocation')
    expect(resolveDecision(d, 'answer', 'a:1')).toEqual(resolveDecision(d, 'answer', 'a:1'))
    const res = Array.from({ length: 60 }, (_, i) => resolveDecision(d, 'answer', `m${i}`))
    expect(res.some((r) => r.won && !r.effects.book)).toBe(true)
    expect(res.some((r) => r.won === false && r.effects.book && r.effects.rating < 0)).toBe(true)
  })
  it('safe options always apply their fixed effects; unknown ids use the default', () => {
    const d = decisionDef('provocation')
    const r = resolveDecision(d, 'ignore', 'x')
    expect(r.won).toBeNull()
    expect(r.effects.discipline).toBe(2)
    expect(r.effects.book).toBe(false)
    expect(resolveDecision(d, 'nope', 'x').optionId).toBe(d.fallback)
  })
  it('a better penalty taker scores more often', () => {
    const rate = (ovr: number) => {
      const d = decisionDef('penaltyTaker', ovr)
      let w = 0
      for (let i = 0; i < 400; i++) if (resolveDecision(d, 'take', `q${i}`).won) w++
      return w / 400
    }
    expect(rate(85)).toBeGreaterThan(rate(45))
  })
})

describe('decision windows after playtest Tur 3', () => {
  it('sees a penalty that was followed by the kick in the same minute', () => {
    let pen = 0
    for (let k = 0; k < 30; k++) {
      const recent = [{ type: 'penalty', own: true, minute: 30 }, { type: 'goal', own: true, minute: 30 }]
      if (pickDecision({ ...base, seed: `r${k}`, last: recent[1]!, recent }) === 'penaltyTaker') pen++
    }
    expect(pen).toBeGreaterThan(20)
  })
  it('never asks the goalkeeper to take a penalty or a free kick', () => {
    for (let k = 0; k < 40; k++) {
      for (const type of ['penalty', 'freekick']) {
        const kind = pickDecision({ ...base, seed: `k${k}`, isKeeper: true, last: { type, own: true, minute: 30 } })
        expect(kind === 'penaltyTaker' || kind === 'freeKickTaker').toBe(false)
      }
    }
  })
  it('keeps the ambient provocation window rare (well under one a match)', () => {
    let n = 0
    for (let k = 0; k < 200; k++) for (let m = 1; m <= 90; m++) if (pickDecision({ ...base, seed: `v${k}`, minute: m, diff: 0 }) === 'provocation') n++
    expect(n / 200).toBeLessThan(0.8)
  })
})

describe('leadership and the captain rally', () => {
  const chanceOf = (kind: Parameters<typeof decisionDef>[0], lead: number, id: string) =>
    decisionDef(kind, 70, lead).options.find((o) => o.id === id)!.gamble!.chance
  it('rally opens for a captain after conceding, never for a non-captain', () => {
    const conceded = { type: 'goal', own: false, minute: 40 }
    let n = 0
    for (let k = 0; k < 40; k++) {
      if (pickDecision({ ...base, seed: `y${k}`, isCaptain: true, last: conceded }) === 'rally') n++
      expect(pickDecision({ ...base, seed: `y${k}`, isCaptain: false, last: conceded })).not.toBe('rally')
    }
    expect(n).toBeGreaterThan(8)
    expect(pickDecision({ ...base, minute: 10, isCaptain: true, last: { ...conceded, minute: 10 } })).not.toBe('rally')
  })
  it('higher leadership raises gamble odds', () => {
    expect(chanceOf('rally', 90, 'rally')).toBeGreaterThan(chanceOf('rally', 30, 'rally'))
    expect(chanceOf('refCall', 90, 'protest')).toBeGreaterThan(chanceOf('refCall', 30, 'protest'))
    expect(chanceOf('shout', 90, 'demand')).toBeGreaterThan(chanceOf('shout', 30, 'demand'))
    expect(chanceOf('refCall', 60, 'protest')).toBe(0.5)
  })
  it('a won rally carries teamBoost', () => {
    const def = decisionDef('rally', 70, 90)
    let boosted = false
    for (let k = 0; k < 40; k++) if (resolveDecision(def, 'rally', `z${k}`).effects.teamBoost === 1) boosted = true
    expect(boosted).toBe(true)
    expect(resolveDecision(def, 'focus', 'z').effects.teamBoost).toBe(0)
  })
})
