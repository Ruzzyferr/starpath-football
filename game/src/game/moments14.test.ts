/**
 * WP-14 moment kinds end to end: hold-up play (top saklama), 1v1 defending
 * and the shot block — generation, runtime rules, auto-resolve, prompts.
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../core/rng'
import { generatedHighlight } from './demoHighlights'
import { HighlightRuntime, HOLD_UP_SECONDS } from './runtime'
import { autoResolve } from '../sim/match/autoResolve'
import { HIGHLIGHT_PROMPTS } from '../sim/match/commentary'
import { DEFENSIVE_KINDS, type HighlightKind } from '../sim/match/types'
import { makeAttributes } from '../sim/match/testFixtures'
import { kindWeights } from '../sim/match/highlightGen'
import { tr as trMatch, en as enMatch } from '../i18n/sections/match'

const NEW: HighlightKind[] = ['hold_up', 'defend_1v1', 'block']

describe('WP-14 kinds: data', () => {
  it('have prompts and names in both languages, and sit in the position weights', () => {
    for (const k of NEW) {
      expect(HIGHLIGHT_PROMPTS[k].tr.length).toBeGreaterThan(10)
      expect(HIGHLIGHT_PROMPTS[k].en.length).toBeGreaterThan(10)
      expect((trMatch.kind as Record<string, string>)[k]).toBeTruthy()
      expect((enMatch.kind as Record<string, string>)[k]).toBeTruthy()
    }
    expect(kindWeights('ST').hold_up).toBeGreaterThan(0)
    expect(kindWeights('CB').block).toBeGreaterThan(0)
    expect(kindWeights('RB').defend_1v1).toBeGreaterThan(0)
    expect(DEFENSIVE_KINDS.has('block') && DEFENSIVE_KINDS.has('defend_1v1') && !DEFENSIVE_KINDS.has('hold_up')).toBe(true)
  })

  it('auto-resolve gives sensible outcomes', () => {
    const rng = new Rng(4)
    for (const k of NEW) {
      const attrs = makeAttributes(rng, k === 'hold_up' ? 'ST' : 'CB', 70)
      const seen = new Set<string>()
      for (let i = 0; i < 200; i++) seen.add(autoResolve(k, attrs, 1, rng).outcome)
      if (k === 'hold_up') expect(seen.has('pass_complete') && seen.has('lost_ball')).toBe(true)
      else expect(seen.has('defended') && (seen.has('conceded') || seen.has('shot_conceded'))).toBe(true)
    }
  })
})

describe('WP-14 kinds: generated scenarios', () => {
  it('hold-up: hero on the ball back to goal with a marker tight on his back', () => {
    for (let s = 1; s <= 10; s++) {
      const h = generatedHighlight('hold_up', s)
      const hero = h.scenario.players.find((p) => p.isHero)!
      expect(h.scenario.ball.ownerId).toBe(hero.id)
      const marker = h.scenario.players.filter((p) => p.side !== hero.side).sort((a, b) => Math.hypot(a.pos.x - hero.pos.x, a.pos.y - hero.pos.y) - Math.hypot(b.pos.x - hero.pos.x, b.pos.y - hero.pos.y))[0]!
      expect(marker.pos.x).toBeGreaterThan(hero.pos.x)
      expect(Math.hypot(marker.pos.x - hero.pos.x, marker.pos.y - hero.pos.y)).toBeLessThan(2.2)
      const rt = new HighlightRuntime(h, { seed: s })
      expect(Math.abs(rt.hero.facing)).toBeCloseTo(Math.PI, 3)
    }
  })

  it('1v1: an isolated attacker on the ball, the hero goal-side, nobody else within 9 m', () => {
    for (let s = 1; s <= 10; s++) {
      const h = generatedHighlight('defend_1v1', s)
      const hero = h.scenario.players.find((p) => p.isHero)!
      const att = h.scenario.players.find((p) => p.id === h.scenario.ball.ownerId)!
      expect(att.side).not.toBe(hero.side)
      expect(hero.pos.x).toBeLessThan(att.pos.x)
      const others = h.scenario.players.filter((p) => p !== hero && p !== att && p.role !== 'GK')
      for (const o of others) expect(Math.hypot(o.pos.x - att.pos.x, o.pos.y - att.pos.y)).toBeGreaterThan(6)
    }
  })

  it('block: a shooter on the edge of our box with the hero just off the shooting line', () => {
    for (let s = 1; s <= 10; s++) {
      const h = generatedHighlight('block', s)
      const att = h.scenario.players.find((p) => p.id === h.scenario.ball.ownerId)!
      expect(att.pos.x).toBeGreaterThan(16)
      expect(att.pos.x).toBeLessThan(26)
      const hero = h.scenario.players.find((p) => p.isHero)!
      expect(Math.hypot(hero.pos.x - att.pos.x, hero.pos.y - att.pos.y)).toBeLessThan(6)
    }
  })
})

function run(rt: HighlightRuntime, seconds: number, each?: () => void): void {
  for (let i = 0; i < seconds * 60 && !rt.finished; i++) {
    each?.()
    rt.update(1 / 60)
    rt.drainEvents()
  }
}

describe('WP-14 kinds: runtime rules', () => {
  it('hold-up: shielding long enough under the marker is the job done', () => {
    let held = 0
    for (let s = 1; s <= 12; s++) {
      const rt = new HighlightRuntime(generatedHighlight('hold_up', s), { aimAssist: 'full', slowMoAim: false, seed: s })
      // Make the marker hesitant so the rule itself is tested, not the duel.
      for (const a of rt.agents) if (a.team === 'opp') a.cd = 99
      run(rt, HOLD_UP_SECONDS + 2, () => rt.setControl({ move: { x: 0, y: 0 }, sprint: false }))
      if (rt.result?.outcome === 'pass_complete' && rt.endReason === 'held up') held++
    }
    expect(held).toBeGreaterThan(8)
  })

  it('hold-up: a completed lay-off ends the moment as good play', () => {
    const rt = new HighlightRuntime(generatedHighlight('hold_up', 3), { aimAssist: 'full', slowMoAim: false, seed: 3 })
    run(rt, 0.5)
    const mate = rt.agents.filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper).sort((a, b) => Math.hypot(a.pos.x - rt.hero.pos.x, a.pos.y - rt.hero.pos.y) - Math.hypot(b.pos.x - rt.hero.pos.x, b.pos.y - rt.hero.pos.y))[0]!
    for (const a of rt.agents) if (a.team === 'opp') a.noTouch = 99
    rt.queueAction({ kind: 'pass', target: { ...mate.pos } })
    run(rt, 4)
    expect(rt.result?.outcome).toBe('pass_complete')
    expect(rt.endReason).toBe('laid off')
  })

  it('block: the shooter always pulls the trigger, and a hero body in the line blocks it', () => {
    let blocked = 0
    let shots = 0
    for (let s = 1; s <= 20; s++) {
      const rt = new HighlightRuntime(generatedHighlight('block', s), { aimAssist: 'full', slowMoAim: false, seed: s })
      let shot = false
      for (let i = 0; i < 60 * 10 && !rt.finished; i++) {
        const o = rt.owner
        // Perfect positioning: on the line ball → goal centre, 1.5 m off the ball.
        if (o && o.team === 'opp') {
          const dx = 0 - o.pos.x
          const dy = 34 - o.pos.y
          const n = Math.hypot(dx, dy)
          const spot = { x: o.pos.x + (dx / n) * 1.5, y: o.pos.y + (dy / n) * 1.5 }
          rt.hero.pos = spot
        }
        rt.update(1 / 60)
        for (const e of rt.drainEvents()) if (e.type === 'kick' && !e.hero && e.kick === 'shot') shot = true
      }
      if (shot) shots++
      if (rt.endReason === 'shot blocked') blocked++
    }
    expect(shots).toBeGreaterThan(15)
    expect(blocked).toBeGreaterThan(5)
  })
})
