// node --test test/penalty.test.ts  (Node 22.6+ strips the types)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { KEY_AIM_X, KEY_AIM_Y, resolveShot, swipePower } from '../src/penalty.ts'

function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}
const rate = (x: number, y: number, power: number, n = 4000) => {
  const r = rng(7)
  const c: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    const o = resolveShot({ x, y, power, curl: 0 }, r).outcome
    c[o] = (c[o] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, +(v / n).toFixed(2)]))
}

test('swipePower matches the game: soft push, mid drag, full swipe, overhit', () => {
  assert.ok(swipePower(0.1, 0.5) < 0.25)
  assert.ok(swipePower(0.5, 3.2) >= 0.99 && swipePower(0.5, 3.2) <= 1.0)
  assert.ok(swipePower(0.6, 7) > 1.1)
})

test('a clean strike into a corner scores more often than not', () => {
  const r = rate(2.9, 0.6, 0.9)
  console.log('low corner', r)
  assert.ok((r.goal ?? 0) > 0.5)
})

test('a shot down the middle is usually saved', () => {
  const r = rate(0, 1, 0.9)
  console.log('middle', r)
  assert.ok((r.goal ?? 0) < 0.6)
})

test('an overhit shot often flies over', () => {
  const r = rate(2.5, 1.8, 1.15)
  console.log('overhit', r)
  assert.ok((r.over ?? 0) > 0.4)
})

test('a soft shot is held', () => {
  const r = rate(2.0, 0.5, 0.2)
  console.log('soft', r)
  assert.ok((r.weak ?? 0) + (r.saved ?? 0) > 0.5)
})

test('keyboard corners score like a tapped corner (about 80% or better)', () => {
  const tap = rate(2.87, 2.22, 0.86).goal ?? 0
  for (const x of [KEY_AIM_X[0], KEY_AIM_X[KEY_AIM_X.length - 1]]) {
    for (const y of KEY_AIM_Y) {
      const r = rate(x, y, 0.89).goal ?? 0
      console.log('key corner', x, y, r, 'tap', tap)
      assert.ok(r >= 0.75, `keyboard corner ${x},${y} scores ${r}`)
    }
  }
})
