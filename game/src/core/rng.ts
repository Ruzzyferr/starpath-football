/**
 * Seeded, serializable PRNG (sfc32). Every simulation system takes an Rng
 * so that matches, seasons and events are reproducible from a seed and
 * save files can store the exact generator state.
 */
export interface RngState {
  a: number
  b: number
  c: number
  d: number
}

export class Rng {
  private s: RngState

  constructor(seed: number | string | RngState) {
    if (typeof seed === 'object') {
      this.s = { ...seed }
      return
    }
    const h = typeof seed === 'string' ? hashString(seed) : seed >>> 0
    this.s = { a: 0x9e3779b9, b: 0x243f6a88, c: 0xb7e15162, d: h }
    for (let i = 0; i < 15; i++) this.nextUint()
  }

  get state(): RngState {
    return { ...this.s }
  }

  /** Derive an independent child stream (e.g. one per match) without consuming much of this one. */
  fork(label: string | number = ''): Rng {
    return new Rng((this.nextUint() ^ hashString(String(label))) >>> 0)
  }

  nextUint(): number {
    const s = this.s
    s.a >>>= 0; s.b >>>= 0; s.c >>>= 0; s.d >>>= 0
    const t = (s.a + s.b) | 0
    s.a = s.b ^ (s.b >>> 9)
    s.b = (s.c + (s.c << 3)) | 0
    s.c = (s.c << 21) | (s.c >>> 11)
    s.d = (s.d + 1) | 0
    const r = (t + s.d) | 0
    s.c = (s.c + r) | 0
    return r >>> 0
  }

  /** Float in [0, 1). */
  next(): number {
    return this.nextUint() / 4294967296
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick on empty array')
    return arr[Math.floor(this.next() * arr.length)] as T
  }

  /** Pick using non-negative weights. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    let total = 0
    for (const it of items) total += Math.max(0, weight(it))
    if (total <= 0) return this.pick(items)
    let r = this.next() * total
    for (const it of items) {
      r -= Math.max(0, weight(it))
      if (r < 0) return it
    }
    return items[items.length - 1] as T
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j] as T, arr[i] as T]
    }
    return arr
  }

  /** Approximately normal (Box–Muller). */
  normal(mean = 0, sd = 1): number {
    const u = 1 - this.next()
    const v = this.next()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  /** Poisson-distributed integer (Knuth), fine for small lambda (goals, cards). */
  poisson(lambda: number): number {
    const L = Math.exp(-lambda)
    let k = 0
    let p = 1
    do {
      k++
      p *= this.next()
    } while (p > L)
    return k - 1
  }

  id(prefix = ''): string {
    return prefix + this.nextUint().toString(36) + this.nextUint().toString(36).slice(0, 4)
  }
}

export function hashString(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
