import { useEffect, useRef, useState } from 'preact/hooks'
import { settings } from '../store'

export function prefersReducedMotion(): boolean {
  if (settings.value.reducedMotion) return true
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  } catch {
    return false
  }
}

/** True when screen flashes must be suppressed (photosensitivity). Game scenes should honour this too. */
export function flashesReduced(): boolean {
  return settings.value.reduceFlashes || prefersReducedMotion()
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Animated number that counts from its previous value to `target`.
 * Returns [display value, direction of last change].
 */
export function useCountUp(target: number, duration = 650): [number, -1 | 0 | 1] {
  const [value, setValue] = useState(target)
  const [dir, setDir] = useState<-1 | 0 | 1>(0)
  const from = useRef(target)
  const raf = useRef(0)
  useEffect(() => {
    const start = from.current
    if (start === target) return
    setDir(target > start ? 1 : -1)
    if (prefersReducedMotion() || typeof requestAnimationFrame === 'undefined') {
      from.current = target
      setValue(target)
      return
    }
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const v = start + (target - start) * easeOut(p)
      setValue(v)
      from.current = v
      if (p < 1) raf.current = requestAnimationFrame(step)
      else from.current = target
    }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return [value, dir]
}

/** True after first paint — use to trigger CSS transitions from 0. */
export function useMounted(delay = 30): boolean {
  const [m, setM] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setM(true), delay)
    return () => clearTimeout(id)
  }, [delay])
  return m
}

export function useMediaQuery(q: string): boolean {
  const get = () => {
    try {
      return globalThis.matchMedia?.(q).matches ?? false
    } catch {
      return false
    }
  }
  const [m, setM] = useState(get)
  useEffect(() => {
    const mq = globalThis.matchMedia?.(q)
    if (!mq) return
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

export const useIsWide = () => useMediaQuery('(min-width: 900px)')
