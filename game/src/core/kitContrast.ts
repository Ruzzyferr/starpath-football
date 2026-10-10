/**
 * Ball / kit / pitch contrast (pure, Phaser-free). Shared by the match scene
 * (highlights) and the live-match radar so the ball never melts into a kit:
 *
 * - `ballDistance` is a CIELAB ΔE weighted for a *small* moving object: the eye
 *   resolves lightness at small sizes far better than hue, so chroma counts at 35 %.
 * - `pickBallStyle` keeps the classic white ball when it reads well against both
 *   kits and the turf, otherwise switches to the most distinct hi-vis ball
 *   (orange, black, magenta) and always gives it a rim that contrasts with its fill.
 * - `resolveMatchKits` is the home/away clash rule: the away side changes kit,
 *   and if even its change kit clashes, the most distinct option (incl. a neutral) wins.
 */
import type { KitColors } from './types'
import { KIT_CLASH_DISTANCE, colorDistance } from '../sim/world/colors'

type Lab = [number, number, number]

const lin = (v: number): number => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** sRGB hex → CIELAB (D65). */
export function hexToLab(hex: string): Lab {
  const h = hex.replace('#', '')
  const f6 = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0')
  const n = parseInt(f6.slice(0, 6), 16)
  const r = lin((n >> 16) & 255)
  const g = lin((n >> 8) & 255)
  const b = lin(n & 255)
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

/** Plain CIE76 ΔE between two colours. */
export function deltaE(a: string, b: string): number {
  const x = hexToLab(a)
  const y = hexToLab(b)
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

/** Chroma weight of the small-object distance (lightness weight is 1). */
const SMALL_CHROMA_W = 0.35

/** ΔE for a small object (the ball) against a large field (kit, turf): lightness-led. */
export function ballDistance(a: string, b: string): number {
  const x = hexToLab(a)
  const y = hexToLab(b)
  return Math.hypot(x[0] - y[0], SMALL_CHROMA_W * (x[1] - y[1]), SMALL_CHROMA_W * (x[2] - y[2]))
}

/** Every ball the game draws must clear this distance against both kits and the turf. */
export const BALL_MIN_CONTRAST = 25
/** The classic white ball is kept only while it clears this comfortable margin. */
export const BALL_KEEP_WHITE = 35

/** Bonus distance granted to `soft` colours in pickBallStyle. */
const SOFT_MARGIN = 12

export interface BallStyle {
  /** Ball body colour. */
  fill: string
  /** Panel (pentagon) colour. */
  patch: string
  /** Outline colour (contrasts with the fill). */
  rim: string
  /** True when the classic white ball was swapped out. */
  switched: boolean
  /** Worst distance to the colours it was checked against. */
  contrast: number
  /** Below the minimum even after switching (more than two kits in play): draw a halo ring. */
  halo: boolean
}

const WHITE = { fill: '#fbfbf7', patch: '#1b1b1b', rim: '#0a0c10' }
const ORANGE = { fill: '#ff6a00', patch: '#3a1600', rim: '#0a0c10' }
const CANDIDATES: readonly { fill: string; patch: string; rim: string }[] = [
  WHITE,
  ORANGE, // hi-vis winter ball
  { fill: '#151515', patch: '#4a4a4a', rim: '#ffffff' }, // dark panels: the body reads dark, the rim carries the edge
  { fill: '#ff2bd6', patch: '#2a0624', rim: '#0a0c10' },
]

/**
 * The ball to use against `avoid` colours (kit primaries/secondaries, turf).
 * `snow` prefers the orange ball (white ball on snow), like real football.
 */
export function pickBallStyle(avoid: readonly string[], opts: { snow?: boolean; soft?: readonly string[] } = {}): BallStyle {
  // `soft` colours (goalkeepers: 2 of 22 players) count with a margin, so they steer the choice
  // between hi-vis balls without forcing the classic white ball out on their own.
  const soft = opts.soft ?? []
  const score = (fill: string) =>
    Math.min(100, ...avoid.map((c) => ballDistance(fill, c)), ...soft.map((c) => ballDistance(fill, c) + SOFT_MARGIN))
  const first = opts.snow ? ORANGE : WHITE
  const firstScore = score(first.fill)
  if (firstScore >= BALL_KEEP_WHITE) return { ...first, switched: first !== WHITE, contrast: firstScore, halo: false }
  let best = first
  let bestScore = firstScore
  for (const c of CANDIDATES) {
    const s = score(c.fill)
    if (s > bestScore + 0.5) {
      best = c
      bestScore = s
    }
  }
  return { ...best, switched: best !== WHITE, contrast: bestScore, halo: bestScore < BALL_MIN_CONTRAST }
}

/** Kits actually worn: the away side changes on a clash; a neutral kit is the last resort. */
export function resolveMatchKits(home: KitColors, away: KitColors, awayAlt?: KitColors): { home: KitColors; away: KitColors } {
  const d = (k: KitColors) => colorDistance(home.primary, k.primary)
  if (d(away) >= KIT_CLASH_DISTANCE) return { home, away }
  const options: KitColors[] = [away]
  if (awayAlt) options.push(awayAlt)
  options.push({ primary: away.secondary, secondary: away.primary, pattern: away.pattern })
  if (awayAlt) options.push({ primary: awayAlt.secondary, secondary: awayAlt.primary, pattern: awayAlt.pattern })
  for (const k of options) if (d(k) >= KIT_CLASH_DISTANCE) return { home, away: k }
  const light = colorDistance(home.primary, '#f4f4f4') >= colorDistance(home.primary, '#15161a')
  const primary = light ? '#f4f4f4' : '#15161a'
  return { home, away: { primary, secondary: light ? '#15161a' : '#f4f4f4', pattern: away.pattern } }
}
