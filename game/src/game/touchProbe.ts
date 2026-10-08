/**
 * Dev / e2e probe for touch shooting (owner feedback: dropped swipes, flat
 * power). In dev builds every resolved touch gesture and every hero kick is
 * appended to `globalThis.__spProbe`, so the touch e2e spec can measure
 * first-swipe success and the power spread. A no-op in production builds.
 */
export interface ProbeGesture {
  /** How the gesture resolved: swipe (sent as a kick gesture), tap, joystick, button, cancel, ignored. */
  outcome: 'swipe' | 'tap' | 'joystick' | 'button' | 'cancel' | 'ignored'
  power: number
  length: number
  speed: number
  duration: number
}

export interface ProbeKick {
  power: number
  kick: string
}

interface Probe {
  gestures: ProbeGesture[]
  kicks: ProbeKick[]
}

const DEV = typeof import.meta !== 'undefined' && !!import.meta.env?.DEV

function probe(): Probe | null {
  if (!DEV) return null
  const g = globalThis as { __spProbe?: Probe }
  g.__spProbe ??= { gestures: [], kicks: [] }
  return g.__spProbe
}

const cap = <T>(a: T[], v: T) => {
  a.push(v)
  if (a.length > 400) a.splice(0, a.length - 400)
}

export function probeGesture(g: ProbeGesture): void {
  const p = probe()
  if (p) cap(p.gestures, g)
}

export function probeKick(k: ProbeKick): void {
  const p = probe()
  if (p) cap(p.kicks, k)
}
