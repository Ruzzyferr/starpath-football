/**
 * Headless smoke tests: run the full highlight loop (AI + physics + rules)
 * without any renderer, for every HighlightKind, until an outcome is produced.
 */
import { describe, expect, it } from 'vitest'
import type { HighlightOutcome } from '../sim/match/types'
import { autopilotStep, createAutopilot } from './autopilot'
import { ALL_KINDS, makeDemoHighlight } from './demoHighlights'
import { HighlightRuntime, type RuntimeOptions } from './runtime'
import { PITCH_LENGTH } from '../sim/match/types'
import { GOAL_CENTER_Y } from './physics'

const OUTCOMES: HighlightOutcome[] = [
  'goal', 'assist', 'saved', 'missed', 'blocked', 'woodwork', 'pass_complete', 'lost_ball', 'defended', 'conceded', 'foul_won', 'foul_committed', 'timeout',
]

function play(kind: (typeof ALL_KINDS)[number], seed: number, auto: boolean, opts: RuntimeOptions = {}) {
  const rt = new HighlightRuntime(makeDemoHighlight(kind, seed), { aimAssist: 'full', slowMoAim: true, difficulty: 'normal', seed, ...opts })
  const ap = createAutopilot(seed)
  let frames = 0
  let events = 0
  while (!rt.finished && frames < 60 * 60) {
    if (auto) autopilotStep(rt, ap)
    rt.update(1 / 60)
    events += rt.drainEvents().length
    frames++
  }
  return { rt, frames, events }
}

describe('HighlightRuntime smoke', () => {
  for (const kind of ALL_KINDS) {
    it(`${kind}: autopilot reaches an outcome`, () => {
      const seen = new Set<HighlightOutcome>()
      for (let seed = 1; seed <= 6; seed++) {
        const { rt, events } = play(kind, seed, true)
        expect(rt.finished).toBe(true)
        expect(rt.result).not.toBeNull()
        const r = rt.result!
        expect(OUTCOMES).toContain(r.outcome)
        for (const k of ['passes', 'passesCompleted', 'shots', 'shotsOnTarget', 'dribbles', 'tackles'] as const) {
          expect(r[k]).toBeGreaterThanOrEqual(0)
          expect(Number.isFinite(r[k])).toBe(true)
        }
        expect(r.passesCompleted).toBeLessThanOrEqual(r.passes)
        expect(r.shotsOnTarget).toBeLessThanOrEqual(r.shots)
        expect(events).toBeGreaterThan(0)
        // Positions stay finite.
        expect(Number.isFinite(rt.ball.x) && Number.isFinite(rt.ball.y) && Number.isFinite(rt.ball.z)).toBe(true)
        seen.add(r.outcome)
      }
      // eslint-disable-next-line no-console
      console.log(kind, [...seen].join(','))
    })

    it(`${kind}: idle hero still ends (timeout or AI resolution)`, () => {
      const { rt } = play(kind, 3, false)
      expect(rt.finished).toBe(true)
      expect(rt.result).not.toBeNull()
    })
  }

  it('is deterministic for a seed', () => {
    const a = play('edge_of_box', 7, true).rt.result
    const b = play('edge_of_box', 7, true).rt.result
    expect(a).toEqual(b)
  })

  it('a clean penalty into the corner beats a wrong-footed keeper often', () => {
    let goals = 0
    for (let seed = 1; seed <= 20; seed++) {
      const rt = new HighlightRuntime(makeDemoHighlight('penalty', seed), { aimAssist: 'full', slowMoAim: false, seed })
      while (rt.phase !== 'live') rt.update(1 / 60)
      rt.queueAction({ kind: 'shoot', target: { x: PITCH_LENGTH, y: GOAL_CENTER_Y + 2.9 }, power: 0.9, curl: 0, chip: false })
      while (!rt.finished) rt.update(1 / 60)
      if (rt.result!.outcome === 'goal') goals++
      expect(rt.result!.shots).toBe(1)
    }
    expect(goals).toBeGreaterThan(8)
  })

  it('bullet time slows game time when the hero receives', () => {
    const rt = new HighlightRuntime(makeDemoHighlight('build_up', 2), { slowMoAim: true, seed: 2 })
    for (let i = 0; i < 60; i++) rt.update(1 / 60)
    expect(rt.bulletActive).toBe(true)
    expect(rt.time).toBeLessThan(0.75)
    const off = new HighlightRuntime(makeDemoHighlight('build_up', 2), { slowMoAim: false, seed: 2 })
    for (let i = 0; i < 60; i++) off.update(1 / 60)
    expect(off.time).toBeGreaterThan(0.95)
  })

  it('records replay frames', () => {
    const { rt } = play('one_on_one', 4, true)
    expect(rt.replayFrames().length).toBeGreaterThan(30)
  })

  it('shot preview produces a trajectory toward goal', () => {
    const rt = new HighlightRuntime(makeDemoHighlight('edge_of_box', 1), { seed: 1 })
    while (rt.phase !== 'live') rt.update(1 / 60)
    const pv = rt.preview({ kind: 'target', target: { x: PITCH_LENGTH, y: GOAL_CENTER_Y }, power: 0.8, curl: 0.5, chip: false })
    expect(pv).not.toBeNull()
    const last = pv!.points[pv!.points.length - 1]
    expect(last.x).toBeGreaterThan(rt.ball.x + 10)
  })
})
