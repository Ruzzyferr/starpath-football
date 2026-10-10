import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { SLOT_PAYLINES, SLOT_PAYTABLE, SLOT_TWO_CHERRY, slotExactRtp, spinSlot } from '../../sim/life/casino'
import { casinoAgeLock, SLOT_UI_INDEX, slotRulesView, slotSpinView } from './casinoView'

describe('slot view = slot sim', () => {
  it('paytable and paylines shown are exactly what the sim pays', () => {
    const rules = slotRulesView()
    expect(rules.lines).toEqual(SLOT_PAYLINES.map((l) => [...l]))
    for (const [sym, m] of Object.entries(SLOT_PAYTABLE)) {
      expect(rules.pays).toContainEqual({ symbol: SLOT_UI_INDEX[sym as keyof typeof SLOT_PAYTABLE], count: 3, multiplier: m })
    }
    expect(rules.pays).toContainEqual({ symbol: SLOT_UI_INDEX.cherry, count: 2, multiplier: SLOT_TWO_CHERRY })
    // Distinct UI symbols for distinct sim symbols.
    expect(new Set(Object.values(SLOT_UI_INDEX)).size).toBe(Object.keys(SLOT_UI_INDEX).length)
  })

  it('every paying line is visible in the 3×3 window and the amounts add up', () => {
    const rng = new Rng(9)
    const rules = slotRulesView()
    let wins = 0
    for (let i = 0; i < 4000; i++) {
      const stake = 50
      const spin = spinSlot(rng, stake)
      const v = slotSpinView(spin, stake)
      expect(v.window).toHaveLength(3)
      for (const col of v.window) expect(col).toHaveLength(3)
      expect(v.reels).toEqual(v.window.map((c) => c[1]))
      for (const w of v.wins) {
        const rows = rules.lines[w.line]!
        for (let reel = 0; reel < w.count; reel++) expect(v.window[reel]![rows[reel]!]).toBe(w.symbol)
        const pay = rules.pays.find((p) => p.symbol === w.symbol && p.count === w.count)
        expect(pay?.multiplier).toBe(w.multiplier)
        wins++
      }
      const shown = v.wins.reduce((s, w) => s + w.multiplier * (stake / rules.lines.length), 0)
      expect(shown).toBeCloseTo(spin.payout, 6)
      expect(v.net).toBe(Math.round(spin.payout - stake))
    }
    expect(wins).toBeGreaterThan(200)
  })

  it('RTP stays ~94%', () => {
    expect(slotExactRtp()).toBeGreaterThan(0.93)
    expect(slotExactRtp()).toBeLessThan(0.955)
  })
})

describe('casino age lock', () => {
  it('locks under 21 with years left, opens at 21', () => {
    expect(casinoAgeLock({ birthYear: 2008 }, 2026)).toEqual({ minAge: 21, yearsLeft: 3 })
    expect(casinoAgeLock({ birthYear: 2006 }, 2026)).toEqual({ minAge: 21, yearsLeft: 1 })
    expect(casinoAgeLock({ birthYear: 2005 }, 2026)).toBeNull()
    expect(casinoAgeLock(null, 2026)).toBeNull()
  })
})
