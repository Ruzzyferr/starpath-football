/**
 * Tactical AI unit tests: chance quality, pass safety (time race), take-on
 * odds vs defender stance, cross delivery zones, and the new moment kinds'
 * runtime behaviour.
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../core/rng'
import { PITCH_LENGTH } from '../sim/match/types'
import type { AiWorld } from './ai'
import { generatedHighlight } from './demoHighlights'
import { ASSIST_PULL, assistShotTarget, crossZones, nearestZone } from './kick'
import type { Agent, Team, Vec2 } from './model'
import { DEFAULT_ENV, GOAL_CENTER_Y } from './physics'
import { HighlightRuntime } from './runtime'
import { flatAttrs } from './setup'
import { evaluateCarrier, goalSideness, passSafety, shotQuality, spotXg, takeOnChance } from './tactics'

function agent(id: string, team: Team, pos: Vec2, opts: Partial<Agent> = {}): Agent {
  return {
    id, team, number: 1, role: opts.isKeeper ? 'GK' : 'CM', isHero: false, isKeeper: false, name: id, attrs: flatAttrs(65, !!opts.isKeeper), relationToHero: 0,
    pos: { ...pos }, vel: { x: 0, y: 0 }, facing: 0, anchor: { ...pos }, state: 'run', stateT: 0, z: 0, actionDir: { x: 1, y: 0 }, noTouch: 0, think: 0,
    sprint: false, stamina: 1, intent: null, prev: { x: pos.x, y: pos.y, z: 0, facing: 0 }, touch: 0, cd: 0, ...opts,
  }
}

const world = (agents: Agent[], ball: Vec2, owner: Agent | null = null): AiWorld => ({
  agents, ball: { x: ball.x, y: ball.y, z: 0, vx: 0, vy: 0, vz: 0, spin: { side: 0, top: 0 } }, owner, env: DEFAULT_ENV, time: 0, difficulty: 1, kind: 'defend',
})

describe('chance quality', () => {
  it('closer and more central is better', () => {
    expect(spotXg({ x: 95, y: 34 }, 'hero')).toBeGreaterThan(spotXg({ x: 80, y: 34 }, 'hero'))
    expect(spotXg({ x: 95, y: 34 }, 'hero')).toBeGreaterThan(spotXg({ x: 100, y: 10 }, 'hero'))
  })

  it('a keeper closing the angle or a body in the lane lowers it; a keeper off his line raises it', () => {
    const p = { x: 92, y: 34 }
    const set = world([agent('gk', 'opp', { x: 104, y: 34 }, { isKeeper: true })], p)
    const closing = world([agent('gk', 'opp', { x: 94, y: 34 }, { isKeeper: true })], p)
    const lost = world([agent('gk', 'opp', { x: 100, y: 22 }, { isKeeper: true })], p)
    const blocked = world([agent('gk', 'opp', { x: 104, y: 34 }, { isKeeper: true }), agent('d', 'opp', { x: 95, y: 34 })], p)
    const q = (w: AiWorld) => shotQuality(p, 'hero', w)
    expect(q(closing)).toBeLessThan(q(set))
    expect(q(lost)).toBeGreaterThan(q(set))
    expect(q(blocked)).toBeLessThan(q(set))
  })
})

describe('pass safety (time race)', () => {
  it('a defender sitting in the lane makes a pass unsafe; one far away does not', () => {
    const from = { x: 50, y: 34 }
    const to = { x: 65, y: 34 }
    const inLane = world([agent('d', 'opp', { x: 58, y: 35 })], from)
    const far = world([agent('d', 'opp', { x: 58, y: 50 })], from)
    expect(passSafety(from, to, 'hero', inLane)).toBeLessThan(0.3)
    expect(passSafety(from, to, 'hero', far)).toBeGreaterThan(0.8)
  })

  it('a lofted ball clears a defender in the middle of the lane', () => {
    const from = { x: 40, y: 34 }
    const to = { x: 65, y: 34 }
    const w = world([agent('d', 'opp', { x: 52, y: 34 })], from)
    expect(passSafety(from, to, 'hero', w, true)).toBeGreaterThan(passSafety(from, to, 'hero', w, false))
  })
})

describe('take-ons', () => {
  it('a defender rushing in is easier to beat than one jockeying goal-side', () => {
    const carrier = agent('c', 'opp', { x: 30, y: 34 }, { vel: { x: -5, y: 0 } })
    const jockey = agent('h', 'hero', { x: 28, y: 34 }, { vel: { x: -1, y: 0 } })
    const rusher = agent('h', 'hero', { x: 28, y: 34 }, { vel: { x: 6, y: 0 } })
    expect(goalSideness(jockey, carrier)).toBeGreaterThan(0.5)
    expect(takeOnChance(carrier, rusher)).toBeGreaterThan(takeOnChance(carrier, jockey) + 0.2)
  })

  it('the carrier shoots from a clear chance and goes at a rushing lone defender', () => {
    const rng = new Rng('t')
    const c = agent('c', 'opp', { x: 9, y: 34 })
    const gk = agent('gk', 'hero', { x: 4, y: 34 }, { isKeeper: true })
    const w = world([c, gk], c.pos, c)
    // Through on goal with the keeper coming out: shoot, or carry it around him — never straight into him.
    const first = evaluateCarrier(c, w, rng, { heldFor: 1, noise: 0 })
    expect(['shoot', 'dribble']).toContain(first.kind)
    if (first.kind === 'dribble') expect(Math.abs(first.dir.y)).toBeGreaterThan(0.3)
    const far = agent('c2', 'opp', { x: 40, y: 34 }, { vel: { x: -5, y: 0 } })
    const rusher = agent('h', 'hero', { x: 37.5, y: 34 }, { vel: { x: 7, y: 0 }, isHero: true })
    const w2 = world([far, rusher, gk], far.pos, far)
    const d = evaluateCarrier(far, w2, rng, { heldFor: 1, noise: 0 })
    expect(['takeOn', 'dribble']).toContain(d.kind)
  })
})

describe('cross delivery zones & aim assist', () => {
  it('four zones; near post on the crossing side, cut-back on the ground', () => {
    const z = crossZones(5)
    expect(z.map((x) => x.name)).toEqual(['near_post', 'far_post', 'penalty_spot', 'cut_back'])
    expect(z[0].point.y).toBeLessThan(GOAL_CENTER_Y)
    expect(z[1].point.y).toBeGreaterThan(GOAL_CENTER_Y)
    expect(z[3].ground).toBe(true)
    expect(nearestZone(z, { x: PITCH_LENGTH - 12, y: 34 }).name).toBe('penalty_spot')
  })

  it('assist removes a share of an off-frame error, never all of it', () => {
    const wide = { x: PITCH_LENGTH, y: GOAL_CENTER_Y + 8 }
    const full = assistShotTarget(wide, 1, 'full').target.y
    const half = assistShotTarget(wide, 1, 'half').target.y
    expect(full).toBeLessThan(half)
    expect(half).toBeLessThan(wide.y)
    expect(full).toBeGreaterThan(GOAL_CENTER_Y + 3.66 - 0.55)
    expect(ASSIST_PULL.manual).toBe(0)
  })
})

describe('new moment kinds in the runtime', () => {
  it('rebound: the keeper starts on the ground and the ball is loose', () => {
    const rt = new HighlightRuntime(generatedHighlight('rebound', 1), { seed: 1 })
    const gk = rt.agents.find((a) => a.team === 'opp' && a.isKeeper)!
    expect(gk.state).toBe('down')
    expect(rt.owner).toBeNull()
  })

  it('long ball: the deep team-mate plays it in as the moment goes live', () => {
    const rt = new HighlightRuntime(generatedHighlight('long_ball_control', 2), { seed: 2 })
    let lofted = false
    for (let i = 0; i < 60 && !lofted; i++) {
      rt.stepOnce()
      lofted = rt.drainEvents().some((e) => e.type === 'kick' && e.kick === 'lofted' && !e.hero)
    }
    expect(lofted).toBe(true)
  })

  it('defend: an opponent shot saved after the hero was beaten is a chance conceded, not a stop', () => {
    let conceded = 0
    for (let s = 1; s <= 30; s++) {
      const rt = new HighlightRuntime(generatedHighlight('defend', s), { seed: s })
      while (!rt.finished) rt.update(1 / 60)
      expect(rt.result!.outcome).not.toBe('timeout' as never)
      if (rt.result!.outcome === 'shot_conceded' || rt.result!.outcome === 'conceded') conceded++
    }
    // An idle hero lets the break through often.
    expect(conceded).toBeGreaterThan(6)
  })
})

describe('heat/shot map data from the runtime', () => {
  it('records the hero track and logs his shots with outcomes', () => {
    const rt = new HighlightRuntime(generatedHighlight('one_on_one', 3), { seed: 3 })
    for (let i = 0; i < 40; i++) rt.stepOnce()
    rt.queueAction({ kind: 'shoot', target: { x: PITCH_LENGTH, y: GOAL_CENTER_Y + 2 }, power: 0.85, curl: 0, chip: false })
    while (!rt.finished) rt.update(1 / 60)
    const r = rt.result!
    expect(r.track?.length ?? 0).toBeGreaterThan(0)
    expect(r.shotLog?.length).toBe(1)
    expect(r.shotLog![0].x).toBeGreaterThan(70)
    expect(['goal', 'saved', 'missed', 'blocked', 'woodwork']).toContain(r.shotLog![0].outcome)
  })
})
