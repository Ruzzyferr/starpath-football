/** Procedural football shirt from KitColors (viewBox 0 0 100 100). */
import type { KitColors } from '../../core/types'
import { onColor, shade, svgWrap, uid } from './svg'

const SHIRT =
  'M34 8L22 12L4 26L12 44L22 38L22 94Q50 98 78 94L78 38L88 44L96 26L78 12L66 8Q60 16 50 16Q40 16 34 8Z'

function pattern(p: KitColors['pattern'], c: string): string {
  switch (p) {
    case 'stripes':
      return [26, 42, 58, 74].map((x) => `<rect x="${x - 4}" y="0" width="8" height="100" fill="${c}"/>`).join('')
    case 'hoops':
      return [30, 50, 70, 90].map((y) => `<rect x="0" y="${y - 5}" width="100" height="10" fill="${c}"/>`).join('')
    case 'halves':
      return `<rect x="50" y="0" width="50" height="100" fill="${c}"/>`
    case 'sash':
      return `<path d="M78 8L94 8L30 100L14 100Z" fill="${c}"/>`
    case 'chevron':
      return `<path d="M0 30L50 58L100 30L100 46L50 74L0 46Z" fill="${c}"/>`
    default:
      return ''
  }
}

export interface KitOpts {
  number?: number | string
  name?: string
  title?: string
}

export function kitSvg(kit: KitColors, opts: KitOpts = {}): string {
  const id = uid('kit', kit.primary, kit.secondary, kit.pattern, opts.number ?? '', opts.name ?? '')
  const trim = kit.pattern === 'plain' ? kit.secondary : shade(kit.secondary, -0.05)
  const numColor = kit.pattern === 'plain' ? onColor(kit.primary, '#0b1220', '#ffffff') : onColor(kit.primary, '#0b1220', '#ffffff')
  const num = opts.number !== undefined
    ? `<text x="50" y="${opts.name ? 74 : 66}" text-anchor="middle" font-family="Teko, Barlow Condensed, sans-serif" font-weight="600" font-size="${opts.name ? 30 : 36}" fill="${numColor}" stroke="${kit.pattern === 'plain' ? 'none' : shade(kit.primary, -0.4)}" stroke-width="${kit.pattern === 'plain' ? 0 : 1.2}" paint-order="stroke">${opts.number}</text>`
    : ''
  const name = opts.name
    ? `<text x="50" y="40" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="9" letter-spacing="1" fill="${numColor}">${opts.name.slice(0, 12).replace(/[<&>]/g, '')}</text>`
    : ''
  const body =
    `<defs><clipPath id="${id}c"><path d="${SHIRT}"/></clipPath>` +
    `<linearGradient id="${id}l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".35" stop-color="#fff" stop-opacity=".1"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient></defs>` +
    `<path d="${SHIRT}" fill="#000" opacity=".3" transform="translate(1.5 2.5)"/>` +
    `<g clip-path="url(#${id}c)"><rect width="100" height="100" fill="${kit.primary}"/>${pattern(kit.pattern, kit.secondary)}` +
    `<path d="M4 26L22 12L22 38L12 44Z M96 26L78 12L78 38L88 44Z" fill="${kit.pattern === 'plain' ? kit.secondary : 'transparent'}" opacity=".9"/>` +
    `<path d="M4 26L12 44L15 42.3L7 24.4Z M96 26L88 44L85 42.3L93 24.4Z" fill="${trim}"/>` +
    `<rect width="100" height="100" fill="url(#${id}l)"/></g>` +
    `<path d="M34 8Q40 16 50 16Q60 16 66 8L62 7Q57 12 50 12Q43 12 38 7Z" fill="${trim}"/>` +
    `<path d="${SHIRT}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="1"/>` +
    name + num
  return svgWrap('0 0 100 100', body, { title: opts.title })
}
