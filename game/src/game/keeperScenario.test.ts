/**
 * Keeper motion scenarios in bullet time (owner feedback): the keeper starts
 * a highlight on the move in seeded, deterministic situations, keeps moving
 * (slowed) while the player aims, then reads the play by his attributes.
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../core/rng'
import { generatedHighlight } from './demoHighlights'
import { HighlightRuntime } from './runtime'
import { flatAttrs } from './setup'
import { dist, type Agent } from './model'
import { KEEPER_SCENARIO_KINDS, buildKeeperScenario, momentumDelay, pickScenarioKind, scenarioHold, KEEPER_SCENARIO_WEIGHTS, type KeeperScenarioKind } from './keeperScenario'
import { createDrill } from './training/drills'
import type { FinishingDrill } from './training/drills'

const gkOf = (rt: HighlightRuntime) => rt.agents.find((a) => a.team === 'opp' && a.isKeeper) as Agent

function start(kind: 'one_on_one' | 'edge_of_box' | 'counter' | 'penalty', seed: number, keeperScenario?: KeeperScenarioKind | 'auto' | 'off') {
  return new HighlightRuntime(generatedHighlight(kind, seed), { aimAssist: 'full', seed, ...(keeperScenario ? { keeperScenario } : {}) })
}

describe('keeper scenarios', () => {
  it('auto picks every scenario across seeds, deterministically per seed', () => {
    const seen = new Set<string>()
    for (let s = 1; s <= 60; s++) {
      const a = start('one_on_one', s)
      const b = start('one_on_one', s)
      expect(a.keeperScenarioKind).toBe(b.keeperScenarioKind)
      expect(gkOf(a).pos).toEqual(gkOf(b).pos)
      seen.add(a.keeperScenarioKind)
    }
    for (const k of KEEPER_SCENARIO_KINDS) expect(seen, k).toContain(k)
  })

  it('penalties keep a set keeper; off turns it off', () => {
    for (let s = 1; s <= 10; s++) expect(start('penalty', s).keeperScenarioKind).toBe('set')
    expect(start('one_on_one', 4, 'off').keeperScenarioKind).toBe('set')
  })

  it('the keeper keeps moving through the bullet-time aim window, slowed with the world', () => {
    for (const kind of ['recover', 'shuffle', 'charge', 'getUp'] as const) {
      for (const seed of [3, 11]) {
        const rt = start('one_on_one', seed, kind)
        expect(rt.keeperScenarioKind, `${kind}/${seed}`).toBe(kind)
        const k = gkOf(rt)
        const p0 = { ...k.pos }
        // 1.5 s of real time; bullet time (0.25×) stretches the scenario across it.
        let slow = 0
        for (let i = 0; i < 90; i++) {
          rt.update(1 / 60)
          if (rt.timeScale < 0.5) slow++
        }
        expect(slow, `${kind}/${seed} bullet time`).toBeGreaterThan(20)
        const moved = dist(p0, k.pos)
        expect(moved, `${kind}/${seed} moved`).toBeGreaterThan(kind === 'getUp' ? 0.3 : 0.8)
      }
    }
  })

  it('a set keeper (off) barely moves in the same window', () => {
    const rt = start('one_on_one', 3, 'off')
    const k = gkOf(rt)
    for (let i = 0; i < 30; i++) rt.update(1 / 60)
    const p0 = { ...k.pos }
    for (let i = 0; i < 60; i++) rt.update(1 / 60)
    expect(dist(p0, k.pos)).toBeLessThan(2.5)
  })

  it('recover starts up the pitch and runs back toward the line; charge comes off it', () => {
    const r = start('one_on_one', 5, 'recover')
    expect(105 - gkOf(r).pos.x).toBeGreaterThan(3.5)
    expect(gkOf(r).vel.x).toBeGreaterThan(0)
    const c = start('one_on_one', 5, 'charge')
    const x0 = gkOf(c).pos.x
    for (let i = 0; i < 60; i++) c.update(1 / 60)
    expect(gkOf(c).pos.x).toBeLessThan(x0 - 0.5)
  })

  it('reading time follows Reflexes and Positioning (GK); momentum the wrong way costs reaction time', () => {
    const k = (v: number) => ({ attrs: flatAttrs(v, true), team: 'opp', pos: { x: 104, y: 34 }, vel: { x: 0, y: 3 } }) as unknown as Agent
    expect(scenarioHold(k(90))).toBeLessThan(scenarioHold(k(40)))
    expect(scenarioHold(k(60), 1.3)).toBeLessThan(scenarioHold(k(60), 1))
    // Moving toward +y: a shot to -y is against his momentum.
    expect(momentumDelay(k(60), 31)).toBeGreaterThan(0.03)
    expect(momentumDelay(k(60), 37)).toBe(0)
  })

  it('the weights only cover open-play attacking finishes (penalty excluded)', () => {
    expect(Object.keys(KEEPER_SCENARIO_WEIGHTS).sort()).toEqual(['counter', 'edge_of_box', 'one_on_one'])
    const r = new Rng('w')
    const n: Record<string, number> = {}
    for (let i = 0; i < 2000; i++) {
      const kk = pickScenarioKind(r, KEEPER_SCENARIO_WEIGHTS.one_on_one!)
      n[kk] = (n[kk] ?? 0) + 1
    }
    expect(n.charge! / 2000).toBeCloseTo(0.28, 1)
    // A charge never runs into the shooter.
    const gk = { attrs: flatAttrs(60, true) } as unknown as Agent
    const sc = buildKeeperScenario('charge', new Rng(1), gk, { goalX: 105, inward: -1, home: { x: 103, y: 34 }, ball: { x: 95, y: 34 } })
    expect(105 - sc.to.x).toBeLessThanOrEqual(5.01)
  })
})

describe('finishing drill keeper scenarios', () => {
  it('moving-keeper attempts start the keeper in varied, seeded motion', () => {
    const kinds = new Set<string>()
    for (const seed of [1, 2, 3]) {
      const d = createDrill('finishing', { attrs: flatAttrs(65), seed, aimAssist: 'half' }) as FinishingDrill
      const idle = { move: { x: 0, y: 0 }, sprint: false, actions: [], aim: null }
      const sw = { dir: { x: 1, y: 0.05 }, length: 0.4, duration: 0.15, speed: 3, power: 0.9, curl: 0, chip: false, isTap: false }
      for (let i = 0; i < 60 * 80 && !d.finished; i++) {
        const v = d.view()
        if (v.heroOnBall && d.keeperScenarioKind !== 'set' && d.keeperScenarioT > 0.9 && !d.keeperScenarioMoved) throw new Error(`keeper scenario ${d.keeperScenarioKind} did not move`)
        if (v.heroOnBall && d.live && d.attemptT > 0.9) {
          kinds.add(d.keeperScenarioKind)
          d.update(1 / 60, { ...idle, actions: [{ kind: 'swipe', swipe: sw }] })
        } else d.update(1 / 60, idle)
      }
    }
    expect(kinds.size).toBeGreaterThanOrEqual(3)
  })
})
