import { formatDelta } from '../../format'
import { statLabel } from '../../components'
import type { Delta } from '../../store'

/** "+3 Şut, −12 Enerji" for toasts. */
export function deltaText(deltas: Delta[], max = 4): string {
  return deltas
    .slice(0, max)
    .map((d) => `${formatDelta(d.key, d.value)} ${statLabel(d.key, d.label)}`)
    .join(', ')
}

/** Screen tab param helper with whitelist. */
export function pickTab<K extends string>(param: unknown, allowed: readonly K[], fallback: K): K {
  return typeof param === 'string' && (allowed as readonly string[]).includes(param) ? (param as K) : fallback
}
