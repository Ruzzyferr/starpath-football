/** Small steering helper for drill actors that are not full AI agents. */
import type { Vec2 } from '../model'

/** Arrival steering from a position: velocity toward `target`, slowing within `slowR`. */
export function arriveTo(pos: Vec2, target: Vec2, maxSpeed: number, slowR = 2): Vec2 {
  const dx = target.x - pos.x
  const dy = target.y - pos.y
  const l = Math.hypot(dx, dy)
  if (l < 0.03) return { x: 0, y: 0 }
  const s = l < slowR ? maxSpeed * (l / slowR) : maxSpeed
  return { x: (dx / l) * s, y: (dy / l) * s }
}
