/**
 * Scenario tests for live-match rules (GAP-AUDIT 2.1 rows closed in the S21 sweep).
 */
import { describe, expect, it } from 'vitest'
import { makeDemoHighlight } from './demoHighlights'
import { PITCH_LENGTH } from '../sim/match/types'
import { visionOptionCount } from './kick'
import { GOAL_CENTER_Y } from './physics'
import { crossCamFit } from './view'
import { HighlightRuntime, ONE_TWO_WINDOW, oneTouchReturn, type RuntimeEvent } from './runtime'

function runUntil(rt: HighlightRuntime, pred: () => boolean, maxS: number, evs: RuntimeEvent[] = []): RuntimeEvent[] {
  for (let i = 0; i < maxS * 60 && !rt.finished && !pred(); i++) {
    rt.update(1 / 60)
    evs.push(...rt.drainEvents())
  }
  return evs
}
const statsOf = (rt: HighlightRuntime) => (rt as unknown as { stats: { passes: number; passesCompleted: number } }).stats

describe('2.1#58 a pass that reaches another team-mate is a completed pass', () => {
  it('deflects past the target to a second mate → completed', () => {
    let tried = 0
    let completed = 0
    for (let seed = 1; seed <= 12; seed++) {
      const rt = new HighlightRuntime(makeDemoHighlight('build_up', seed), { aimAssist: 'half', slowMoAim: false, seed })
      runUntil(rt, () => rt.phase === 'live' && rt.heroOnBall, 3)
      if (!rt.heroOnBall) continue
      const mates = rt.agents.filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper)
      if (mates.length < 2) continue
      const [a, b] = mates
      const h = rt.hero.pos
      // Clear the lane: opponents far away, A in front, B right behind A on the same line.
      for (const o of rt.agents) if (o.team !== 'hero' && !o.isKeeper) o.pos = { x: 5, y: 5 }
      a.pos = { x: h.x - 8, y: h.y }
      b.pos = { x: h.x - 12, y: h.y }
      a.vel = { x: 0, y: 0 }
      b.vel = { x: 0, y: 0 }
      a.noTouch = 10 // the ball runs through A (dummy / miscontrol)
      tried++
      rt.queueAction({ kind: 'pass', target: { ...a.pos } })
      runUntil(rt, () => rt.owner === b, 4)
      if (rt.owner === b && statsOf(rt).passesCompleted >= 1) completed++
    }
    expect(tried).toBeGreaterThan(3)
    expect(completed).toBeGreaterThanOrEqual(tried - 1)
  })
})

describe('2.1#59 one-two gate and window', () => {
  it('1.5 s window; Passing ≥ 55 returns it first time', () => {
    expect(ONE_TWO_WINDOW).toBe(1.5)
    expect(oneTouchReturn(55)).toBe(true)
    expect(oneTouchReturn(54)).toBe(false)
  })
})

describe('2.1#60 Vision pass options and offside frame', () => {
  it('shows 2 / 4 / all options at Vision 30 / 60 / 85', () => {
    expect(visionOptionCount(30)).toBe(2)
    expect(visionOptionCount(60)).toBe(4)
    expect(visionOptionCount(85)).toBe(Infinity)
  })
  it('flags a team-mate beyond the last defender', () => {
    let checked = 0
    for (let seed = 1; seed <= 6; seed++) {
      const rt = new HighlightRuntime(makeDemoHighlight('build_up', seed), { aimAssist: 'half', slowMoAim: false, seed })
      runUntil(rt, () => rt.phase === 'live' && rt.heroOnBall, 3)
      if (!rt.heroOnBall) continue
      const mate = rt.agents.find((a) => a.team === 'hero' && !a.isHero && !a.isKeeper)!
      const defX = Math.max(...rt.agents.filter((a) => a.team !== 'hero' && !a.isKeeper).map((a) => a.pos.x))
      mate.pos = { x: Math.min(104, Math.max(defX, rt.ball.x) + 4), y: 30 }
      expect(rt.offsideMates().has(mate.id)).toBe(true)
      mate.pos = { x: Math.min(rt.ball.x, defX) - 6, y: 30 }
      expect(rt.offsideMates().has(mate.id)).toBe(false)
      checked++
    }
    expect(checked).toBeGreaterThan(2)
  })
})

describe('2.1#62 cross camera shares one physics state', () => {
  it('framing a cross moves nothing: ball and players are identical (0 cm) before and after', () => {
    const rt = new HighlightRuntime(makeDemoHighlight('cross', 4), { aimAssist: 'half', slowMoAim: false, seed: 4 })
    runUntil(rt, () => rt.phase === 'live', 3)
    const snap = () => JSON.stringify({ b: [rt.ball.x, rt.ball.y, rt.ball.z], a: rt.agents.map((a) => [a.id, a.pos.x, a.pos.y]) })
    const before = snap()
    const from = { x: rt.ball.x, y: rt.ball.y }
    const landing = { x: 99, y: 34 }
    const fit = crossCamFit(from, landing, { x: PITCH_LENGTH, y: GOAL_CENTER_Y, halfWidth: 3.66, height: 2.44 }, { w: 1280, h: 720 }, 1)
    expect(fit).toBeTruthy()
    expect(from).toEqual({ x: rt.ball.x, y: rt.ball.y })
    expect(snap()).toBe(before)
  })
})
