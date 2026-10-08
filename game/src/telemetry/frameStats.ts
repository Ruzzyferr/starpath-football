/**
 * Frame-rate monitoring (2.12#117): a rolling window of frame times whose 5th-percentile FPS
 * ("p5 FPS", the number players actually feel as stutter) shows up in the opt-in error report.
 * Sampling only runs while the player opted in AND a game canvas is on screen, so menus and
 * non-participants pay nothing. Nothing leaves the device.
 */
export class FrameStats {
  private readonly buf: number[] = []
  private readonly cap: number
  constructor(cap = 600) {
    this.cap = cap
  }

  push(dtMs: number): void {
    // Ignore the gap after a tab was hidden / a breakpoint: it is not a rendering stall.
    if (!(dtMs > 0) || dtMs > 1000) return
    this.buf.push(dtMs)
    if (this.buf.length > this.cap) this.buf.shift()
  }

  get samples(): number {
    return this.buf.length
  }

  clear(): void {
    this.buf.length = 0
  }

  summary(): { samples: number; avgFps: number; p5Fps: number; worstMs: number } | null {
    if (this.buf.length < 30) return null
    const sorted = [...this.buf].sort((a, b) => a - b)
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!
    return { samples: sorted.length, avgFps: 1000 / avg, p5Fps: 1000 / p95, worstMs: sorted[sorted.length - 1]! }
  }
}

export const frameStats = new FrameStats()

export function frameSummaryLine(): string {
  const s = frameStats.summary()
  return s ? `perf: avg ${s.avgFps.toFixed(0)} fps, p5 ${s.p5Fps.toFixed(0)} fps, worst frame ${s.worstMs.toFixed(0)} ms (${s.samples} frames)` : 'perf: no match frames sampled'
}

let started = false
/** Starts the idle-cheap sampler. `enabled` is the opt-in check (injected to keep this module dependency-free). */
export function installFrameMonitor(enabled: () => boolean): void {
  if (started || typeof window === 'undefined' || typeof requestAnimationFrame !== 'function') return
  started = true
  let raf = 0
  let last = 0
  const tick = (now: number) => {
    if (last) frameStats.push(now - last)
    last = now
    raf = requestAnimationFrame(tick)
  }
  const stop = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    last = 0
  }
  setInterval(() => {
    const want = enabled() && document.visibilityState === 'visible' && !!document.querySelector('canvas')
    if (want && !raf) raf = requestAnimationFrame(tick)
    else if (!want && raf) stop()
  }, 2000)
}
