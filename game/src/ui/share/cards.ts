import { currentLang } from '../../i18n'

/** Locale-aware uppercase: Turkish `i` -> `İ` (a plain toUpperCase() would print "ISTANBUL" for "istanbul"). */
const upper = (s: string): string => s.toLocaleUpperCase(currentLang.value === 'tr' ? 'tr-TR' : 'en-US')
/**
 * Shareable PNG cards (GAP 2.10#40, local-first): a career card and a match
 * card drawn on a 2D canvas, then handed to the OS share sheet
 * (`navigator.share({ files })`) or downloaded. No network.
 * Colours are read from the design tokens at draw time; fonts fall back to
 * the system stack if the web fonts are not loaded.
 */
export interface CardSpec {
  kicker: string
  title: string
  subtitle: string
  /** Big gold number (legacy score, match rating...). */
  hero: { label: string; value: string }
  /** Up to four small stat tiles. */
  kpis: { label: string; value: string }[]
  footer: string
  /** Optional accent override (CSS color) e.g. club colour. */
  accent?: string
}

export const CARD_W = 1080
export const CARD_H = 1350

const tok = (name: string, fallback: string): string => {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  } catch {
    return fallback
  }
}

/** Shrink the font until the text fits `maxW`. */
function fit(ctx: CanvasRenderingContext2D, text: string, family: string, weight: string, size: number, maxW: number, min = 28): number {
  let s = size
  for (; s > min; s -= 2) {
    ctx.font = `${weight} ${s}px ${family}`
    if (ctx.measureText(text).width <= maxW) return s
  }
  ctx.font = `${weight} ${min}px ${family}`
  return min
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Draw a card onto `canvas` (resizes it to {@link CARD_W}x{@link CARD_H}). */
export function drawCard(canvas: HTMLCanvasElement, spec: CardSpec): void {
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const bg0 = tok('--bg-0', '#070b14')
  const surface2 = tok('--surface-2', '#1b2740')
  const surface1 = tok('--surface-1', '#131c2e')
  const hi = tok('--text-hi', '#f2f5fa')
  const mid = tok('--text-mid', '#b4c0d6')
  const gold = tok('--accent-gold', '#ffc83d')
  const pitch = spec.accent && /^#[0-9a-f]{6}$/i.test(spec.accent) ? spec.accent : tok('--brand-pitch', '#1fd47a')
  const border = tok('--border', '#2a3a5c')
  const display = tok('--font-display', "'Barlow Condensed', 'Arial Narrow', sans-serif")
  const body = tok('--font-body', "Inter, system-ui, sans-serif")
  const score = tok('--font-score', display)
  const M = 72

  const g = ctx.createLinearGradient(0, 0, 0, CARD_H)
  g.addColorStop(0, surface2)
  g.addColorStop(0.55, surface1)
  g.addColorStop(1, bg0)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // Stadium-light glow and pitch stripes at the bottom.
  const glow = ctx.createRadialGradient(CARD_W / 2, -80, 40, CARD_W / 2, -80, 820)
  glow.addColorStop(0, `${pitch}66`)
  glow.addColorStop(1, `${pitch}00`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, CARD_W, 900)
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0)'
    ctx.fillRect(0, CARD_H - 240 + i * 30, CARD_W, 30)
  }

  ctx.strokeStyle = border
  ctx.lineWidth = 3
  roundRect(ctx, 24, 24, CARD_W - 48, CARD_H - 48, 36)
  ctx.stroke()

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = pitch
  ctx.font = `700 34px ${body}`
  ctx.fillText(upper(spec.kicker), M, 120)
  ctx.fillStyle = pitch
  ctx.fillRect(M, 140, 96, 6)

  ctx.fillStyle = hi
  fit(ctx, spec.title, display, '800', 150, CARD_W - M * 2, 64)
  ctx.fillText(upper(spec.title), M, 320)
  ctx.fillStyle = mid
  fit(ctx, spec.subtitle, body, '500', 38, CARD_W - M * 2, 24)
  ctx.fillText(spec.subtitle, M, 384)

  // Hero value
  ctx.fillStyle = mid
  ctx.font = `700 32px ${body}`
  ctx.fillText(upper(spec.hero.label), M, 520)
  const hg = ctx.createLinearGradient(0, 540, 0, 760)
  hg.addColorStop(0, tok('--accent-gold-hi', '#ffe38a'))
  hg.addColorStop(1, gold)
  ctx.fillStyle = hg
  fit(ctx, spec.hero.value, score, '700', 280, CARD_W - M * 2, 120)
  ctx.fillText(spec.hero.value, M, 750)

  // KPI tiles (2 x 2)
  const tw = (CARD_W - M * 2 - 24) / 2
  const th = 168
  spec.kpis.slice(0, 4).forEach((k, i) => {
    const x = M + (i % 2) * (tw + 24)
    const y = 820 + Math.floor(i / 2) * (th + 24)
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    roundRect(ctx, x, y, tw, th, 28)
    ctx.fill()
    ctx.strokeStyle = border
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = mid
    ctx.font = `600 28px ${body}`
    ctx.fillText(upper(k.label), x + 32, y + 58)
    ctx.fillStyle = hi
    fit(ctx, k.value, score, '700', 96, tw - 64, 44)
    ctx.fillText(k.value, x + 32, y + 138)
  })

  ctx.fillStyle = mid
  ctx.font = `500 30px ${body}`
  ctx.fillText(spec.footer, M, CARD_H - 76)
  ctx.textAlign = 'right'
  ctx.fillStyle = gold
  ctx.font = `800 34px ${display}`
  ctx.fillText('STARPATH FOOTBALL', CARD_W - M, CARD_H - 76)
  ctx.textAlign = 'left'
}

export function renderCard(spec: CardSpec): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  drawCard(canvas, spec)
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/png')
    } catch {
      resolve(null)
    }
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export type ShareOutcome = 'shared' | 'downloaded' | 'failed'

/** Open the OS share sheet with the PNG when supported; otherwise download it. */
export async function shareCard(spec: CardSpec, filename: string, text: string): Promise<ShareOutcome> {
  const blob = await renderCard(spec)
  if (!blob) return 'failed'
  try {
    const file = new File([blob], filename, { type: 'image/png' })
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], text, title: spec.title })
      return 'shared'
    }
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return 'shared' // user closed the sheet
  }
  downloadBlob(blob, filename)
  return 'downloaded'
}

export function downloadText(text: string, filename: string, mime = 'text/csv;charset=utf-8'): void {
  downloadBlob(new Blob(['\uFEFF', text], { type: mime }), filename)
}
