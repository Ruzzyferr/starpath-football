/**
 * Live-match radar: where the 22 players stand while the minute-based sim
 * runs. The engine only tracks the ball zone, so the radar used to show a lone
 * ball sliding over an empty pitch (iPhone playtest: "players are not visible,
 * only the ball moves"). This derives a believable team shape from each side's
 * formation slots: both blocks slide with the ball, the defensive line steps up
 * as the ball goes forward, the shape narrows towards the ball's flank and every
 * player sways a little with the clock. Pure and deterministic (no RNG).
 *
 * Output coords match LiveMatchView.ballX/ballY: x 0..1 along the pitch (home
 * attacks +x), y 0..1 across.
 */
import { clamp } from '../../core/rng'

/** One formation slot in team-relative metres: x 0 own goal line → 52.5 halfway, y 0..68 across (as seen attacking). */
export interface RadarSlot {
  id: string
  number: number
  x: number
  y: number
  isHero?: boolean
  isKeeper?: boolean
}

export interface RadarDot {
  id: string
  number: number
  x: number
  y: number
  isHero?: boolean
}

export interface RadarShapeIn {
  home: readonly RadarSlot[]
  away: readonly RadarSlot[]
  ballX: number
  ballY: number
  minute: number
}

/** Shape for the side attacking +x, given the ball in that side's frame (0 own goal → 1 opponent goal). */
function sideShape(slots: readonly RadarSlot[], bx: number, by: number, minute: number, phase: number): RadarDot[] {
  // Defensive line height and the block's stretch follow the ball up the pitch.
  const line = 0.1 + 0.32 * clamp((bx - 0.15) / 0.75, 0, 1)
  const span = 0.36 + 0.06 * clamp(bx, 0, 1)
  return slots.map((s, i) => {
    const d = clamp(s.x / 52.5, 0, 1)
    const keeper = s.isKeeper ?? d < 0.12
    const sway = Math.sin(minute * 0.9 + i * 1.7 + phase) * 0.012
    let x: number
    let y = clamp(s.y / 68, 0.04, 0.96)
    if (keeper) {
      x = 0.025 + 0.05 * clamp(bx, 0, 1)
      y = 0.5 + (by - 0.5) * 0.25
    } else {
      x = line + (d - 0.25) * span * 1.35
      // Narrow towards the ball's flank, more for the players nearer the ball.
      const pull = 0.18 + 0.22 * (1 - Math.min(1, Math.abs(x - bx) * 2))
      y = y + (by - y) * pull
    }
    return { id: s.id, number: s.number, x: clamp(x + sway, 0.02, 0.98), y: clamp(y + sway * 0.8, 0.04, 0.96), ...(s.isHero ? { isHero: true } : {}) }
  })
}

/** Dots for both teams (away is mirrored: it attacks -x and its y is seen from the other end). */
export function radarShape(i: RadarShapeIn): { home: RadarDot[]; away: RadarDot[] } {
  const bx = clamp(Number.isFinite(i.ballX) ? i.ballX : 0.5, 0, 1)
  const by = clamp(Number.isFinite(i.ballY) ? i.ballY : 0.5, 0, 1)
  const m = Number.isFinite(i.minute) ? i.minute : 0
  const home = sideShape(i.home, bx, by, m, 0)
  const away = sideShape(i.away, 1 - bx, 1 - by, m, 2.1).map((p) => ({ ...p, x: 1 - p.x, y: 1 - p.y }))
  return { home, away }
}
