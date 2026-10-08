/**
 * Role-aware team-mates (owner feedback): a runner is found in behind, a pivot in the air, a target
 * forward to feet even when marked. Scenarios without a role keep the old behaviour.
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../core/rng'
import type { RoleAiStyle } from '../core/roles'
import { roleAiStyle } from '../core/roles'
import { carrierDecision, heroStyleBonus, type AiWorld } from './ai'
import type { Agent, Team, Vec2 } from './model'
import { DEFAULT_ENV } from './physics'
import { flatAttrs } from './setup'

function agent(id: string, team: Team, pos: Vec2, opts: Partial<Agent> = {}): Agent {
  return {
    id, team, number: 1, role: opts.isKeeper ? 'GK' : 'CM', isHero: false, isKeeper: false, name: id, attrs: flatAttrs(65, !!opts.isKeeper), relationToHero: 40,
    pos: { ...pos }, vel: { x: 0, y: 0 }, facing: 0, anchor: { ...pos }, state: 'run', stateT: 0, z: 0, actionDir: { x: 1, y: 0 }, noTouch: 0, think: 0,
    sprint: false, stamina: 1, intent: null, prev: { x: pos.x, y: pos.y, z: 0, facing: 0 }, touch: 0, cd: 0, ...opts,
  }
}

/** A midfield carrier, the hero 18 m ahead with a defender 2.5 m off him, a freer team-mate wide: without a role the carrier goes wide. */
function scene(style: RoleAiStyle | null): { w: AiWorld; carrier: Agent; hero: Agent } {
  const carrier = agent('c', 'hero', { x: 50, y: 34 })
  const hero = agent('h', 'hero', { x: 68, y: 30 }, { isHero: true, role: 'ST' })
  const side = agent('m', 'hero', { x: 58, y: 50 })
  const d1 = agent('d1', 'opp', { x: 70.5, y: 30.6 })
  const d2 = agent('d2', 'opp', { x: 60, y: 40 })
  const gk = agent('gk', 'opp', { x: 103, y: 34 }, { isKeeper: true, role: 'GK' })
  const w: AiWorld = {
    agents: [carrier, hero, side, d1, d2, gk], ball: { x: 50, y: 34, z: 0, vx: 0, vy: 0, vz: 0, spin: { side: 0, top: 0 } },
    owner: carrier, env: DEFAULT_ENV, time: 0, difficulty: 1, kind: 'build_up', heroStyle: style,
  }
  return { w, carrier, hero }
}

const passesToHero = (style: RoleAiStyle | null) => {
  const rng = new Rng(3)
  let n = 0
  let through = 0
  let high = 0
  for (let i = 0; i < 200; i++) {
    const { w, carrier } = scene(style)
    const d = carrierDecision(carrier, w, rng, { heldFor: 1.2 })
    if (d.kind === 'pass' && d.to.isHero) {
      n++
      if (d.through) through++
      if (d.high) high++
    }
  }
  return { n, through, high }
}

describe('role-aware team-mates', () => {
  it('maps roles to styles', () => {
    expect(roleAiStyle('runner')).toBe('runner')
    expect(roleAiStyle('pivot')).toBe('aerial')
    expect(roleAiStyle('targetForward')).toBe('feet')
    expect(roleAiStyle('anchor')).toBeNull()
    expect(roleAiStyle(undefined)).toBeNull()
  })
  it('no style, no bonus', () => {
    expect(heroStyleBonus(null, 0.5, 0.2)).toBe(0)
    expect(heroStyleBonus('runner', 0.5, 0.2)).toBeGreaterThan(0)
    expect(heroStyleBonus('runner', -0.2, 0.2)).toBe(0)
  })
  it('a runner gets balls in behind, a pivot high balls, a target forward more balls to feet', () => {
    const plain = passesToHero(null)
    const runner = passesToHero('runner')
    const pivot = passesToHero('aerial')
    const target = passesToHero('feet')
    expect(plain.n).toBe(0)
    for (const r of [runner, pivot, target]) expect(r.n).toBeGreaterThan(150)
    expect(runner.through).toBe(runner.n)
    expect(pivot.high).toBe(pivot.n)
    expect(target.through + target.high).toBe(0)
  })
})
