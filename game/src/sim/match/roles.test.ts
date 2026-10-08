/**
 * Position roles in the match (owner feedback): each role reshapes its position's moment mix while the
 * shooting share (goal volume, BALANCE) stays the position's.
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { POSITION_ROLES } from '../../core/roles'
import type { Formation, Position, Role } from '../../core/types'
import { MatchSim } from './engine'
import { ROLE_KIND_MULT, expectedMoments, guaranteedKind, kindWeights, pickHighlightKind } from './highlightGen'
import { makeSetup } from './testFixtures'
import { outcomeProbabilities } from './autoResolve'
import { previewAttrs } from '../career/createHero'
import type { HighlightKind } from './types'

type W = Partial<Record<HighlightKind, number>>
const total = (w: W) => Object.values(w).reduce((a, v) => a + (v ?? 0), 0)
const share = (w: W, ks: HighlightKind[]) => ks.reduce((a, k) => a + (w[k] ?? 0), 0) / total(w)
const SHOTS: HighlightKind[] = ['counter', 'one_on_one', 'cross', 'edge_of_box', 'corner', 'counter_2v1', 'rebound', 'dribble', 'header']
const mix = (pos: Position, role: Role) => kindWeights(pos, undefined, 0, role)

describe('role moment mix', () => {
  it('every role keeps its position kinds and total weight; the shooting share moves at most ±25 %', () => {
    for (const [pos, roles] of Object.entries(POSITION_ROLES) as [Position, readonly Role[]][]) {
      const base = kindWeights(pos)
      for (const r of roles) {
        const w = mix(pos, r)
        expect(Object.keys(w).sort(), `${pos}/${r}`).toEqual(Object.keys(base).sort())
        expect(total(w)).toBeCloseTo(total(base), 9)
        const ratio = share(w, SHOTS) / share(base, SHOTS)
        if (pos !== 'GK') expect(Math.abs(ratio - 1), `${pos}/${r}`).toBeLessThanOrEqual(0.2501)
      }
    }
  })
  it('attacking roles keep the position goal rate per moment (±8 %): different chances, same goals', () => {
    for (const pos of ['ST', 'LW', 'RW', 'AM', 'CM'] as Position[]) {
      for (const r of POSITION_ROLES[pos]) {
        if (r === 'anchor') continue // the screening midfielder scores less by design
        const a = { ...previewAttrs(pos, r, 'academy') }
        for (const k of Object.keys(a) as (keyof typeof a)[]) a[k] = Math.min(90, a[k] + 25)
        const goals = (w: W) => (Object.entries(w) as [HighlightKind, number][]).reduce((s, [k, v]) => s + v * (outcomeProbabilities(k, a, 1).goal ?? 0), 0) / total(w)
        const ratio = goals(mix(pos, r)) / goals(kindWeights(pos))
        expect(Math.abs(ratio - 1), `${pos}/${r}: ${ratio.toFixed(2)}`).toBeLessThanOrEqual(0.08)
      }
    }
  })
  it('every role has a multiplier entry', () => {
    for (const roles of Object.values(POSITION_ROLES)) for (const r of roles) expect(ROLE_KIND_MULT[r]).toBeDefined()
  })
  it('strikers: runner 1v1s and breaks, target hold-up and link-up, pivot headers and high balls', () => {
    const run = mix('ST', 'runner'), tgt = mix('ST', 'targetForward'), piv = mix('ST', 'pivot')
    expect(share(run, ['one_on_one', 'counter'])).toBeGreaterThan(share(tgt, ['one_on_one', 'counter']) * 1.4)
    expect(share(tgt, ['hold_up', 'build_up'])).toBeGreaterThan(share(run, ['hold_up', 'build_up']) * 1.5)
    expect(share(piv, ['header', 'corner'])).toBeGreaterThan(share(run, ['header', 'corner']) * 2)
    expect(share(piv, ['long_ball_control'])).toBeGreaterThan(share(tgt, ['long_ball_control']))
    expect(share(run, ['long_ball_control'])).toBeGreaterThan(share(tgt, ['long_ball_control'])) // balls over the top
  })
  it('wingers: byline crosses, cutting in to shoot, roaming, take-ons', () => {
    const tl = mix('LW', 'touchlineWinger'), inv = mix('RW', 'invertedWinger'), free = mix('LW', 'freeWinger'), drb = mix('RW', 'dribbler')
    expect(share(tl, ['cross'])).toBeGreaterThan(share(inv, ['cross']) * 2)
    expect(share(inv, ['edge_of_box'])).toBeGreaterThan(share(tl, ['edge_of_box']) * 2)
    expect(share(free, ['build_up', 'hold_up'])).toBeGreaterThan(share(tl, ['build_up', 'hold_up']))
    expect(share(drb, ['dribble'])).toBeGreaterThan(Math.max(share(tl, ['dribble']), share(inv, ['dribble'])) * 1.8)
  })
  it('midfield, full-backs, centre-backs and keepers', () => {
    expect(share(mix('CM', 'anchor'), ['interception', 'block'])).toBeGreaterThan(share(mix('CM', 'playmaker'), ['interception', 'block']) * 1.8)
    expect(share(mix('CM', 'playmaker'), ['build_up'])).toBeGreaterThan(share(mix('CM', 'anchor'), ['build_up']))
    expect(share(mix('LB', 'attackingFullBack'), ['cross', 'counter_2v1'])).toBeGreaterThan(share(mix('LB', 'defensiveFullBack'), ['cross', 'counter_2v1']) * 1.8)
    expect(share(mix('RB', 'defensiveFullBack'), ['defend_1v1', 'back_post'])).toBeGreaterThan(share(mix('RB', 'attackingFullBack'), ['defend_1v1', 'back_post']))
    expect(share(mix('CB', 'aerialDefender'), ['corner', 'back_post'])).toBeGreaterThan(share(mix('CB', 'stopper'), ['corner', 'back_post']) * 1.5)
    expect(share(mix('CB', 'stopper'), ['interception', 'defend_1v1'])).toBeGreaterThan(share(mix('CB', 'aerialDefender'), ['interception', 'defend_1v1']))
    expect(share(mix('CB', 'ballPlayingDefender'), ['build_up'])).toBeGreaterThan(share(mix('CB', 'stopper'), ['build_up']) * 2)
    expect(share(mix('GK', 'sweeperKeeper'), ['gk_sweep'])).toBeGreaterThan(share(mix('GK', 'shotStopper'), ['gk_sweep']) * 2.5)
    expect(share(mix('GK', 'reflexKeeper'), ['gk_1v1'])).toBeGreaterThan(share(mix('GK', 'shotStopper'), ['gk_1v1']))
  })
  it('picks follow the role mix and the preview shows it', () => {
    const rng = new Rng(77)
    let pivotHeaders = 0, runnerHeaders = 0
    for (let i = 0; i < 3000; i++) {
      if (pickHighlightKind('ST', rng, 0, 30, 0, 60, 0, 'pivot') === 'header') pivotHeaders++
      if (pickHighlightKind('ST', rng, 0, 30, 0, 60, 0, 'runner') === 'header') runnerHeaders++
    }
    expect(pivotHeaders).toBeGreaterThan(runnerHeaders * 2)
    const base = { position: 'ST' as const, relationAvg: 0, morale: 1, form: 50, minutes: 90 }
    const top = (role: Role) => expectedMoments({ ...base, role }).kinds[0]!.kind
    // In behind: 1v1s on goal and balls over the top to bring down.
    expect(['one_on_one', 'long_ball_control']).toContain(top('runner'))
    expect(top('pivot')).toBe('header')
    // A target forward still shoots as much as a striker should; his hold-up play doubles.
    expect(share(mix('ST', 'targetForward'), ['hold_up'])).toBeGreaterThan(share(kindWeights('ST'), ['hold_up']) * 1.5)
  })
  it('a winger who cuts inside is guaranteed one cross, a touchline winger two', () => {
    const rng = new Rng(1)
    expect(guaranteedKind('LW', { cross: 1 }, 1, rng, 'invertedWinger')).toBeNull()
    expect(guaranteedKind('LW', { cross: 1 }, 1, rng, 'touchlineWinger')).toBe('cross')
  })
})

describe('role moments in the engine', () => {
  const count = (role: Role, pos: Position, kinds: HighlightKind[], seeds: number) => {
    let n = 0
    let all = 0
    for (let seed = 1; seed <= seeds; seed++) {
      const formation: Formation = pos === 'LW' || pos === 'RW' ? '4-3-3' : '4-4-2'
      const setup = makeSetup({ seed, heroSide: 'home', home: { heroPosition: pos, formation } })
      const hero = setup.home.lineup.find((p) => p.isHero)!
      hero.role = role
      const sim = new MatchSim(setup, 'en')
      while (!sim.finished) {
        const h = sim.pendingHighlight
        if (h) {
          all++
          if (kinds.includes(h.kind)) n++
          if (h.kind !== 'freekick' && h.kind !== 'penalty' && h.kind !== 'corner_kick' && h.kind !== 'fk_wall') expect(h.scenario.heroRole).toBe(role)
          sim.skipHighlight()
        } else sim.step()
      }
    }
    return n / Math.max(1, all)
  }
  it('a pivot gets more aerial moments than a runner, who gets more 1v1s and breaks', () => {
    expect(count('pivot', 'ST', ['header', 'corner'], 12)).toBeGreaterThan(count('runner', 'ST', ['header', 'corner'], 12))
    expect(count('runner', 'ST', ['one_on_one', 'counter'], 12)).toBeGreaterThan(count('pivot', 'ST', ['one_on_one', 'counter'], 12))
  })
})
