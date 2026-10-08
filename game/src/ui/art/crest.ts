/**
 * Procedural club crest from a CrestSpec. Shapes × heraldic partitions ×
 * 16 geometric charges (symbols) × initials. Returns an SVG string
 * (viewBox 0 0 100 120). Deterministic.
 */
import type { CrestSpec } from '../../core/types'
import { bestContrast, esc, hashString, polyPoints, shade, starPoints, svgWrap, uid } from './svg'

export const CREST_SYMBOL_COUNT = 16
export const CREST_SYMBOL_NAMES = [
  'star', 'ball', 'crown', 'tower', 'anchor', 'bolt', 'eagle', 'lion',
  'wolf', 'oak', 'ship', 'sun', 'trident', 'bull', 'wave', 'cross',
] as const

/** Charges drawn in a 40×40 box centred on (0,0). */
function symbol(i: number, c: string, bg: string): string {
  switch (((i % CREST_SYMBOL_COUNT) + CREST_SYMBOL_COUNT) % CREST_SYMBOL_COUNT) {
    case 0:
      return `<polygon points="${starPoints(0, 1, 19, 8, 5)}" fill="${c}"/>`
    case 1: // ball
      return `<circle r="17" fill="${c}"/><polygon points="${polyPoints(0, 0, 6.5, 5)}" fill="${bg}"/>` +
        [0, 1, 2, 3, 4].map((k) => {
          const a = -Math.PI / 2 + (k * 2 * Math.PI) / 5
          const x1 = Math.cos(a) * 6.5, y1 = Math.sin(a) * 6.5
          const x2 = Math.cos(a) * 17, y2 = Math.sin(a) * 17
          return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${bg}" stroke-width="2"/>`
        }).join('')
    case 2: // crown
      return `<path d="M-18 10L-20 -12L-9 -2L0 -16L9 -2L20 -12L18 10Z" fill="${c}"/><rect x="-18" y="12" width="36" height="5" rx="1.5" fill="${c}"/><circle cx="0" cy="-17" r="2.6" fill="${c}"/><circle cx="-20" cy="-13" r="2.2" fill="${c}"/><circle cx="20" cy="-13" r="2.2" fill="${c}"/>`
    case 3: // tower
      return `<path d="M-14 18L-12 -6L-16 -6L-16 -17L-10 -17L-10 -12L-4 -12L-4 -17L4 -17L4 -12L10 -12L10 -17L16 -17L16 -6L12 -6L14 18Z" fill="${c}"/><path d="M-4 18L-4 8Q0 3 4 8L4 18Z" fill="${bg}"/><rect x="-2" y="-4" width="4" height="7" rx="2" fill="${bg}"/>`
    case 4: // anchor
      return `<g fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"><circle cx="0" cy="-13" r="4.5"/><path d="M0 -8.5V17M-9 -3H9M-16 4Q-14 17 0 17Q14 17 16 4"/></g><path d="M-19 6L-16 0L-12 7Z M19 6L16 0L12 7Z" fill="${c}"/>`
    case 5: // bolt
      return `<path d="M5 -20L-13 3L-2 3L-6 20L13 -4L2 -4Z" fill="${c}"/>`
    case 6: // eagle (geometric)
      return `<path d="M0 -14L4 -9L4 -4L20 -14L17 -2L22 -4L15 8L6 6L6 12L10 18L0 14L-10 18L-6 12L-6 6L-15 8L-22 -4L-17 -2L-20 -14L-4 -4L-4 -9Z" fill="${c}"/><circle cx="1.5" cy="-11" r="1.1" fill="${bg}"/><path d="M4 -9L7 -8L4 -6Z" fill="${c}"/>`
    case 7: // lion head
      return `<polygon points="${starPoints(0, 0, 19, 13, 12, 0)}" fill="${c}"/><path d="M-9 -6Q0 -14 9 -6L8 6Q0 15 -8 6Z" fill="${bg}"/><path d="M-5 -2L-2 -1M5 -2L2 -1M-3 5L0 8L3 5" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/>`
    case 8: // wolf head
      return `<path d="M-14 -18L-6 -7L6 -7L14 -18L15 0L6 16L0 19L-6 16L-15 0Z" fill="${c}"/><path d="M-7 -1L-3 1M7 -1L3 1" stroke="${bg}" stroke-width="2.2" stroke-linecap="round"/><path d="M-3 10L0 13L3 10Z" fill="${bg}"/>`
    case 9: // oak
      return `<circle cx="-8" cy="-4" r="9" fill="${c}"/><circle cx="8" cy="-4" r="9" fill="${c}"/><circle cx="0" cy="-12" r="9" fill="${c}"/><circle cx="0" cy="1" r="8" fill="${c}"/><path d="M-3 4L-4 19L4 19L3 4Z" fill="${c}"/><path d="M-12 19H12" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`
    case 10: // ship
      return `<path d="M-19 7L19 7L13 17L-13 17Z" fill="${c}"/><path d="M-1 -19L-1 5L-15 5Z" fill="${c}"/><path d="M2 -14L2 5L14 5Z" fill="${c}" opacity=".8"/><path d="M-1 -19L-1 -22L5 -20.5Z" fill="${c}"/>`
    case 11: // sun
      return `<circle r="9" fill="${c}"/>` + Array.from({ length: 12 }, (_, k) => {
        const a = (k * Math.PI) / 6
        return `<path d="M${(Math.cos(a) * 12).toFixed(1)} ${(Math.sin(a) * 12).toFixed(1)}L${(Math.cos(a) * 19).toFixed(1)} ${(Math.sin(a) * 19).toFixed(1)}" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/>`
      }).join('')
    case 12: // trident
      return `<g fill="none" stroke="${c}" stroke-width="3.6" stroke-linecap="round"><path d="M0 -18V19M-12 -14V-5Q-12 2 0 2Q12 2 12 -5V-14"/></g><path d="M0 -21L-3.5 -14L3.5 -14Z M-12 -17L-15 -11L-9 -11Z M12 -17L9 -11L15 -11Z" fill="${c}"/>`
    case 13: // bull
      return `<path d="M-20 -14Q-16 -2 -8 -4L-8 6Q-6 16 0 18Q6 16 8 6L8 -4Q16 -2 20 -14Q14 -8 8 -9L-8 -9Q-14 -8 -20 -14Z" fill="${c}"/><circle cx="-4" cy="1" r="1.6" fill="${bg}"/><circle cx="4" cy="1" r="1.6" fill="${bg}"/><ellipse cx="0" cy="11" rx="4.5" ry="3" fill="${bg}" opacity=".7"/>`
    case 14: // waves
      return `<g fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"><path d="M-19 -7Q-14 -13 -9.5 -7T0 -7T9.5 -7T19 -7"/><path d="M-19 3Q-14 -3 -9.5 3T0 3T9.5 3T19 3"/><path d="M-19 13Q-14 7 -9.5 13T0 13T9.5 13T19 13"/></g>`
    default: // cross
      return `<path d="M-5 -19H5V-5H19V5H5V19H-5V5H-19V-5H-5Z" fill="${c}"/>`
  }
}

function shapePath(shape: CrestSpec['shape']): string {
  switch (shape) {
    case 'circle':
      return 'M50 12a48 48 0 1 0 0.01 0Z'
    case 'diamond':
      return 'M50 4L94 58L50 114L6 58Z'
    case 'hexagon':
      return 'M50 6L92 30L92 88L50 114L8 88L8 30Z'
    case 'banner':
      return 'M10 6H90V96L50 116L10 96Z'
    default: // heater shield
      return 'M10 8H90V52C90 82 72 102 50 114C28 102 10 82 10 52Z'
  }
}

type Partition = 'plain' | 'pale' | 'fess' | 'bend' | 'quarterly' | 'chevron' | 'stripes'
const PARTITIONS: Partition[] = ['plain', 'pale', 'fess', 'bend', 'quarterly', 'chevron', 'stripes']

function partition(p: Partition, c: string): string {
  switch (p) {
    case 'pale': return `<rect x="50" y="0" width="50" height="120" fill="${c}"/>`
    case 'fess': return `<rect x="0" y="60" width="100" height="60" fill="${c}"/>`
    case 'bend': return `<path d="M0 0L100 120L0 120Z" fill="${c}"/>`
    case 'quarterly': return `<rect x="50" y="0" width="50" height="60" fill="${c}"/><rect x="0" y="60" width="50" height="60" fill="${c}"/>`
    case 'chevron': return `<path d="M0 120L50 62L100 120L100 96L50 38L0 96Z" fill="${c}"/>`
    case 'stripes': return [14, 38, 62, 86].map((x) => `<rect x="${x}" y="0" width="12" height="120" fill="${c}"/>`).join('')
    default: return ''
  }
}

export interface CrestOpts {
  /** Number of championship stars above the crest. */
  stars?: number
  title?: string
  /** Hide initials (tiny sizes). */
  compact?: boolean
}

export function crestSvg(spec: CrestSpec, opts: CrestOpts = {}): string {
  const [c0, c1, c2] = spec.colors
  const h = hashString(spec.initials + spec.colors.join('') + spec.shape)
  const part = PARTITIONS[h % PARTITIONS.length]
  const id = uid('cr', spec.shape, spec.symbol, spec.colors.join(), spec.initials, opts.stars ?? 0, opts.compact ? 1 : 0)
  const shape = shapePath(spec.shape)
  // The charge sits on a medallion so it always contrasts regardless of partition.
  const medal = c0
  const charge = bestContrast(medal, [c1, c2, '#ffffff', '#0b1220'])
  const outline = shade(c2, -0.1)
  const inits = esc(spec.initials.slice(0, 4))
  const showText = !opts.compact && inits.length > 0
  const hasBand = spec.shape === 'shield' || spec.shape === 'banner'
  const symY = showText && hasBand ? 50 : showText ? 52 : 60
  const textColor = bestContrast(c2, ['#ffffff', '#0b1220', c0, c1])

  let text = ''
  if (showText) {
    if (hasBand) {
      text = `<path d="M14 78H86L82 92H18Z" fill="${c2}"/><text x="50" y="89.5" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="13" letter-spacing="1.5" fill="${textColor}">${inits}</text>`
    } else {
      text = `<rect x="26" y="${spec.shape === 'circle' ? 74 : 80}" width="48" height="15" rx="3" fill="${c2}"/><text x="50" y="${spec.shape === 'circle' ? 85.5 : 91.5}" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="12" letter-spacing="1.2" fill="${textColor}">${inits}</text>`
    }
  }

  let stars = ''
  const n = Math.min(5, opts.stars ?? 0)
  for (let i = 0; i < n; i++) {
    const x = 50 + (i - (n - 1) / 2) * 9
    stars += `<polygon points="${starPoints(x, 3.5, 3.6, 1.5, 5)}" fill="#ffc83d"/>`
  }

  const body =
    `<defs><clipPath id="${id}k"><path d="${shape}"/></clipPath>` +
    `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>` +
    `<path d="${shape}" fill="#000" opacity=".28" transform="translate(2.5 3)"/>` +
    `<g clip-path="url(#${id}k)"><rect width="100" height="120" fill="${c1}"/>${partition(part!, c0)}<rect width="100" height="120" fill="url(#${id}g)"/></g>` +
    `<path d="${shape}" fill="none" stroke="${outline}" stroke-width="5"/>` +
    `<path d="${shape}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1" transform="translate(50 60) scale(.9) translate(-50 -60)"/>` +
    `<circle cx="50" cy="${symY}" r="${showText ? 22 : 27}" fill="${medal}" stroke="${c2}" stroke-width="2.5"/>` +
    `<g transform="translate(50 ${symY}) scale(${showText ? 0.82 : 1})">${symbol(spec.symbol, charge, medal)}</g>` +
    text + stars

  return svgWrap(n > 0 ? '0 -6 100 126' : '0 0 100 120', body, { title: opts.title })
}
