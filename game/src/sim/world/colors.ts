/**
 * Kit colour generation and colour math (contrast, distance, clash detection).
 */
import type { KitColors } from '../../core/types'
import type { Rng } from '../../core/rng'

interface PaletteColor {
  hex: string
  weight: number
}

/** Curated football-kit palette (weights = how common the colour is as a home primary). */
export const KIT_PALETTE: readonly PaletteColor[] = [
  { hex: '#C8102E', weight: 10 }, // red
  { hex: '#9B1B30', weight: 4 }, // crimson
  { hex: '#6C1D45', weight: 3 }, // claret
  { hex: '#F58220', weight: 3 }, // orange
  { hex: '#FDB913', weight: 4 }, // amber
  { hex: '#FFD100', weight: 3 }, // yellow
  { hex: '#78BE20', weight: 1 }, // lime
  { hex: '#00843D', weight: 5 }, // green
  { hex: '#0B5F3C', weight: 3 }, // dark green
  { hex: '#00857C', weight: 2 }, // teal
  { hex: '#6CABDD', weight: 4 }, // sky blue
  { hex: '#0057B8', weight: 8 }, // blue
  { hex: '#1D428A', weight: 5 }, // royal
  { hex: '#0B1F41', weight: 4 }, // navy
  { hex: '#5B2C83', weight: 3 }, // purple
  { hex: '#111111', weight: 4 }, // black
  { hex: '#FFFFFF', weight: 8 }, // white
  { hex: '#3C3C3C', weight: 1 }, // charcoal
  { hex: '#B9BCC0', weight: 1 }, // silver
  { hex: '#E4A1C0', weight: 1 }, // pink
  { hex: '#C9A227', weight: 2 }, // gold
]

const PATTERNS: readonly { v: KitColors['pattern']; w: number }[] = [
  { v: 'plain', w: 40 }, { v: 'stripes', w: 20 }, { v: 'hoops', w: 9 },
  { v: 'halves', w: 8 }, { v: 'sash', w: 10 }, { v: 'chevron', w: 13 },
]

/** Minimum primary-colour distance between a club's home and away kits. */
export const MIN_KIT_DISTANCE = 0.3
/** Below this primary distance two kits are considered clashing on the pitch. */
export const KIT_CLASH_DISTANCE = 0.25
const MIN_TRIM_CONTRAST = 2

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** WCAG relative luminance, 0 (black) … 1 (white). */
export function relativeLuminance(hex: string): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG contrast ratio between two colours (1 … 21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Perceptual-ish ("redmean") RGB distance normalised to 0 … 1. */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  const rm = (r1 + r2) / 2
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  const d = Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db)
  return d / 764.83
}

/** True when two kits would be hard to tell apart on the pitch. */
export function kitsClash(a: KitColors, b: KitColors): boolean {
  return colorDistance(a.primary, b.primary) < KIT_CLASH_DISTANCE
}

function pickColor(rng: Rng, accept: (hex: string) => boolean, fallback: string): string {
  const options = KIT_PALETTE.filter((c) => accept(c.hex))
  return options.length ? rng.weighted(options, (c) => c.weight).hex : fallback
}

function trimFor(rng: Rng, primary: string): string {
  const fallback = contrastRatio(primary, '#FFFFFF') >= contrastRatio(primary, '#111111') ? '#FFFFFF' : '#111111'
  return pickColor(rng, (hex) => contrastRatio(primary, hex) >= MIN_TRIM_CONTRAST && colorDistance(primary, hex) > 0.3, fallback)
}

/** Generate a home kit and a clearly contrasting away kit. */
export function generateKits(rng: Rng): { home: KitColors; away: KitColors } {
  const homePrimary = rng.weighted(KIT_PALETTE, (c) => c.weight).hex
  const home: KitColors = {
    primary: homePrimary,
    secondary: trimFor(rng, homePrimary),
    pattern: rng.weighted(PATTERNS, (p) => p.w).v,
  }
  const awayPrimary = pickColor(
    rng,
    (hex) => colorDistance(hex, home.primary) >= MIN_KIT_DISTANCE + 0.05 && colorDistance(hex, home.secondary) >= 0.15,
    relativeLuminance(home.primary) > 0.4 ? '#111111' : '#FFFFFF',
  )
  const away: KitColors = {
    primary: awayPrimary,
    secondary: trimFor(rng, awayPrimary),
    pattern: rng.chance(0.65) ? 'plain' : rng.weighted(PATTERNS, (p) => p.w).v,
  }
  return { home, away }
}
