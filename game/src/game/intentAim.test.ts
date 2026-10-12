/** Intent-respecting aim primitives (kick.ts): corner magnet, frame-safe folds, PASS button target, mis-hit curve. */
import { describe, expect, it } from 'vitest'
import { Rng } from '../core/rng'
import type { Attributes } from '../core/types'
import { buttonPassTarget, headingNoise, intentShotTarget, planKick, type KickRequest } from './kick'
import { DEFAULT_ENV, GOAL_CENTER_Y, POST_Y_HIGH } from './physics'
import { PITCH_LENGTH } from '../sim/match/types'

const line = (y: number) => ({ x: PITCH_LENGTH, y })

describe('intentShotTarget (corner magnet)', () => {
  it('a swipe at the post or just past it finishes inside the corner', () => {
    for (const off of [0, 0.5, 1.5]) {
      const t = intentShotTarget(line(POST_Y_HIGH + off), 'half')
      expect(t.y).toBeLessThan(POST_Y_HIGH)
      expect(t.y).toBeGreaterThan(POST_Y_HIGH - 0.6)
    }
  })
  it('leaves central aims (at the keeper) alone and a clearly wide swipe wide', () => {
    expect(intentShotTarget(line(GOAL_CENTER_Y + 0.8), 'half').y).toBe(GOAL_CENTER_Y + 0.8)
    expect(intentShotTarget(line(POST_Y_HIGH + 6), 'half').y).toBe(POST_Y_HIGH + 6)
  })
  it('manual assist is raw', () => {
    expect(intentShotTarget(line(POST_Y_HIGH + 0.5), 'manual').y).toBe(POST_Y_HIGH + 0.5)
  })
  it('is monotonic (no aim ever lands further from the centre than a wider aim)', () => {
    let prev = -Infinity
    for (let y = GOAL_CENTER_Y; y < POST_Y_HIGH + 8; y += 0.05) {
      const t = intentShotTarget(line(y), 'half').y
      expect(t).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = t
    }
  })
})

describe('a kick: only the direction is chance (owner, build 9)', () => {
  const attrs = { shooting: 62, finishing: 62, composure: 62, curve: 62, passing: 62, strength: 60 } as unknown as Attributes
  const req = (d: number): KickRequest => ({ kind: 'shot', from: { x: PITCH_LENGTH - d, y: GOAL_CENTER_Y }, target: { x: PITCH_LENGTH, y: POST_Y_HIGH - 0.8 }, power: 0.85, curl: 0.3, attrs, pressure: 0, assist: 'half', env: DEFAULT_ENV })
  it('pace and spin are the same with and without execution noise: the ball is only turned', () => {
    const clean = planKick(req(20))
    for (let s = 1; s <= 30; s++) {
      const p = planKick(req(20), new Rng(`k${s}`))
      expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(Math.hypot(clean.vx, clean.vy), 9)
      expect(p.spin.side).toBeCloseTo(clean.spin.side, 9)
    }
  })
  it('the direction spread grows with the distance (same kicker)', () => {
    expect(headingNoise(req(35), 0.6)).toBeGreaterThan(headingNoise(req(20), 0.6))
    expect(headingNoise(req(50), 0.6)).toBeGreaterThan(headingNoise(req(35), 0.6))
  })
})

describe('PASS button target', () => {
  const from = { x: 50, y: 34 }
  const mates = [
    { id: 'fwd', pos: { x: 62, y: 34 }, vel: { x: 0, y: 0 } },
    { id: 'side', pos: { x: 52, y: 48 }, vel: { x: 0, y: 0 } },
  ]
  it('stick upfield at a marked forward: the free man off the stick, never a ball into space', () => {
    const marker = { x: 58, y: 34 }
    expect(buttonPassTarget(from, { x: 1, y: 0 }, mates, [marker], 'half')?.id).toBe('side')
  })
  it('stick at an open man: him', () => {
    expect(buttonPassTarget(from, { x: 1, y: 0 }, mates, [], 'half')?.id).toBe('fwd')
    expect(buttonPassTarget(from, { x: 0.15, y: 1 }, mates, [], 'half')?.id).toBe('side')
  })
})
