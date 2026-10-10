/** Intent-respecting aim primitives (kick.ts): corner magnet, frame-safe folds, PASS button target, mis-hit curve. */
import { describe, expect, it } from 'vitest'
import { buttonPassTarget, foldHeight, foldLateral, heroMisHit, intentShotTarget } from './kick'
import { GOAL_CENTER_Y, POST_Y_HIGH } from './physics'
import { PITCH_LENGTH, GOAL_HEIGHT } from '../sim/match/types'

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

describe('frame-safe folds', () => {
  const from = { x: PITCH_LENGTH - 14, y: GOAL_CENTER_Y }
  const target = line(POST_Y_HIGH - 0.5)
  it('an error that would carry an on-target aim wide is folded back inside when kept', () => {
    const err = 0.12
    const folded = foldLateral(err, from, target, () => true)
    const yAt = (e: number) => target.y + (Math.tan(e) * 14 * 14) / 14
    expect(yAt(err)).toBeGreaterThan(POST_Y_HIGH)
    expect(yAt(folded)).toBeLessThan(POST_Y_HIGH)
    expect(foldLateral(err, from, target, () => false)).toBe(err)
  })
  it('over-the-bar errors fold under the bar', () => {
    const h = foldHeight(4, 1.6, 0.5, () => true)
    expect(1.6 + h * 0.5).toBeLessThan(GOAL_HEIGHT)
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

describe('hero mis-hit curve', () => {
  it('falls smoothly and strictly with skill, rises with pressure', () => {
    let prev = Infinity
    for (let s = 0.3; s <= 1.0001; s += 0.05) {
      const m = heroMisHit(s)
      expect(m).toBeLessThan(prev)
      prev = m
    }
    expect(heroMisHit(0.6, 1)).toBeGreaterThan(heroMisHit(0.6, 0))
  })
})
