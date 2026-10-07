/** Small helpers shared by the procedural SVG generators. Pure, no DOM. */
import { hashString } from '../../core/rng'

export { hashString }

/** Short stable id fragment for <defs> ids (same input → same id). */
export function uid(...parts: (string | number)[]): string {
  return 'p' + hashString(parts.join('|')).toString(36)
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [128, 128, 128]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** amt > 0 lightens towards white, < 0 darkens towards black. */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = parseHex(hex)
  if (amt >= 0) return toHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt)
  const k = 1 + amt
  return toHex(r * k, g * k, b * k)
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a)
  const [r2, g2, b2] = parseHex(b)
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Black or white, whichever reads better on `bg`. */
export function onColor(bg: string, dark = '#0b1220', light = '#ffffff'): string {
  return contrastRatio(bg, dark) >= contrastRatio(bg, light) ? dark : light
}

/** Pick from `candidates` the colour with best contrast against bg. */
export function bestContrast(bg: string, candidates: string[]): string {
  let best = candidates[0]
  let bestC = 0
  for (const c of candidates) {
    const cr = contrastRatio(bg, c)
    if (cr > bestC) {
      bestC = cr
      best = c
    }
  }
  return best
}

/** Regular polygon / star points as an SVG points string. */
export function starPoints(cx: number, cy: number, outer: number, inner: number, n: number, rot = -Math.PI / 2): string {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = rot + (i * Math.PI) / n
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

export function polyPoints(cx: number, cy: number, r: number, n: number, rot = -Math.PI / 2): string {
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const a = rot + (i * 2 * Math.PI) / n
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

export function svgWrap(viewBox: string, body: string, opts: { title?: string; className?: string } = {}): string {
  const title = opts.title ? `<title>${esc(opts.title)}</title>` : ''
  const role = opts.title ? 'role="img"' : 'aria-hidden="true"'
  const cls = opts.className ? ` class="${opts.className}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${cls} ${role} focusable="false">${title}${body}</svg>`
}

/**
 * The generators emit deterministic <defs> ids (same input → same id). Two
 * identical SVGs on one page then share ids, and when the first copy sits in a
 * hidden subtree (display:none sidebar on mobile) every later `url(#id)` paints
 * nothing — the avatar face turns black. Suffix the ids per mounted instance.
 */
export function scopeSvgIds(html: string, suffix: string): string {
  const ids = new Set<string>()
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1])
  if (!ids.size) return html
  return html.replace(/(?<=\s)id="([^"]+)"|#([A-Za-z][\w-]*)/g, (all, def: string | undefined, ref: string | undefined) => {
    if (def) return ids.has(def) ? `id="${def}-${suffix}"` : all
    return ref && ids.has(ref) ? `#${ref}-${suffix}` : all
  })
}
