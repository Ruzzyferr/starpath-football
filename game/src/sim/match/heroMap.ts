/**
 * Hero heat map & shot map (GDD 3.6). Everything is normalised to the hero's
 * attacking direction: x 0 = own goal line → 1 = opponent goal line, y 0..1
 * across. Two sources feed it:
 *  - background minutes: the hero's formation slot shifted with the ball;
 *  - moments: the hero's sampled track from the interactive runtime (or the
 *    scenario start for auto-resolved moments) and every shot taken.
 * Pure functions on plain arrays so the engine state stays JSON.
 */
import { clamp } from '../../core/rng'
import type { HighlightKind, ShotMapEntry, Vec2 } from './types'
import { GOAL_WIDTH, PITCH_LENGTH, PITCH_WIDTH } from './types'

export const HEAT_COLS = 12
export const HEAT_ROWS = 8

export const emptyHeat = (): number[] => new Array<number>(HEAT_COLS * HEAT_ROWS).fill(0)

/** Adds `w` at a normalised point, spread bilinearly over the 4 nearest cells. */
export function addHeat(grid: number[], x01: number, y01: number, w = 1): void {
  const fx = clamp(x01, 0, 0.9999) * HEAT_COLS - 0.5
  const fy = clamp(y01, 0, 0.9999) * HEAT_ROWS - 0.5
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const put = (cx: number, cy: number, k: number) => {
    const c = clamp(cx, 0, HEAT_COLS - 1)
    const r = clamp(cy, 0, HEAT_ROWS - 1)
    grid[r * HEAT_COLS + c]! += w * k
  }
  put(x0, y0, (1 - tx) * (1 - ty))
  put(x0 + 1, y0, tx * (1 - ty))
  put(x0, y0 + 1, (1 - tx) * ty)
  put(x0 + 1, y0 + 1, tx * ty)
}

/**
 * Background presence for one minute on the pitch. `slot` is the formation
 * slot (team-local meters, x ≈ 0..56 own half), `ballX01` the radar ball in the
 * hero's attacking frame. A deterministic wobble (from the minute) spreads it.
 */
export function backgroundPresence(slot: Vec2, ballX01: number, minute: number, keeper: boolean): { x: number; y: number } {
  const baseX = keeper ? 0.04 : clamp(slot.x / PITCH_LENGTH + 0.14, 0.05, 0.85)
  const push = keeper ? (ballX01 - 0.5) * 0.06 : (ballX01 - 0.5) * 0.5
  const wob = Math.sin(minute * 1.37 + slot.y * 0.11)
  const wobY = Math.cos(minute * 0.91 + slot.x * 0.07)
  return {
    x: clamp(baseX + push + wob * (keeper ? 0.01 : 0.05), 0.01, 0.99),
    y: clamp(slot.y / PITCH_WIDTH + wobY * (keeper ? 0.03 : 0.08), 0.02, 0.98),
  }
}

/** Rough chance quality of a shot from a pitch point (hero attacks +x). */
export function shotXg(x: number, y: number, header = false): number {
  const dx = PITCH_LENGTH - x
  const dy = Math.abs(y - PITCH_WIDTH / 2)
  const d = Math.hypot(dx, dy)
  // Visible goal angle.
  const a = Math.atan2(GOAL_WIDTH * Math.max(0.01, dx), dx * dx + dy * dy - (GOAL_WIDTH / 2) ** 2)
  const ang = a < 0 ? a + Math.PI : a
  const base = 1 / (1 + Math.exp(-(-1.2 + ang * 2.6 - d * 0.075)))
  return Math.round(clamp(base * (header ? 0.55 : 1), 0.01, 0.9) * 100) / 100
}

/** Typical shooting spot for an auto-resolved moment (hero frame, meters). */
export function typicalShotSpot(kind: HighlightKind, start: Vec2): Vec2 {
  switch (kind) {
    case 'penalty':
      return { x: PITCH_LENGTH - 11, y: PITCH_WIDTH / 2 }
    case 'freekick':
      return { ...start }
    case 'corner':
    case 'cross':
    case 'rebound':
      return { x: PITCH_LENGTH - 8, y: clamp(start.y, 28, 40) }
    case 'one_on_one':
    case 'counter':
    case 'counter_2v1':
      return { x: Math.max(start.x, PITCH_LENGTH - 13), y: clamp(start.y, 24, 44) }
    default:
      return { x: Math.max(start.x, PITCH_LENGTH - 22), y: clamp(start.y, 18, 50) }
  }
}

/** Converts a pitch-meter point to a normalised shot-map entry. */
export function shotEntry(minute: number, p: Vec2, outcome: ShotMapEntry['outcome'], source: ShotMapEntry['source'], header = false): ShotMapEntry {
  const e: ShotMapEntry = {
    minute,
    x: Math.round(clamp(p.x / PITCH_LENGTH, 0, 1) * 1000) / 1000,
    y: Math.round(clamp(p.y / PITCH_WIDTH, 0, 1) * 1000) / 1000,
    outcome,
    xg: shotXg(p.x, p.y, header),
    source,
  }
  if (header) e.header = true
  return e
}
