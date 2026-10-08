/** Collapse runs of consecutive items with an identical key into one row with a count. */
export interface Collapsed<T> { item: T; count: number }

export function collapseRepeats<T>(list: readonly T[], keyOf: (x: T) => string): Collapsed<T>[] {
  const out: Collapsed<T>[] = []
  let lastKey: string | null = null
  for (const item of list) {
    const k = keyOf(item)
    const last = out[out.length - 1]
    if (last && k === lastKey) last.count++
    else out.push({ item, count: 1 })
    lastKey = k
  }
  return out
}
