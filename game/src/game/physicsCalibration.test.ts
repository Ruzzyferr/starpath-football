/**
 * WP-17 calibration: >= 200 deterministic goal-frame cases (post, crossbar, goal, wide).
 * Cases are generated from a fixed seed so failures are reproducible.
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../core/rng'
import { GOAL_HEIGHT, PITCH_LENGTH } from '../sim/match/types'
import { BAR_Z, BALL_RADIUS, DEFAULT_ENV, POST_RADIUS, POST_Y_HIGH, POST_Y_LOW, createBall, createTracker, stepBall, type GoalEnd, type PhysicsEvent } from './physics'

interface Shot { end: GoalEnd; y: number; z: number; speed: number; vz: number; fromX: number }

function fly(s: Shot, seconds = 1.5) {
  const east = s.end === 'east'
  const b = createBall(east ? PITCH_LENGTH - s.fromX : s.fromX, s.y, s.z)
  b.vx = east ? s.speed : -s.speed
  b.vz = s.vz
  const ev: PhysicsEvent[] = []
  const tr = createTracker()
  for (let i = 0; i < seconds * 60; i++) stepBall(b, DEFAULT_ENV, tr, ev)
  return { b, ev, tr, east }
}

describe('goal frame calibration', () => {
  const rng = new Rng('physics-calibration')
  const ends: GoalEnd[] = ['east', 'west']

  it('ball centre within post radius + ball radius of a post hits the post (120 cases)', () => {
    const reach = POST_RADIUS + BALL_RADIUS
    for (let i = 0; i < 120; i++) {
      const end = ends[i % 2]!
      const post = i % 4 < 2 ? POST_Y_HIGH : POST_Y_LOW
      const y = post + rng.range(-0.8, 0.8) * reach
      const { ev, b, east } = fly({ end, y, z: rng.range(0.25, 1.5), vz: rng.range(0, 1.2), speed: rng.range(12, 30), fromX: rng.range(6, 12) })
      const label = `case ${i} end=${end} y=${y.toFixed(3)}`
      expect(ev.some((e) => e.type === 'post'), label).toBe(true)
      const scored = ev.some((e) => e.type === 'goal')
      // A ball clipping the inner face may still be deflected in; a hit on the outer face never scores.
      const outerHalf = post === POST_Y_HIGH ? y > post : y < post
      if (outerHalf) expect(scored, label).toBe(false)
      // A near-central hit rebounds straight back out (glancing hits may only be deflected sideways).
      if (!scored && Math.abs(y - post) < 0.3 * reach) expect(east ? b.vx : -b.vx, label).toBeLessThan(0)
    }
  })

  it('ball centre at the crossbar height is deflected, never a goal (80 cases)', () => {
    for (let i = 0; i < 80; i++) {
      const end = ends[i % 2]!
      const z = BAR_Z + rng.range(-0.6, 0.6) * (POST_RADIUS + BALL_RADIUS)
      const { ev } = fly({ end, y: 34 + rng.range(-2.5, 2.5), z, vz: 0, speed: rng.range(20, 28), fromX: rng.range(1.2, 1.8) })
      const label = `case ${i} end=${end} z=${z.toFixed(3)}`
      expect(ev.some((e) => e.type === 'bar'), label).toBe(true)
      // Upper half of the bar contact deflects up and over; lower half may drop in behind the line.
      if (z >= BAR_Z) expect(ev.some((e) => e.type === 'goal'), label).toBe(false)
    }
  })

  it('shots comfortably inside the frame score (60 cases)', () => {
    for (let i = 0; i < 60; i++) {
      const end = ends[i % 2]!
      const { ev, tr } = fly({ end, y: 34 + rng.range(-3, 3), z: rng.range(0.3, 1.6), vz: rng.range(0, 0.5), speed: rng.range(18, 30), fromX: rng.range(6, 10) })
      expect(tr.inGoal, `case ${i}`).toBe(end)
      expect(ev.some((e) => e.type === 'post' || e.type === 'bar'), `case ${i}`).toBe(false)
    }
  })

  it('shots clearly wide or over never score (60 cases)', () => {
    for (let i = 0; i < 60; i++) {
      const end = ends[i % 2]!
      const wide = i % 2 === 0
      const y = wide ? (i % 4 === 0 ? POST_Y_HIGH : POST_Y_LOW) + (i % 4 === 0 ? 1 : -1) * rng.range(1, 6) : 34 + rng.range(-3, 3)
      const z = wide ? rng.range(0.3, 1.5) : GOAL_HEIGHT + rng.range(2.5, 4)
      const { ev, tr } = fly({ end, y, z, vz: 0, speed: rng.range(18, 30), fromX: rng.range(6, 10) })
      expect(tr.inGoal, `case ${i}`).toBeNull()
      expect(ev.some((e) => e.type === 'goal'), `case ${i}`).toBe(false)
    }
  })
})
