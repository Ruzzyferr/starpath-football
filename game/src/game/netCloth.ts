/**
 * Goal net cloth (GAP 2.2#66): a 12×8 verlet grid over the back panel of the
 * net (12 nodes across the goal width, 8 up to the back-top bar). Each node
 * carries an outward displacement (m); the frame edges are pinned. A shot
 * that hits the net pushes the nodes around the impact (largest deformation
 * there), neighbours pull each other back (spring relaxation) and velocity
 * damping lets the wave die out in ≈ 700 ms. Fixed 60 Hz steps, so the look
 * does not depend on the frame rate. Pure TS, unit tested; the Low quality
 * profile keeps the cheaper analytic ripple.
 */

export const NET_COLS = 12
export const NET_ROWS = 8
const STEP = 1 / 60
/** Neighbour stiffness (per step², 0..0.5 for stability). */
const STIFF = 0.04
/** Velocity kept per step. */
const DAMP = 0.9
/** Settle time target (s). */
export const NET_SETTLE = 0.7

export interface NetCloth {
  /** Goal-mouth span the grid covers (pitch y) and back-panel height (m). */
  y0: number
  y1: number
  h: number
  d: Float32Array
  prev: Float32Array
  acc: number
  t: number
  peak: number
}

const idx = (i: number, j: number) => j * NET_COLS + i

export function createCloth(y0: number, y1: number, h: number): NetCloth {
  return { y0, y1, h, d: new Float32Array(NET_COLS * NET_ROWS), prev: new Float32Array(NET_COLS * NET_ROWS), acc: 0, t: 0, peak: 0 }
}

/** Ball hits the net at (y, z) with `strength` (m of outward push at the impact node). */
export function hitCloth(c: NetCloth, y: number, z: number, strength: number): void {
  const fi = ((y - c.y0) / (c.y1 - c.y0)) * (NET_COLS - 1)
  const fj = (z / c.h) * (NET_ROWS - 1)
  for (let j = 1; j < NET_ROWS - 1; j++) {
    for (let i = 1; i < NET_COLS - 1; i++) {
      const r2 = (i - fi) ** 2 + (j - fj) ** 2
      const push = strength * Math.exp(-r2 / 1.6)
      const k = idx(i, j)
      c.d[k] += push * 0.8
      // Give the nodes outward velocity too (verlet: move prev back).
      c.prev[k] = c.d[k] - push * 0.4
    }
  }
  c.t = 0
  c.peak = Math.max(c.peak, strength)
}

/** Advances the cloth by `dt` seconds in fixed steps. */
export function stepCloth(c: NetCloth, dt: number): void {
  c.acc += Math.min(Math.max(dt, 0), 0.25)
  c.t += Math.min(Math.max(dt, 0), 0.25)
  const n = c.d.length
  const next = new Float32Array(n)
  while (c.acc >= STEP) {
    c.acc -= STEP
    for (let j = 0; j < NET_ROWS; j++) {
      for (let i = 0; i < NET_COLS; i++) {
        const k = idx(i, j)
        if (i === 0 || j === 0 || i === NET_COLS - 1 || j === NET_ROWS - 1) {
          next[k] = 0
          continue
        }
        const lap = c.d[idx(i - 1, j)] + c.d[idx(i + 1, j)] + c.d[idx(i, j - 1)] + c.d[idx(i, j + 1)] - 4 * c.d[k]
        // Verlet: x' = x + (x − x_prev)·damp + a·dt² (stiffness folded into STIFF), plus a pull back to rest.
        next[k] = c.d[k] + (c.d[k] - c.prev[k]) * DAMP + STIFF * lap - 0.05 * c.d[k]
      }
    }
    c.prev.set(c.d)
    c.d.set(next)
  }
}

/** Largest |displacement| on the grid (m). */
export function clothEnergy(c: NetCloth): number {
  let m = 0
  for (let k = 0; k < c.d.length; k++) m = Math.max(m, Math.abs(c.d[k]))
  return m
}

/** Settled: past the settle time and below 6 % of the hit (or 1.5 cm). */
export const clothSettled = (c: NetCloth): boolean => c.t > NET_SETTLE && clothEnergy(c) < Math.max(0.015, c.peak * 0.06)

/** Bilinear displacement at (y, z) on the back panel (m). */
export function clothAt(c: NetCloth, y: number, z: number): number {
  const fi = Math.min(NET_COLS - 1, Math.max(0, ((y - c.y0) / (c.y1 - c.y0)) * (NET_COLS - 1)))
  const fj = Math.min(NET_ROWS - 1, Math.max(0, (z / c.h) * (NET_ROWS - 1)))
  const i0 = Math.min(NET_COLS - 2, Math.floor(fi))
  const j0 = Math.min(NET_ROWS - 2, Math.floor(fj))
  const u = fi - i0
  const v = fj - j0
  const a = c.d[idx(i0, j0)] * (1 - u) + c.d[idx(i0 + 1, j0)] * u
  const b = c.d[idx(i0, j0 + 1)] * (1 - u) + c.d[idx(i0 + 1, j0 + 1)] * u
  return a * (1 - v) + b * v
}
