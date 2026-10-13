import { describe, expect, it } from 'vitest'
import { cloneData, installPolyfills } from './polyfills'

describe('polyfills for older Android WebViews', () => {
  it('cloneData deep-copies plain data like structuredClone', () => {
    const src = { a: [1, { b: 2 }], m: new Map([['k', { v: 1 }]]), s: new Set([1, 2]), d: new Date(5), t: new Float32Array([1, 2]), u: undefined as unknown }
    ;(src as Record<string, unknown>).self = src
    const c = cloneData(src)
    expect(c).not.toBe(src)
    expect(c.a[1]).toEqual({ b: 2 })
    expect(c.a[1]).not.toBe(src.a[1])
    expect(c.m.get('k')).toEqual({ v: 1 })
    expect(c.m.get('k')).not.toBe(src.m.get('k'))
    expect([...c.s]).toEqual([1, 2])
    expect(c.d.getTime()).toBe(5)
    expect(Array.from(c.t)).toEqual([1, 2])
    expect((c as Record<string, unknown>).self).toBe(c)
    expect('u' in c).toBe(true)
  })

  it('installs only what is missing', () => {
    const fakeArray = function () {} as unknown as ArrayConstructor
    const g = { Array: fakeArray, Object: {} } as unknown as typeof globalThis
    expect(installPolyfills(g)).toEqual(['structuredClone', 'Array.prototype.at', 'Object.hasOwn'])
    const at = (fakeArray.prototype as unknown as { at: (this: unknown[], i: number) => unknown }).at
    expect(at.call([1, 2, 3], -1)).toBe(3)
    expect(at.call([1, 2, 3], 5)).toBeUndefined()
    expect((g.Object as unknown as { hasOwn: (o: object, k: string) => boolean }).hasOwn({ x: 1 }, 'x')).toBe(true)
    // A modern engine (this one) needs nothing.
    expect(installPolyfills(globalThis)).toEqual([])
  })
})
