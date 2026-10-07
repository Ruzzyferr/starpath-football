/**
 * Match fairness rules (GAP-AUDIT WP-2):
 *  - early score brake: in the first 15 minutes and before the hero's first
 *    moment, the background sim never opens a gap bigger than one goal;
 *  - no near-impossible moments: an open-play moment whose estimated success
 *    chance is under {@link MIN_MOMENT_CHANCE} is regenerated, and if it stays
 *    hopeless it becomes a keep-the-ball (build-up) moment instead.
 */
import type { Attributes } from '../../core/types'
import { outcomeProbabilities } from './autoResolve'
import type { HighlightKind, HighlightScenario, Vec2 } from './types'
import { DEFENSIVE_KINDS, PITCH_LENGTH } from './types'

/** Moments estimated below this success chance are not generated. */
export const MIN_MOMENT_CHANCE = 0.08
/** Minute up to which the early score brake applies. */
export const EARLY_BRAKE_MINUTE = 15

/**
 * True when a background goal for `att` must be denied: early in the match,
 * before the hero had a moment, and the goal would open a gap above one.
 */
export function earlyBrake(clock: number, heroMoments: number, heroOnPitch: boolean, goalsAtt: number, goalsDef: number): boolean {
  return heroOnPitch && heroMoments === 0 && clock <= EARLY_BRAKE_MINUTE && goalsAtt + 1 - goalsDef > 1
}

const DEFENSIVE: ReadonlySet<HighlightKind> = DEFENSIVE_KINDS

const d2 = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)

/** Distance from p to segment ab, and the projection parameter t. */
function seg(p: Vec2, a: Vec2, b: Vec2): { d: number; t: number } {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const l2 = abx * abx + aby * aby || 1e-9
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2))
  return { d: Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t)), t }
}

/**
 * Geometry multiplier (0..1] for a generated scenario: a hero swamped by
 * markers, a blocked lane to goal or an impossible angle make it worse.
 */
export function scenarioFactor(kind: HighlightKind, sc: HighlightScenario): number {
  const hero = sc.players.find((p) => p.isHero)
  if (!hero) return 1
  const heroSide = hero.side
  const opps = sc.players.filter((p) => p.side !== heroSide && p.role !== 'GK')
  const mates = sc.players.filter((p) => p.side === heroSide && p.role !== 'GK' && !p.isHero)
  let f = 1
  if (DEFENSIVE.has(kind)) {
    if (kind === 'gk_save' || kind === 'gk_penalty') return 1
    const ball = sc.ball.pos
    const att = opps.filter((o) => d2(o.pos, ball) < 16).length
    const def = mates.filter((m) => d2(m.pos, ball) < 16).length + 1
    if (att > def + 1) f *= 0.6
    if (d2(hero.pos, ball) > 25) f *= 0.6
    return f
  }
  const goal = { x: PITCH_LENGTH, y: 34 }
  const markers = opps.filter((o) => d2(o.pos, hero.pos) < 2.2).length
  if (markers >= 2) f *= 0.5
  if (kind === 'one_on_one' || kind === 'counter_2v1' || kind === 'edge_of_box') {
    const blocked = opps.some((o) => {
      const s = seg(o.pos, hero.pos, goal)
      return s.d < 1.2 && s.t > 0.05 && s.t < 0.6
    })
    if (blocked) f *= 0.6
  }
  if (hero.pos.x > PITCH_LENGTH - 5 && Math.abs(hero.pos.y - 34) > 12) f *= 0.5
  return f
}

/**
 * Estimated success chance of a moment for the hero: good outcomes of the
 * auto-resolve model (goal, assist, defended, foul won, half of a completed
 * pass) times the scenario geometry factor.
 */
export function momentChance(kind: HighlightKind, sc: HighlightScenario, attrs: Attributes, difficulty: number): number {
  const p = outcomeProbabilities(kind, attrs, difficulty)
  const base = (p.goal ?? 0) + (p.assist ?? 0) + (p.defended ?? 0) + (p.foul_won ?? 0) + 0.5 * (p.pass_complete ?? 0)
  return Math.max(0, Math.min(1, base * scenarioFactor(kind, sc)))
}
