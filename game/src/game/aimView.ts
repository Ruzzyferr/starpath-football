/**
 * Aim presentation rules (GAP 2.1#19, #20, #21; 2.2#16, #17, #18). Pure TS so
 * the thresholds are unit tested; MatchScene only draws what these return.
 *
 * - Power colours: green below 60 %, yellow 60–85 %, red 85–100 % (accuracy
 *   starts to spread with Composure, kick.ts `powerSpread`), and a fourth
 *   "overhit" band above 100 %. Colour-blind mode adds a pattern per band
 *   (solid / ticks / dashes / cross-hatch) so the band reads without hue.
 * - Preview length: Vision (with a little Technique) shows 35 % of the path at
 *   40 and 70 % at 80 (30–70 % overall). Hidden on Hard/Legend and on manual
 *   assist.
 * - Landing marker: lofted passes and crosses show an X at the first ground
 *   contact, inside an error ellipse that grows as Technique drops.
 */
import { POWER_BANDS } from './kick'
import type { AimAssist, KickKind } from './kick'

export type PowerBand = 'green' | 'yellow' | 'red' | 'overhit'

export function powerBand(power: number): PowerBand {
  if (power > 1) return 'overhit'
  if (power > POWER_BANDS.red) return 'red'
  if (power > POWER_BANDS.yellow) return 'yellow'
  return 'green'
}

export const BAND_COLOR: Readonly<Record<PowerBand, number>> = {
  green: 0x5dff8a,
  yellow: 0xffe14a,
  red: 0xff3b3b,
  overhit: 0xa0102a,
}

/** Colour-blind pattern drawn over the band (2.2#17). */
export const BAND_PATTERN: Readonly<Record<PowerBand, 'solid' | 'ticks' | 'dashes' | 'hatch'>> = {
  green: 'solid',
  yellow: 'ticks',
  red: 'dashes',
  overhit: 'hatch',
}

/** Fraction (0.3..0.7) of the predicted path that is shown. */
export function previewFraction(vision: number, technique: number): number {
  const s = vision * 0.7 + technique * 0.3
  return Math.min(0.7, Math.max(0.3, 0.35 + (s - 40) * 0.00875))
}

/** Hard and Legend difficulty (scale ≥ 1.15) and manual assist hide the path preview. */
export function previewVisible(difficultyScale: number, assist: AimAssist): boolean {
  return assist !== 'manual' && difficultyScale < 1.15 - 1e-6
}

/** Kinds that get the landing X (lofted balls). */
export const LANDING_KINDS: ReadonlySet<KickKind> = new Set<KickKind>(['lofted', 'cross', 'chip', 'freekick'])

/** First ground contact after the ball has been in the air (index into points), or -1. */
export function firstLanding(points: readonly { z: number }[]): number {
  let air = false
  for (let i = 0; i < points.length; i++) {
    if (points[i].z > 0.5) air = true
    else if (air && points[i].z <= 0.12) return i
  }
  return -1
}

/** Landing error ellipse radius (m) from Technique (0..100): 0.8 m at 100, 3 m at 0. */
export const landingErrorRadius = (technique: number): number => 0.8 + (1 - Math.min(100, Math.max(0, technique)) / 100) * 2.2

/** Launch speed label for the power ring (2.1#21): absolute m/s → "96 km/h" (same unit as the wind read-out). */
export const speedLabel = (ms: number): string => `${Math.round(ms * 3.6)} km/h`

/** The game has no single Technique attribute: passing, first touch and crossing stand in for it. */
export const techniqueOf = (a: { passing: number; firstTouch: number; crossing: number }): number => (a.passing + a.firstTouch + a.crossing) / 3
