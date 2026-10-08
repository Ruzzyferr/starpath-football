/**
 * Keeper motion scenarios (owner feedback: in the slow-motion aim the keeper
 * was always set and still). A highlight or a finishing-drill attempt starts
 * the keeper in one of several seeded, deterministic situations that play out
 * while the player aims — slowed with the rest of the world in bullet time —
 * so the shooter can pick the side the keeper is leaving:
 *
 * - `recover`: caught up the pitch (around the penalty spot), sprinting back to his line;
 * - `shuffle`: side-stepping from a post across to the angle;
 * - `charge`:  coming off his line to close the angle;
 * - `getUp`:   still on the ground after a parry, getting up and resetting;
 * - `set`:     set and balanced (the old behaviour).
 *
 * The scenario drives him for a "reading" time set by Reflexes and
 * Positioning (GK) (scaled by difficulty); then his normal positioning AI
 * takes over. A shot cuts it short — the keeper reacts to the ball, but his
 * momentum costs him: diving against the way he is moving takes longer
 * ({@link momentumDelay}).
 */
import type { Rng } from '../core/rng'
import type { HighlightKind } from '../sim/match/types'
import { a01, add, clampN, dist, norm, scale, sub, type Agent, type Vec2 } from './model'
import { GOAL_CENTER_Y } from './physics'

export type KeeperScenarioKind = 'set' | 'recover' | 'shuffle' | 'charge' | 'getUp'
export const KEEPER_SCENARIO_KINDS: readonly KeeperScenarioKind[] = ['set', 'recover', 'shuffle', 'charge', 'getUp']

/** Scenario odds per highlight kind (kinds not listed keep a set keeper; penalties are excluded). */
export const KEEPER_SCENARIO_WEIGHTS: Partial<Record<HighlightKind, Readonly<Record<KeeperScenarioKind, number>>>> = {
  one_on_one: { set: 0.2, recover: 0.22, shuffle: 0.2, charge: 0.28, getUp: 0.1 },
  edge_of_box: { set: 0.3, recover: 0.15, shuffle: 0.35, charge: 0.1, getUp: 0.1 },
  counter: { set: 0.25, recover: 0.4, shuffle: 0.2, charge: 0.1, getUp: 0.05 },
}

/** Finishing drill (moving-keeper attempts): no `recover`, the ball is placed close in. */
export const DRILL_SCENARIO_WEIGHTS: Readonly<Record<KeeperScenarioKind, number>> = { set: 0.25, recover: 0.15, shuffle: 0.3, charge: 0.2, getUp: 0.1 }

export interface KeeperScenario {
  kind: KeeperScenarioKind
  /** Start position and velocity. */
  pos: Vec2
  vel: Vec2
  /** Seconds still on the ground (`getUp`), else 0. */
  down: number
  /** Where the scenario carries him and how fast (m/s). */
  to: Vec2
  speed: number
  /** Seconds the scenario drives him before his own reading takes over. */
  hold: number
}

/**
 * How long the keeper keeps doing what he was doing before he reads the new
 * situation (s): sharp Reflexes and good Positioning (GK) cut it short.
 */
export function scenarioHold(gk: Agent, difficulty = 1): number {
  const base = 0.55 + (1 - a01(gk.attrs.reflexes)) * 0.3 + (1 - a01(gk.attrs.gkPositioning)) * 0.35
  return clampN(base / Math.max(0.6, difficulty), 0.35, 1.3)
}

/** Seeded weighted pick. */
export function pickScenarioKind(rng: Rng, weights: Readonly<Record<KeeperScenarioKind, number>>): KeeperScenarioKind {
  const total = KEEPER_SCENARIO_KINDS.reduce((s, k) => s + Math.max(0, weights[k]), 0)
  let r = rng.next() * total
  for (const k of KEEPER_SCENARIO_KINDS) {
    r -= Math.max(0, weights[k])
    if (r < 0) return k
  }
  return 'set'
}

/**
 * Builds a scenario for keeper `gk` defending the goal line at `goalX`
 * (`inward` = ±1 toward the pitch), with the ball at `ball` and his normal
 * set position `home`. Deterministic for a given rng state.
 */
export function buildKeeperScenario(
  kind: KeeperScenarioKind,
  rng: Rng,
  gk: Agent,
  opts: { goalX: number; inward: number; home: Vec2; ball: Vec2; difficulty?: number; holdScale?: number },
): KeeperScenario {
  const { goalX, inward, home, ball } = opts
  const hold = scenarioHold(gk, opts.difficulty ?? 1) * (opts.holdScale ?? 1)
  const agile = 0.9 + a01(gk.attrs.agility) * 0.2
  const goal = { x: goalX, y: GOAL_CENTER_Y }
  const ballDepth = Math.abs(ball.x - goalX)
  const set: KeeperScenario = { kind: 'set', pos: { ...home }, vel: { x: 0, y: 0 }, down: 0, to: { ...home }, speed: 0, hold: 0 }
  const toward = (from: Vec2, to: Vec2, v: number) => scale(norm(sub(to, from)), v)
  switch (kind) {
    case 'recover': {
      // Caught up the pitch: around the penalty spot, never past the halfway point to the ball.
      const depth = Math.min(rng.range(7, 10.5), ballDepth * 0.55)
      if (depth < 4) return buildKeeperScenario('shuffle', rng, gk, opts)
      const pos = { x: goalX + inward * depth, y: GOAL_CENTER_Y + (ball.y - GOAL_CENTER_Y) * 0.3 + rng.range(-1.5, 1.5) }
      const speed = 6.2 * agile
      return { kind, pos, vel: toward(pos, home, speed * 0.6), down: 0, to: { ...home }, speed, hold: hold + 0.35 }
    }
    case 'shuffle': {
      // From the far post across to the angle (now and then from the near post back to the middle).
      const nearSide = home.y >= GOAL_CENTER_Y ? 1 : -1
      const side = rng.chance(0.7) ? -nearSide : nearSide
      const pos = { x: goalX + inward * rng.range(0.6, 1.2), y: GOAL_CENTER_Y + side * rng.range(2.6, 3.3) }
      const to = Math.abs(home.y - pos.y) < 1.2 ? { x: home.x, y: GOAL_CENTER_Y + (home.y - GOAL_CENTER_Y) * 0.2 } : { ...home }
      const speed = 3.4 * agile
      return { kind, pos, vel: toward(pos, to, speed * 0.7), down: 0, to, speed, hold }
    }
    case 'charge': {
      // From his line toward the ball, closing the angle (stops well short of the shooter).
      const out = Math.min(rng.range(4.5, 7), ballDepth * 0.5)
      if (out < 2.5) return set
      const pos = { x: goalX + inward * 0.4, y: GOAL_CENTER_Y + (home.y - GOAL_CENTER_Y) * 0.5 }
      const to = add(goal, scale(norm(sub(ball, goal)), out))
      const speed = 5.8 * agile
      return { kind, pos, vel: toward(pos, to, speed * 0.5), down: 0, to, speed, hold: Math.min(hold + 0.2, dist(pos, to) / speed + 0.25) }
    }
    case 'getUp': {
      // On the ground off-centre after a parry: up, then back to his spot.
      const side = rng.chance(0.5) ? 1 : -1
      const pos = { x: goalX + inward * rng.range(0.8, 1.6), y: GOAL_CENTER_Y + side * rng.range(1.6, 2.8) }
      const down = rng.range(0.3, 0.55)
      return { kind, pos, vel: { x: 0, y: 0 }, down, to: { ...home }, speed: 4.6 * agile, hold: hold + down }
    }
    case 'set':
      return set
  }
}

/** Seconds a keeper standing on the ground needs before he can move again (match & drill 'down' state). */
export const KEEPER_GETUP = 0.55

/** Puts the keeper into the scenario's start state (position, velocity, on the ground). */
export function applyKeeperScenario(gk: Agent, sc: KeeperScenario, getUp = KEEPER_GETUP): void {
  gk.pos = { ...sc.pos }
  gk.prev.x = sc.pos.x
  gk.prev.y = sc.pos.y
  gk.vel = { ...sc.vel }
  if (sc.down > 0) {
    gk.state = 'down'
    gk.stateT = Math.max(0, getUp - sc.down)
  }
}

/**
 * Extra reaction time (s) when the shot goes against the keeper's momentum:
 * moving across one way and having to dive the other, or still backpedalling.
 * Agility softens it.
 */
export function momentumDelay(gk: Agent, aimY: number): number {
  const vy = gk.vel.y
  const lateral = Math.abs(vy)
  const agile = 1 - a01(gk.attrs.agility) * 0.5
  let d = 0
  if (lateral > 1 && Math.sign(aimY - gk.pos.y) !== Math.sign(vy) && Math.abs(aimY - gk.pos.y) > 0.6) d += clampN(lateral / 6, 0, 1) * 0.12 * agile
  // Running back toward his own goal (recovering): he has to plant his feet first.
  const back = gk.team === 'opp' ? gk.vel.x : -gk.vel.x
  if (back > 2) d += clampN(back / 7, 0, 1) * 0.06 * agile
  return d
}
