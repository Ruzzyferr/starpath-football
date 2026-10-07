/**
 * Colour-vision deficiency helpers (pure). Used to keep the two teams' kits
 * distinguishable in the match for colour-blind players.
 */
import type { KitColors } from './types'

export type CvdMode = 'off' | 'protanopia' | 'deuteranopia' | 'tritanopia'
type Rgb = [number, number, number]

/** Viénot / Machado severity-1 matrices operating on linear RGB. */
const MATRICES: Record<Exclude<CvdMode, 'off'>, number[]> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0')
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)]
}
const toLin = (v: number): number => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const toSrgb = (v: number): number => {
  const c = Math.min(1, Math.max(0, v))
  return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)
}

/** Colour as perceived under `mode` (sRGB 0..255). */
export function simulate(hex: string, mode: CvdMode): Rgb {
  const [r, g, b] = hexToRgb(hex)
  const lin: Rgb = [toLin(r), toLin(g), toLin(b)]
  if (mode === 'off') return [r, g, b]
  const m = MATRICES[mode]
  return [
    toSrgb(m[0] * lin[0] + m[1] * lin[1] + m[2] * lin[2]),
    toSrgb(m[3] * lin[0] + m[4] * lin[1] + m[5] * lin[2]),
    toSrgb(m[6] * lin[0] + m[7] * lin[1] + m[8] * lin[2]),
  ]
}

/** Perceptual-ish distance between two kit colours as seen under `mode` (weighted RGB, 0..~765). */
export function cvdDistance(a: string, b: string, mode: CvdMode): number {
  const x = simulate(a, mode)
  const y = simulate(b, mode)
  const rm = (x[0] + y[0]) / 2
  const dr = x[0] - y[0]
  const dg = x[1] - y[1]
  const db = x[2] - y[2]
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db)
}

const luma = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
}

/** Distance below which two kits count as confusable (stricter in colour-blind modes). */
export const KIT_MIN_DISTANCE: Record<CvdMode, number> = { off: 90, protanopia: 150, deuteranopia: 150, tritanopia: 150 }

/**
 * Returns the opponent kit, adjusted if it is too close to the hero kit under
 * `mode`: first try swapping primary/secondary, then fall back to white/black
 * with a pattern that differs from the hero's (outline/pattern fallback).
 */
export function distinctOpponentKit(hero: KitColors, opp: KitColors, mode: CvdMode): KitColors {
  const min = KIT_MIN_DISTANCE[mode]
  if (cvdDistance(hero.primary, opp.primary, mode) >= min) return opp
  const swapped: KitColors = { primary: opp.secondary, secondary: opp.primary, pattern: opp.pattern }
  if (cvdDistance(hero.primary, swapped.primary, mode) >= min) return swapped
  const light = luma(hero.primary) < 0.35
  const primary = light ? '#f4f4f4' : '#15161a'
  const pattern: KitColors['pattern'] = hero.pattern === 'hoops' ? 'stripes' : 'hoops'
  const secondary = cvdDistance(primary, opp.primary, mode) > 80 ? opp.primary : light ? '#15161a' : '#f4f4f4'
  return { primary, secondary, pattern }
}
