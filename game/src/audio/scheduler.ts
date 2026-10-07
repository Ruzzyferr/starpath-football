/**
 * Lookahead scheduler ("A Tale of Two Clocks"): a coarse JS timer wakes every
 * ~25 ms and schedules every musical step that falls within the next
 * `lookahead` seconds on the sample-accurate AudioContext clock. The timing
 * math is pure and unit-tested; the timer/clock are injectable so the same
 * code drives OfflineAudioContext renders (pump to the end up front).
 */

/** Seconds per step (16th notes at stepsPerBeat = 4). */
export function stepDuration(bpm: number, stepsPerBeat = 4): number {
  return 60 / Math.max(1, bpm) / stepsPerBeat
}

/** Time of step `index` for a sequence anchored at `anchor`. */
export function stepTime(anchor: number, index: number, bpm: number, stepsPerBeat = 4): number {
  return anchor + index * stepDuration(bpm, stepsPerBeat)
}

/** First step index whose time is >= t. */
export function stepIndexAtOrAfter(anchor: number, t: number, bpm: number, stepsPerBeat = 4): number {
  const d = stepDuration(bpm, stepsPerBeat)
  return Math.max(0, Math.ceil((t - anchor) / d - 1e-9))
}

/** Next bar boundary strictly after `t` (or at `t` when `inclusive`). */
export function nextBarTime(anchor: number, t: number, bpm: number, beatsPerBar = 4, inclusive = false): number {
  const bar = (60 / Math.max(1, bpm)) * beatsPerBar
  if (t <= anchor) return anchor
  const n = (t - anchor) / bar
  const k = inclusive ? Math.ceil(n - 1e-9) : Math.floor(n + 1e-9) + 1
  return anchor + k * bar
}

/**
 * Swing: delays every odd 16th by `amount` (0..1) of half a step.
 * 0 = straight, 1 = full triplet-ish shuffle.
 */
export function swingOffset(index: number, bpm: number, amount: number, stepsPerBeat = 4): number {
  return index % 2 === 1 ? stepDuration(bpm, stepsPerBeat) * 0.5 * Math.max(0, Math.min(1, amount)) : 0
}

export interface StepEvent {
  index: number
  time: number
}

/**
 * A tempo-locked step sequence. `collect(until, now)` returns every step
 * from the last scheduled one up to (excluding) `until`; steps that are
 * already more than `maxLate` in the past (e.g. after the tab was throttled)
 * are skipped instead of being fired in a burst.
 */
export class Sequence {
  readonly anchor: number
  readonly bpm: number
  readonly stepsPerBeat: number
  next = 0
  skipped = 0

  constructor(anchor: number, bpm: number, stepsPerBeat = 4) {
    this.anchor = anchor
    this.bpm = bpm
    this.stepsPerBeat = stepsPerBeat
  }

  collect(until: number, now: number, maxLate = 0.05): StepEvent[] {
    const out: StepEvent[] = []
    // Jump over a backlog in one go.
    const minIdx = stepIndexAtOrAfter(this.anchor, now - maxLate, this.bpm, this.stepsPerBeat)
    if (minIdx > this.next) {
      this.skipped += minIdx - this.next
      this.next = minIdx
    }
    for (;;) {
      const t = stepTime(this.anchor, this.next, this.bpm, this.stepsPerBeat)
      if (t >= until) break
      out.push({ index: this.next, time: t })
      this.next++
      if (out.length > 4096) break // safety for absurd windows
    }
    return out
  }
}

export interface Clock {
  readonly currentTime: number
}

export interface TimerApi {
  setInterval(fn: () => void, ms: number): unknown
  clearInterval(id: unknown): void
}

const defaultTimers: TimerApi = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (id) => globalThis.clearInterval(id as ReturnType<typeof setInterval>),
}

export type PumpFn = (until: number, now: number) => void

/** One shared timer that pumps every registered client. */
export class LookaheadScheduler {
  readonly lookahead: number
  readonly intervalMs: number
  private clients = new Set<PumpFn>()
  private timer: unknown = null
  private readonly clock: Clock
  private readonly timers: TimerApi

  constructor(clock: Clock, opts: { lookahead?: number; intervalMs?: number; timers?: TimerApi } = {}) {
    this.clock = clock
    this.lookahead = opts.lookahead ?? 0.15
    this.intervalMs = opts.intervalMs ?? 25
    this.timers = opts.timers ?? defaultTimers
  }

  add(fn: PumpFn): () => void {
    this.clients.add(fn)
    if (this.running) fn(this.clock.currentTime + this.lookahead, this.clock.currentTime)
    return () => this.clients.delete(fn)
  }

  get size(): number {
    return this.clients.size
  }

  get running(): boolean {
    return this.timer !== null
  }

  start(): void {
    if (this.timer !== null) return
    this.timer = this.timers.setInterval(() => this.tick(), this.intervalMs)
    this.tick()
  }

  stop(): void {
    if (this.timer === null) return
    this.timers.clearInterval(this.timer)
    this.timer = null
  }

  tick(): void {
    const now = this.clock.currentTime
    this.pump(now + this.lookahead, now)
  }

  /** Schedules everything up to `until` (offline renders call this once). */
  pump(until: number, now = this.clock.currentTime): void {
    for (const fn of [...this.clients]) {
      try {
        fn(until, now)
      } catch (e) {
        if (import.meta.env?.DEV) console.warn('[audio] scheduler client failed', e)
      }
    }
  }
}
