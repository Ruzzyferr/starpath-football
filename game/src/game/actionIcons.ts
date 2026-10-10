/**
 * Vector icons for the match context buttons (game/actionSet). Drawn with Phaser Graphics so they stay
 * crisp at any DPR and need no font glyphs (emoji differ per platform). Every icon fits a square of
 * half-size `s` centred on (x, y).
 */
import type Phaser from 'phaser'
import type { ActionIcon } from './actionSet'

type G = Phaser.GameObjects.Graphics

function arrow(g: G, x1: number, y1: number, x2: number, y2: number, s: number, color: number, a: number): void {
  g.lineBetween(x1, y1, x2, y2)
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const h = s * 0.42
  g.fillStyle(color, a)
  g.fillTriangle(
    x2 + Math.cos(ang) * h * 0.35, y2 + Math.sin(ang) * h * 0.35,
    x2 - Math.cos(ang - 0.55) * h, y2 - Math.sin(ang - 0.55) * h,
    x2 - Math.cos(ang + 0.55) * h, y2 - Math.sin(ang + 0.55) * h,
  )
}

function curve(g: G, pts: [number, number][]): void {
  g.beginPath()
  g.moveTo(pts[0]![0], pts[0]![1])
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]![0], pts[i]![1])
  g.strokePath()
}

/** Quadratic Bézier sampled into a polyline. */
function quad(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, n = 10): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    out.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1])
  }
  return out
}

function arcArrow(g: G, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, s: number, color: number, a: number): void {
  const pts = quad(x0, y0, cx, cy, x1, y1)
  curve(g, pts.slice(0, -1))
  const p = pts[pts.length - 2]!
  arrow(g, p[0], p[1], x1, y1, s, color, a)
}

/** Filled polygon from [x, y] pairs. */
function poly(g: G, pts: readonly { x: number; y: number }[]): void {
  g.beginPath()
  g.moveTo(pts[0]!.x, pts[0]!.y)
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]!.x, pts[i]!.y)
  g.closePath()
  g.fillPath()
}

function ball(g: G, x: number, y: number, r: number, color: number, a: number): void {
  g.fillStyle(color, a)
  g.fillCircle(x, y, r)
}

/** Draws `icon` centred on (x, y), half-size `s`, stroke width `w`. */
export function drawActionIcon(g: G, icon: ActionIcon, x: number, y: number, s: number, color: number, a: number, w: number): void {
  g.lineStyle(w, color, a)
  g.fillStyle(color, a)
  switch (icon) {
    case 'bolt':
      poly(g, [
        { x: x + s * 0.15, y: y - s }, { x: x - s * 0.55, y: y + s * 0.12 }, { x: x - s * 0.02, y: y + s * 0.12 },
        { x: x - s * 0.2, y: y + s }, { x: x + s * 0.55, y: y - s * 0.18 }, { x: x + s * 0.04, y: y - s * 0.18 },
      ])
      return
    case 'swerve':
      curve(g, [[x - s * 0.8, y + s * 0.7], [x - s * 0.2, y + s * 0.5], [x + s * 0.2, y], [x - s * 0.15, y - s * 0.45], [x + s * 0.3, y - s * 0.75]])
      arrow(g, x + s * 0.05, y - s * 0.62, x + s * 0.75, y - s * 0.85, s, color, a)
      ball(g, x - s * 0.75, y + s * 0.72, s * 0.2, color, a)
      return
    case 'shield':
      poly(g, [
        { x, y: y - s }, { x: x + s * 0.8, y: y - s * 0.62 }, { x: x + s * 0.68, y: y + s * 0.3 },
        { x, y: y + s }, { x: x - s * 0.68, y: y + s * 0.3 }, { x: x - s * 0.8, y: y - s * 0.62 },
      ])
      return
    case 'pass':
      ball(g, x - s * 0.62, y + s * 0.1, s * 0.26, color, a)
      arrow(g, x - s * 0.25, y + s * 0.1, x + s * 0.9, y + s * 0.1, s, color, a)
      return
    case 'through':
      ball(g, x - s * 0.1, y - s * 0.62, s * 0.2, color, a)
      ball(g, x - s * 0.1, y + s * 0.62, s * 0.2, color, a)
      arrow(g, x - s * 0.9, y, x + s * 0.9, y, s, color, a)
      return
    case 'lofted':
      arcArrow(g, x - s * 0.9, y + s * 0.6, x, y - s * 1.3, x + s * 0.9, y + s * 0.5, s, color, a)
      return
    case 'cross':
      arcArrow(g, x - s * 0.9, y + s * 0.2, x - s * 0.1, y - s * 1.2, x + s * 0.55, y + s * 0.15, s, color, a)
      g.strokeRect(x + s * 0.3, y + s * 0.4, s * 0.65, s * 0.5)
      return
    case 'goal':
      g.lineBetween(x - s * 0.9, y + s * 0.55, x - s * 0.9, y - s * 0.6)
      g.lineBetween(x - s * 0.9, y - s * 0.6, x + s * 0.9, y - s * 0.6)
      g.lineBetween(x + s * 0.9, y - s * 0.6, x + s * 0.9, y + s * 0.55)
      ball(g, x + s * 0.35, y - s * 0.12, s * 0.24, color, a)
      g.lineStyle(w * 0.6, color, a * 0.6)
      g.lineBetween(x - s * 0.55, y + s * 0.85, x + s * 0.15, y + s * 0.12)
      return
    case 'hand':
      g.fillRoundedRect(x - s * 0.45, y - s * 0.15, s * 0.9, s * 0.95, s * 0.25)
      for (let i = 0; i < 4; i++) g.fillRoundedRect(x - s * 0.45 + i * s * 0.24, y - s * 0.95, s * 0.18, s * 0.9, s * 0.09)
      g.fillRoundedRect(x - s * 0.82, y - s * 0.05, s * 0.45, s * 0.18, s * 0.09)
      return
    case 'head':
      g.strokeCircle(x, y + s * 0.38, s * 0.48)
      ball(g, x + s * 0.15, y - s * 0.68, s * 0.26, color, a)
      g.lineBetween(x - s * 0.55, y - s * 0.5, x - s * 0.3, y - s * 0.3)
      return
    case 'jump':
      arrow(g, x, y + s * 0.55, x, y - s * 0.95, s, color, a)
      g.lineBetween(x - s * 0.8, y + s * 0.85, x + s * 0.8, y + s * 0.85)
      return
    case 'boot':
      poly(g, [
        { x: x - s * 0.55, y: y - s * 0.9 }, { x: x - s * 0.05, y: y - s * 0.9 }, { x: x - s * 0.05, y: y + s * 0.05 },
        { x: x + s * 0.85, y: y + s * 0.3 }, { x: x + s * 0.85, y: y + s * 0.7 }, { x: x - s * 0.55, y: y + s * 0.7 },
      ])
      for (let i = 0; i < 3; i++) g.fillRect(x - s * 0.45 + i * s * 0.5, y + s * 0.72, s * 0.16, s * 0.2)
      return
    case 'slide':
      arrow(g, x - s * 0.9, y + s * 0.35, x + s * 0.9, y + s * 0.35, s, color, a)
      g.lineStyle(w * 0.7, color, a * 0.55)
      g.lineBetween(x - s * 0.85, y + s * 0.8, x + s * 0.2, y + s * 0.8)
      g.lineBetween(x - s * 0.6, y - s * 0.15, x + s * 0.1, y - s * 0.15)
      ball(g, x + s * 0.55, y - s * 0.55, s * 0.24, color, a)
      return
    case 'contain':
      // Backing off square-on: a double chevron pointing back at our goal, a line he must not cross.
      curve(g, [[x - s * 0.1, y - s * 0.75], [x - s * 0.7, y - s * 0.1], [x - s * 0.1, y + s * 0.55]])
      curve(g, [[x + s * 0.45, y - s * 0.75], [x - s * 0.15, y - s * 0.1], [x + s * 0.45, y + s * 0.55]])
      g.lineBetween(x + s * 0.85, y - s * 0.9, x + s * 0.85, y + s * 0.7)
      return
    case 'block':
      for (let i = -1; i <= 1; i++) g.fillRoundedRect(x + i * s * 0.55 - s * 0.2, y - s * 0.65, s * 0.4, s * 1.4, s * 0.15)
      ball(g, x, y - s * 0.95, s * 0.18, color, a)
      return
    case 'intercept': {
      g.lineStyle(w * 0.7, color, a * 0.6)
      for (let i = 0; i < 4; i++) g.lineBetween(x - s * 0.95 + i * s * 0.5, y - s * 0.55 + i * s * 0.36, x - s * 0.72 + i * s * 0.5, y - s * 0.39 + i * s * 0.36)
      g.lineStyle(w, color, a)
      arrow(g, x - s * 0.1, y + s * 0.95, x + s * 0.2, y - s * 0.6, s, color, a)
      return
    }
    case 'press':
      arrow(g, x - s * 0.95, y, x - s * 0.15, y, s, color, a)
      arrow(g, x + s * 0.95, y, x + s * 0.15, y, s, color, a)
      ball(g, x, y - s * 0.6, s * 0.2, color, a)
      return
    case 'dive':
      arcArrow(g, x - s * 0.7, y + s * 0.75, x - s * 0.5, y - s * 0.6, x + s * 0.85, y - s * 0.45, s, color, a)
      g.fillRoundedRect(x - s * 0.95, y + s * 0.55, s * 0.5, s * 0.4, s * 0.12)
      return
    case 'diveL':
      arcArrow(g, x + s * 0.6, y + s * 0.6, x + s * 0.1, y - s * 0.9, x - s * 0.9, y - s * 0.1, s, color, a)
      return
    case 'diveR':
      arcArrow(g, x - s * 0.6, y + s * 0.6, x - s * 0.1, y - s * 0.9, x + s * 0.9, y - s * 0.1, s, color, a)
      return
    case 'stay':
      g.lineBetween(x - s * 0.95, y - s * 0.75, x + s * 0.95, y - s * 0.75)
      g.lineBetween(x - s * 0.95, y - s * 0.75, x - s * 0.95, y + s * 0.6)
      g.lineBetween(x + s * 0.95, y - s * 0.75, x + s * 0.95, y + s * 0.6)
      g.fillCircle(x, y - s * 0.3, s * 0.2)
      g.lineBetween(x, y - s * 0.1, x, y + s * 0.45)
      g.lineBetween(x - s * 0.5, y + s * 0.05, x + s * 0.5, y + s * 0.05)
      g.lineBetween(x, y + s * 0.45, x - s * 0.3, y + s * 0.85)
      g.lineBetween(x, y + s * 0.45, x + s * 0.3, y + s * 0.85)
      return
    case 'rush':
      arrow(g, x - s * 0.5, y, x + s * 0.95, y, s, color, a)
      g.lineStyle(w * 0.7, color, a * 0.55)
      g.lineBetween(x - s * 0.95, y - s * 0.45, x - s * 0.35, y - s * 0.45)
      g.lineBetween(x - s * 0.95, y + s * 0.45, x - s * 0.35, y + s * 0.45)
      return
    case 'glove':
      g.fillRoundedRect(x - s * 0.5, y - s * 0.2, s * 1.0, s * 1.05, s * 0.3)
      for (let i = 0; i < 4; i++) g.fillRoundedRect(x - s * 0.5 + i * s * 0.26, y - s * 0.95, s * 0.22, s * 0.95, s * 0.11)
      g.fillRoundedRect(x - s * 0.95, y - s * 0.05, s * 0.55, s * 0.24, s * 0.12)
      return
    case 'fist':
      g.fillRoundedRect(x - s * 0.6, y - s * 0.55, s * 1.2, s * 0.95, s * 0.3)
      g.fillRoundedRect(x - s * 0.35, y + s * 0.4, s * 0.7, s * 0.5, s * 0.12)
      g.lineStyle(w * 0.6, 0x000000, a * 0.35)
      for (let i = 1; i < 4; i++) g.lineBetween(x - s * 0.6 + i * s * 0.3, y - s * 0.55, x - s * 0.6 + i * s * 0.3, y - s * 0.15)
      return
    case 'throw':
      g.fillRoundedRect(x - s * 0.95, y + s * 0.3, s * 0.55, s * 0.6, s * 0.15)
      arcArrow(g, x - s * 0.6, y + s * 0.2, x - s * 0.2, y - s * 1.0, x + s * 0.9, y - s * 0.2, s, color, a)
      return
    case 'kick':
      poly(g, [
        { x: x - s * 0.95, y: y - s * 0.8 }, { x: x - s * 0.6, y: y - s * 0.8 }, { x: x - s * 0.6, y: y + s * 0.15 },
        { x: x - s * 0.05, y: y + s * 0.35 }, { x: x - s * 0.05, y: y + s * 0.7 }, { x: x - s * 0.95, y: y + s * 0.7 },
      ])
      arcArrow(g, x + s * 0.05, y + s * 0.1, x + s * 0.4, y - s * 1.0, x + s * 0.95, y - s * 0.55, s, color, a)
      return
  }
}
