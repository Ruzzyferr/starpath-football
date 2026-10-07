import { describe, expect, it } from 'vitest'
import { GOAL_HEIGHT, PITCH_LENGTH } from '../sim/match/types'
import {
  BALL_RADIUS,
  DEFAULT_ENV,
  GOAL_CENTER_Y,
  POST_Y_HIGH,
  createBall,
  createTracker,
  envForWeather,
  isOnTarget,
  predictPlaneCrossing,
  predictTrajectory,
  stepBall,
  type BallState,
  type PhysicsEnv,
  type PhysicsEvent,
} from './physics'

function run(b: BallState, env: PhysicsEnv = DEFAULT_ENV, seconds = 5) {
  const tr = createTracker()
  const ev: PhysicsEvent[] = []
  for (let i = 0; i < seconds * 60; i++) stepBall(b, env, tr, ev)
  return { ev, tr }
}

describe('physics', () => {
  it('ball falls under gravity and bounces lower each time', () => {
    const b = createBall(50, 34, 3)
    const { ev } = run(b, DEFAULT_ENV, 4)
    const bounces = ev.filter((e) => e.type === 'bounce')
    expect(bounces.length).toBeGreaterThan(1)
    const speeds = bounces.map((e) => (e.type === 'bounce' ? e.speed : 0))
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]).toBeLessThan(speeds[i - 1])
    expect(b.z).toBe(0)
  })

  it('rolling ball decelerates and stops; rain rolls further', () => {
    const dry = createBall(10, 34)
    dry.vx = 12
    run(dry, DEFAULT_ENV, 12)
    const wet = createBall(10, 34)
    wet.vx = 12
    run(wet, envForWeather('rain'), 12)
    expect(dry.vx).toBe(0)
    expect(dry.x).toBeGreaterThan(20)
    expect(wet.x).toBeGreaterThan(dry.x)
  })

  it('drag slows a ball in flight', () => {
    const b = createBall(10, 34, 1)
    b.vx = 30
    b.vz = 0
    const tr = createTracker()
    for (let i = 0; i < 20; i++) stepBall(b, DEFAULT_ENV, tr, [])
    expect(b.vx).toBeLessThan(30)
    expect(b.vx).toBeGreaterThan(25)
  })

  it('side spin curls the path (Magnus) in the documented direction', () => {
    const b = createBall(60, 34, 0.2)
    b.vx = 25
    b.vz = 4
    b.spin.side = 50
    const tr = createTracker()
    for (let i = 0; i < 50; i++) stepBall(b, DEFAULT_ENV, tr, [])
    // +spin bends toward +90° of travel (+x → +y)
    expect(b.y).toBeGreaterThan(35)
    const c = createBall(60, 34, 0.2)
    c.vx = 25
    c.vz = 4
    c.spin.side = -50
    for (let i = 0; i < 50; i++) stepBall(c, DEFAULT_ENV, createTracker(), [])
    expect(c.y).toBeLessThan(33)
  })

  it('topspin dips, backspin floats', () => {
    const mk = (top: number) => {
      const b = createBall(10, 34, 0.1)
      b.vx = 22
      b.vz = 7
      b.spin.top = top
      const pts = predictTrajectory(b, DEFAULT_ENV, { duration: 0.6 })
      return pts[pts.length - 1].z
    }
    expect(mk(40)).toBeLessThan(mk(0))
    expect(mk(-40)).toBeGreaterThan(mk(0))
  })

  it('wind drifts the ball', () => {
    const env = envForWeather('wind', { x: 0, y: 1 })
    const b = createBall(10, 34, 0.1)
    b.vx = 20
    b.vz = 8
    const tr = createTracker()
    for (let i = 0; i < 60; i++) stepBall(b, env, tr, [])
    expect(b.y).toBeGreaterThan(34.3)
  })

  it('detects a goal under the bar between the posts', () => {
    const b = createBall(PITCH_LENGTH - 10, GOAL_CENTER_Y + 1, 0.5)
    b.vx = 25
    b.vz = 2
    const { ev, tr } = run(b, DEFAULT_ENV, 2)
    expect(ev.some((e) => e.type === 'goal' && e.end === 'east')).toBe(true)
    expect(tr.inGoal).toBe('east')
    // Net holds it: stays within net depth.
    expect(b.x).toBeLessThan(PITCH_LENGTH + 2.01)
  })

  it('ball over the bar is out (goal kick), not a goal', () => {
    const b = createBall(PITCH_LENGTH - 10, GOAL_CENTER_Y, 2.6)
    b.vx = 25
    b.vz = 3
    const { ev } = run(b, DEFAULT_ENV, 2)
    expect(ev.some((e) => e.type === 'goal')).toBe(false)
    expect(ev.some((e) => e.type === 'out' && e.line === 'goal')).toBe(true)
  })

  it('ball hitting the post rebounds and reports the post', () => {
    const b = createBall(PITCH_LENGTH - 8, POST_Y_HIGH, 0.4)
    b.vx = 22
    b.vz = 1
    const { ev } = run(b, DEFAULT_ENV, 1)
    expect(ev.some((e) => e.type === 'post')).toBe(true)
    expect(b.vx).toBeLessThan(0)
  })

  it('crossbar deflects a rising shot', () => {
    const b = createBall(PITCH_LENGTH - 0.6, GOAL_CENTER_Y, GOAL_HEIGHT + 0.06)
    b.vx = 20
    b.vz = 0
    const ev: PhysicsEvent[] = []
    const tr = createTracker()
    for (let i = 0; i < 10; i++) stepBall(b, { ...DEFAULT_ENV, drag: 0 }, tr, ev)
    expect(ev.some((e) => e.type === 'bar')).toBe(true)
  })

  it('touchline out of play', () => {
    const b = createBall(50, 2)
    b.vy = -10
    const { ev } = run(b, DEFAULT_ENV, 2)
    expect(ev.some((e) => e.type === 'out' && e.line === 'touch')).toBe(true)
  })

  it('is deterministic', () => {
    const mk = () => {
      const b = createBall(80, 20, 0)
      b.vx = 24
      b.vy = 6
      b.vz = 6
      b.spin.side = 30
      run(b, envForWeather('wind'), 3)
      return b
    }
    expect(mk()).toEqual(mk())
  })

  it('predicts plane crossing and on-target check', () => {
    const b = createBall(PITCH_LENGTH - 16, GOAL_CENTER_Y, 0)
    b.vx = 25
    b.vz = 3
    const c = predictPlaneCrossing(b, DEFAULT_ENV, PITCH_LENGTH)
    expect(c).not.toBeNull()
    expect(c!.t).toBeGreaterThan(0.5)
    expect(isOnTarget(c!.y, c!.z)).toBe(true)
    expect(isOnTarget(GOAL_CENTER_Y, GOAL_HEIGHT + BALL_RADIUS)).toBe(false)
  })
})
