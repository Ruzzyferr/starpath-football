/**
 * Runtime polyfills for older Android System WebViews (the bundle's syntax floor is Chrome 80, see
 * vite.config.ts `build.target`). Imported first by main.tsx, so it runs before any other module
 * body. Each one only installs when the engine lacks it; modern engines are untouched.
 *
 *   structuredClone        Chrome 98   (match engine snapshots, selection, VIP costs)
 *   Array.prototype.at     Chrome 92
 *   Object.hasOwn          Chrome 93
 */

/** Deep copy of plain data (objects, arrays, Map, Set, Date, RegExp, typed arrays), cycles kept. */
export function cloneData<T>(value: T, seen = new Map<unknown, unknown>()): T {
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return seen.get(value) as T
  const v = value as unknown
  if (v instanceof Date) return new Date(v.getTime()) as T
  if (v instanceof RegExp) return new RegExp(v.source, v.flags) as T
  if (ArrayBuffer.isView(v)) {
    const ta = v as unknown as { slice: () => unknown }
    return ta.slice() as T
  }
  if (v instanceof ArrayBuffer) return v.slice(0) as T
  if (v instanceof Map) {
    const out = new Map()
    seen.set(v, out)
    v.forEach((val, key) => out.set(cloneData(key, seen), cloneData(val, seen)))
    return out as T
  }
  if (v instanceof Set) {
    const out = new Set()
    seen.set(v, out)
    v.forEach((val) => out.add(cloneData(val, seen)))
    return out as T
  }
  if (Array.isArray(v)) {
    const out: unknown[] = new Array(v.length)
    seen.set(v, out)
    for (let i = 0; i < v.length; i++) out[i] = cloneData(v[i], seen)
    return out as T
  }
  const out: Record<string, unknown> = {}
  seen.set(v, out)
  for (const k of Object.keys(v as object)) {
    const item = (v as Record<string, unknown>)[k]
    if (typeof item === 'function') continue // structuredClone would throw; data never holds functions
    out[k] = cloneData(item, seen)
  }
  return out as T
}

/** Installs the missing APIs on `g` (globalThis by default). Returns the names it installed. */
export function installPolyfills(g: typeof globalThis = globalThis): string[] {
  const added: string[] = []
  const anyG = g as unknown as Record<string, unknown>
  if (typeof anyG.structuredClone !== 'function') {
    anyG.structuredClone = (v: unknown) => cloneData(v)
    added.push('structuredClone')
  }
  const arrayProto = (anyG.Array as ArrayConstructor | undefined)?.prototype as unknown as Record<string, unknown> | undefined
  if (arrayProto && typeof arrayProto.at !== 'function') {
    Object.defineProperty(arrayProto, 'at', {
      configurable: true,
      writable: true,
      value: function at(this: unknown[], i: number) {
        const n = Math.trunc(i) || 0
        const k = n < 0 ? this.length + n : n
        return k < 0 || k >= this.length ? undefined : this[k]
      },
    })
    added.push('Array.prototype.at')
  }
  const obj = anyG.Object as unknown as Record<string, unknown> | undefined
  if (obj && typeof obj.hasOwn !== 'function') {
    Object.defineProperty(obj, 'hasOwn', {
      configurable: true,
      writable: true,
      value: (o: object, k: PropertyKey) => Object.prototype.hasOwnProperty.call(o, k),
    })
    added.push('Object.hasOwn')
  }
  return added
}

installPolyfills()
