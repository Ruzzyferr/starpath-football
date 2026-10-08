/**
 * Collision-aware layout for the pre-match lineup pitch.
 *
 * Works in a nominal pitch of NOM_W x NOM_H css px (the smallest the pitch is
 * ever rendered at: phone width; larger screens only add room). Each player is
 * a "box": the shirt disc plus its name label underneath. Rows are spaced so
 * boxes never overlap vertically, labels inside a row are narrowed (CSS
 * ellipsis, full name stays in title/aria) and, if still tight, pushed apart.
 */
export const NOM_W = 340
export const NOM_H = 500
export const BOX_H = 46
const DISC_W = 30
const MIN_LABEL = 38
const HERO_LABEL = 46
const MAX_LABEL = 64
const PAD = 3
const ROW_TOL = 0.07
const MAX_ROWS = 5

export interface LayoutIn { id: string; label: string; x: number; y: number; isHero?: boolean }
export interface LayoutOut { id: string; topPct: number; leftPct: number; labelPx: number; boxW: number }

const natural = (l: string, hero?: boolean): number =>
  Math.min(MAX_LABEL, Math.max(DISC_W, Math.ceil(l.length * 6.6) + (hero ? 14 : 2)))

/** Lay out one team. `side` home = bottom half (own goal bottom), away = top half mirrored. */
export function layoutTeam(players: readonly LayoutIn[], side: 'home' | 'away'): LayoutOut[] {
  const sorted = [...players].sort((a, b) => a.x - b.x)
  // 1. cluster into rows by x
  const rows: LayoutIn[][] = []
  let start = -9
  for (const p of sorted) {
    if (rows.length === 0 || p.x - start > ROW_TOL) { rows.push([p]); start = p.x } else rows[rows.length - 1]!.push(p)
  }
  // 1b. never more rows than the half can hold: merge the closest pair (GK row is kept apart)
  const rowMean = (r: LayoutIn[]) => r.reduce((a, p) => a + p.x, 0) / r.length
  while (rows.length > MAX_ROWS) {
    let bi = -1
    let best = Infinity
    for (let i = 1; i < rows.length; i++) {
      if (i === 1 && rows[0]!.length === 1) continue // keep the goalkeeper alone
      const gap = rowMean(rows[i]!) - rowMean(rows[i - 1]!) + (rows[i]!.length + rows[i - 1]!.length > 5 ? 9 : 0)
      if (gap < best) { best = gap; bi = i }
    }
    rows.splice(bi - 1, 2, [...rows[bi - 1]!, ...rows[bi]!])
  }
  // 2. row depth (0 = own goal end, 1 = front) keeping proportions but enforcing a min gap
  const SPAN = 40 // % of pitch height available per half (45..5 / 55..95)
  const minGap = ((BOX_H + 2) / NOM_H) * 100
  const mean = rows.map((r) => r.reduce((s, p) => s + p.x, 0) / r.length)
  const top0 = mean[0]!
  const range = Math.max(0.01, mean[mean.length - 1]! - top0)
  const pos: number[] = [0]
  for (let i = 1; i < rows.length; i++) {
    const prop = ((mean[i]! - mean[i - 1]!) / range) * SPAN
    pos.push(pos[i - 1]! + Math.max(minGap, prop))
  }
  // when the proportional layout does not fit, fall back to evenly spaced rows
  if (pos[pos.length - 1]! > SPAN) for (let i = 0; i < pos.length; i++) pos[i] = (i / Math.max(1, pos.length - 1)) * SPAN
  const scale = 1
  const out: LayoutOut[] = []
  rows.forEach((row, ri) => {
    const d = pos[ri]! * scale
    const topPct = side === 'home' ? 95 - d : 5 + d
    // 3. horizontal: centres in px
    const items = [...row].sort((a, b) => a.y - b.y).map((p) => ({
      p,
      c: (side === 'home' ? 0.08 + p.y * 0.84 : 0.92 - p.y * 0.84) * NOM_W,
      w: natural(p.label, p.isHero),
    }))
    items.sort((a, b) => a.c - b.c)
    // shrink labels to the room between neighbours
    for (let i = 0; i < items.length; i++) {
      const left = i > 0 ? items[i]!.c - items[i - 1]!.c : Infinity
      const right = i < items.length - 1 ? items[i + 1]!.c - items[i]!.c : Infinity
      const room = Math.min(left, right) - PAD
      items[i]!.w = Math.max(items[i]!.p.isHero ? HERO_LABEL : MIN_LABEL, Math.min(items[i]!.w, room))
    }
    // push apart (forward then backward sweeps), keep inside the pitch
    const need = (a: { w: number }, b: { w: number }) => (a.w + b.w) / 2 + PAD
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < items.length; i++) items[i]!.c = Math.max(items[i]!.w / 2 + 2, Math.min(NOM_W - items[i]!.w / 2 - 2, items[i]!.c))
      for (let i = 1; i < items.length; i++) items[i]!.c = Math.max(items[i]!.c, items[i - 1]!.c + need(items[i - 1]!, items[i]!))
      for (let i = items.length - 2; i >= 0; i--) items[i]!.c = Math.min(items[i]!.c, items[i + 1]!.c - need(items[i]!, items[i + 1]!))
    }
    for (const it of items) out.push({ id: it.p.id, topPct, leftPct: (it.c / NOM_W) * 100, labelPx: Math.round(it.w), boxW: Math.max(DISC_W, it.w) })
  })
  return out
}
