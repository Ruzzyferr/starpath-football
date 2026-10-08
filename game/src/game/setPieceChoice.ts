/**
 * Set-piece decisions the hero makes before the ball is struck (GAP-AUDIT
 * 2.1#95 / #97):
 *
 * - corner_kick: the hero takes the corner and picks the delivery zone (near
 *   post / far post / penalty spot / short), the height (driven / floated)
 *   and the curl (inswinger / outswinger). Team-mates time their runs to the
 *   chosen zone.
 * - fk_wall: an opposition free kick near our box; the hero (keeper or
 *   captain) sets the wall (2–5 players, shifted along its line). The taker
 *   reads the wall and the keeper and picks his shot.
 *
 * Pure helpers (no runtime state) so the runtime, the picker UI and the tests
 * agree on the same geometry.
 */
import type { Rng } from '../core/rng'
import { PITCH_LENGTH } from '../sim/match/types'
import { GOAL_CENTER_Y } from './physics'
import { DEFAULT_WALL, WALL_MAX, WALL_MIN, WALL_NUDGE_MAX } from './setup'
import type { Vec2 } from './model'

export type CornerZone = 'near' | 'far' | 'spot' | 'short'
export type CornerHeight = 'driven' | 'floated'
export type CornerCurl = 'in' | 'out'

export interface CornerChoice {
  zone: CornerZone
  height: CornerHeight
  curl: CornerCurl
}

export interface WallChoice {
  /** Players in the wall, 2–5. */
  count: number
  /** Shift along the wall line (m): + toward the middle of the goal, − outside the near post. */
  nudge: number
}

export const CORNER_ZONES: readonly CornerZone[] = ['near', 'far', 'spot', 'short']
export const DEFAULT_CORNER: Readonly<CornerChoice> = { zone: 'far', height: 'floated', curl: 'in' }
export const DEFAULT_WALL_CHOICE: Readonly<WallChoice> = { count: DEFAULT_WALL, nudge: 0 }
/** Nudge step of the picker (m). */
export const WALL_NUDGE_STEP = 0.5
/** Seconds (game time, clock stopped) before the default choice is taken for an idle player. */
export const CHOICE_TIMEOUT = 10

/** Clamps a wall choice to the legal range (count 2–5, nudge on the 0.5 m grid). */
export function sanitizeWall(c: WallChoice): WallChoice {
  const count = Math.round(Math.min(WALL_MAX, Math.max(WALL_MIN, Number.isFinite(c.count) ? c.count : DEFAULT_WALL)))
  const n = Number.isFinite(c.nudge) ? c.nudge : 0
  const nudge = Math.round(Math.min(WALL_NUDGE_MAX, Math.max(-WALL_NUDGE_MAX, n)) / WALL_NUDGE_STEP) * WALL_NUDGE_STEP
  return { count, nudge: nudge === 0 ? 0 : nudge }
}

export function isCornerChoice(c: Partial<CornerChoice>): c is CornerChoice {
  return CORNER_ZONES.includes(c.zone as CornerZone) && (c.height === 'driven' || c.height === 'floated') && (c.curl === 'in' || c.curl === 'out')
}

/** Corner from the top flag (low y) or the bottom one. */
export function cornerFromTop(spot: Vec2): boolean {
  return spot.y < GOAL_CENTER_Y
}

/**
 * Ground point the delivery is aimed at (hero attacks +x). `short` returns
 * the short option's position when known, else a point 10 m in from the flag.
 */
export function cornerZoneTarget(zone: CornerZone, spot: Vec2, shortMate?: Vec2 | null): Vec2 {
  const top = cornerFromTop(spot)
  const s = top ? -1 : 1 // side of the near post relative to the goal centre
  switch (zone) {
    case 'near':
      return { x: PITCH_LENGTH - 5, y: GOAL_CENTER_Y + s * 2.8 }
    case 'far':
      return { x: PITCH_LENGTH - 6.5, y: GOAL_CENTER_Y - s * 4.2 }
    case 'spot':
      return { x: PITCH_LENGTH - 11, y: GOAL_CENTER_Y + s * 0.8 }
    case 'short':
      return shortMate ? { ...shortMate } : { x: PITCH_LENGTH - 10, y: top ? 9 : 59 }
  }
}

/** Kick parameters for a corner choice: kick kind, arrival height, power and signed curl. */
export function cornerKick(choice: CornerChoice, spot: Vec2): { kind: 'cross' | 'pass'; targetZ: number; power: number; curl: number } {
  if (choice.zone === 'short') return { kind: 'pass', targetZ: 0, power: 0.42, curl: 0 }
  const driven = choice.height === 'driven'
  // Positive curl bends toward +90° of travel: from the top flag that swings the ball away from goal.
  const out = cornerFromTop(spot) ? 1 : -1
  const mag = driven ? 0.45 : 0.6
  return {
    kind: 'cross',
    targetZ: driven ? 1.45 : 2.25,
    power: driven ? 0.88 : 0.62,
    curl: (choice.curl === 'out' ? out : -out) * mag,
  }
}

/** A team-mate the corner runs are planned for. */
export interface CornerRunner {
  id: string
  pos: Vec2
  heading: number
}

/**
 * Runs for the box: the best header attacks the chosen zone, the others spread
 * to the remaining zones (near post, far post, spot) and the edge of the box.
 * Deterministic (id tie-break). Short corners: everyone holds, one man offers.
 */
export function cornerRuns(choice: CornerChoice, spot: Vec2, runners: readonly CornerRunner[]): Map<string, Vec2> {
  const out = new Map<string, Vec2>()
  if (choice.zone === 'short') return out
  const top = cornerFromTop(spot)
  const s = top ? -1 : 1
  const box = runners
    .filter((r) => r.pos.x > PITCH_LENGTH - 22 && Math.abs(r.pos.y - GOAL_CENTER_Y) < 16)
    .sort((a, b) => b.heading - a.heading || (a.id < b.id ? -1 : 1))
  const main = cornerZoneTarget(choice.zone, spot)
  const others = (['near', 'far', 'spot'] as const).filter((z) => z !== choice.zone).map((z) => cornerZoneTarget(z, spot))
  const slots: Vec2[] = [
    // Attack the ball: arrive from a yard behind the drop zone.
    { x: main.x - 1.2, y: main.y - s * 0.6 },
    ...others,
    { x: PITCH_LENGTH - 17, y: GOAL_CENTER_Y - s * 3 },
    { x: PITCH_LENGTH - 15, y: GOAL_CENTER_Y + s * 6 },
  ]
  box.forEach((r, i) => {
    if (i < slots.length) out.set(r.id, slots[i]!)
  })
  return out
}

/** What the free-kick taker sees. Our goal is at x = 0. */
export interface FkView {
  spot: Vec2
  /** Wall players' positions. */
  wall: readonly Vec2[]
  keeper: Vec2 | null
  /** Taker's set-piece skill 0..1. */
  skill: number
  /** Their runners in our box (for a delivery instead of a shot). */
  runners?: readonly { id: string; pos: Vec2 }[]
  /** Our outfielders not in the wall (markers). */
  markers?: readonly Vec2[]
}

export type FkShotLabel = 'near_low' | 'near_top' | 'far' | 'power' | 'cross'

export interface FkShot {
  label: FkShotLabel
  /** Goal-line target (x ≈ 0). */
  target: Vec2
  /** Height at the goal line. */
  z: number
  curl: number
  power: number
  /** 'cross': the runner the ball is played to. */
  passTo?: string
}

/** Lateral distance of the nearest wall man from the straight line spot → target, at the wall. */
export function wallGap(view: FkView, target: Vec2): number {
  let best = Infinity
  const dx = target.x - view.spot.x
  const dy = target.y - view.spot.y
  const l = Math.hypot(dx, dy) || 1
  for (const w of view.wall) {
    // Perpendicular distance of the wall man from the shot line.
    const d = Math.abs((w.x - view.spot.x) * dy - (w.y - view.spot.y) * dx) / l
    if (d < best) best = d
  }
  return best
}

/** Their runner in our box with the most room to the nearest marker. */
function freestRunner(view: FkView): { id: string; pos: Vec2; space: number } | null {
  let best: { id: string; pos: Vec2; space: number } | null = null
  for (const r of view.runners ?? []) {
    if (r.pos.x > 16 || Math.abs(r.pos.y - GOAL_CENTER_Y) > 12) continue
    let space = Infinity
    for (const m of view.markers ?? []) space = Math.min(space, Math.hypot(m.x - r.pos.x, m.y - r.pos.y))
    if (!best || space > best.space || (space === best.space && r.id < best.id)) best = { id: r.id, pos: { ...r.pos }, space }
  }
  return best
}

/**
 * The taker reads the wall and the keeper: a low shot inside the near post if
 * the wall leaves it open, over the wall to the near side if it does not, a
 * curler to the far post away from the keeper, or a drive through a thin wall.
 * Scores each option with some personal noise.
 */
export function chooseFkShot(view: FkView, rng: Rng): FkShot {
  const nearSide = view.spot.y < GOAL_CENTER_Y ? -1 : 1
  const n = view.wall.length
  const keeperY = view.keeper?.y ?? GOAL_CENTER_Y
  const opts: FkShot[] = [
    { label: 'near_low', target: { x: -0.2, y: GOAL_CENTER_Y + nearSide * 3.0 }, z: 0.45, curl: nearSide * 0.25, power: 0.9 },
    { label: 'near_top', target: { x: -0.2, y: GOAL_CENTER_Y + nearSide * 2.6 }, z: 2.05, curl: -nearSide * 0.55, power: 0.84 },
    { label: 'far', target: { x: -0.2, y: GOAL_CENTER_Y - nearSide * 2.9 }, z: 1.35, curl: -nearSide * 0.5, power: 0.86 },
    { label: 'power', target: { x: -0.2, y: GOAL_CENTER_Y - nearSide * 0.6 }, z: 1.15, curl: 0, power: 1.0 },
  ]
  let best = opts[0]
  let bestScore = -Infinity
  for (const o of opts) {
    const gap = wallGap(view, o.target)
    const lowCovered = gap < 0.55
    let score = 0
    switch (o.label) {
      case 'near_low':
        score = lowCovered ? 0.05 : 0.75 + Math.min(1, gap - 0.55) * 0.3
        break
      case 'near_top':
        // Only the skilled ones dip it over a full wall.
        score = 0.25 + view.skill * 0.45 + (lowCovered ? 0.15 : 0)
        break
      case 'far':
        score = 0.4 + view.skill * 0.2 + (lowCovered ? 0 : 0.1)
        break
      case 'power':
        // A thin wall invites a drive straight through the gap.
        score = n <= 2 ? 0.6 : n === 3 ? 0.3 : 0.08
        if (lowCovered) score *= 0.5
        break
    }
    // Away from where the keeper stands.
    score += Math.min(4, Math.abs(o.target.y - keeperY)) * 0.06
    score += rng.range(0, 0.35)
    if (score > bestScore) {
      bestScore = score
      best = o
    }
  }
  // A big wall leaves runners free in the box: whip it in to the freest one instead.
  const free = freestRunner(view)
  if (free && n >= 4) {
    const space = Math.min(4, free.space)
    const score = (n - 3) * 0.25 + space * 0.06 + rng.range(0, 0.35)
    if (score > bestScore) {
      const nearSideY = view.spot.y < GOAL_CENTER_Y ? -1 : 1
      // Played beyond the keeper's reach (penalty-spot depth), quick and flat.
      return { label: 'cross', target: { x: Math.min(13, Math.max(8.5, free.pos.x)), y: free.pos.y }, z: 1.7, curl: nearSideY * 0.4, power: 0.74, passTo: free.id }
    }
  }
  return { ...best!, target: { ...best!.target } }
}
