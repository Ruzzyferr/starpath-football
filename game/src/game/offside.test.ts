import { describe, expect, it } from 'vitest'
import type { Highlight } from '../sim/match/types'
import { PITCH_LENGTH } from '../sim/match/types'
import { makeDemoHighlight } from './demoHighlights'
import { OFFSIDE_TOLERANCE, isOffsidePosition, offsideSnapshot, secondLastOpponentDepth } from './offside'
import { HighlightRuntime, type RuntimeEvent } from './runtime'
import type { Agent, Team } from './model'

const HALF = PITCH_LENGTH / 2

describe('isOffsidePosition (Law 11)', () => {
  // Defenders: keeper on the line and a back line at 80 → second-last opponent at 80.
  const opp = [103.5, 80, 78, 75]

  it('flags an attacker beyond the ball and the second-last opponent', () => {
    expect(isOffsidePosition(85, 60, opp, 1)).toBe(true)
  })

  it('level with the second-last opponent is onside', () => {
    expect(isOffsidePosition(80, 60, opp, 1)).toBe(false)
    expect(isOffsidePosition(80 + OFFSIDE_TOLERANCE * 0.5, 60, opp, 1)).toBe(false)
  })

  it('behind (or level with) the ball is onside even past the defenders', () => {
    expect(isOffsidePosition(85, 86, opp, 1)).toBe(false)
    expect(isOffsidePosition(85, 85, opp, 1)).toBe(false)
  })

  it('cannot be offside in the own half (halfway line counts as own half)', () => {
    const highLine = [103, 40, 38]
    expect(isOffsidePosition(HALF, 30, highLine, 1)).toBe(false)
    expect(isOffsidePosition(HALF - 3, 30, highLine, 1)).toBe(false)
    expect(isOffsidePosition(HALF + 1, 30, highLine, 1)).toBe(true)
  })

  it('the keeper counts: keeper off his line + one defender sets the line', () => {
    // Keeper rushed out to 70, a defender back on the line at 95 → second-last is the keeper's 70.
    expect(secondLastOpponentDepth([70, 95], 1)).toBe(70)
    expect(isOffsidePosition(80, 60, [70, 95], 1)).toBe(true)
    expect(isOffsidePosition(69, 60, [70, 95], 1)).toBe(false)
    // Keeper on his line, one defender at 85: the defender is second-last.
    expect(isOffsidePosition(84, 60, [104, 85], 1)).toBe(false)
    expect(isOffsidePosition(86, 60, [104, 85], 1)).toBe(true)
  })

  it('works for a team attacking the west goal (x = 0)', () => {
    const westDefenders = [1.5, 25, 27, 30]
    expect(isOffsidePosition(20, 45, westDefenders, -1)).toBe(true)
    expect(isOffsidePosition(25, 45, westDefenders, -1)).toBe(false) // level
    expect(isOffsidePosition(20, 18, westDefenders, -1)).toBe(false) // behind the ball
    expect(isOffsidePosition(60, 70, [1.5, 70], -1)).toBe(false) // own half for a west attacker
  })

  it('handles thin casts sensibly', () => {
    expect(isOffsidePosition(90, 60, [], 1)).toBe(false)
    expect(isOffsidePosition(90, 60, [85], 1)).toBe(true)
  })

  it('offsideSnapshot lists only offside team-mates of the passer', () => {
    const ag = (id: string, team: Team, x: number): Agent => ({ id, team, pos: { x, y: 30 } }) as Agent
    const agents = [ag('p', 'hero', 60), ag('a', 'hero', 88), ag('b', 'hero', 79), ag('gk', 'opp', 103), ag('d1', 'opp', 80), ag('d2', 'opp', 82)]
    expect([...offsideSnapshot(agents, 60, agents[0]!)]).toEqual(['a'])
    // Opponents attacking west from the same positions: nobody beyond their line.
    expect(offsideSnapshot(agents, 82, agents[4]!).size).toBe(0)
  })
})

// ───────────────────────── Runtime ─────────────────────────

/**
 * Hero (on the ball at x=70, wide left) and a striker in the same lane; the
 * opposition back line sits at x=80, keeper on his line. Other team-mates are
 * parked deep so nobody else gets involved.
 */
function passScenario(receiverX: number, seed = 1): { h: Highlight; receiverId: string } {
  const h = makeDemoHighlight('build_up', seed)
  const sc = h.scenario
  const mates = sc.players.filter((p) => p.side === h.side && !p.isHero)
  const receiver = mates.find((p) => p.role === 'ST')!
  for (const p of sc.players) {
    if (p.isHero) p.pos = { x: 70, y: 12 }
    else if (p === receiver) p.pos = { x: receiverX, y: 12 }
    else if (p.side === h.side) p.pos = p.role === 'GK' ? { x: 8, y: 34 } : { x: 40, y: 20 + (mates.indexOf(p) % 5) * 7 }
    else if (p.role === 'GK') p.pos = { x: 103.5, y: 34 }
    else p.pos = { x: 80, y: 24 + (sc.players.indexOf(p) % 10) * 3 }
  }
  sc.ball = { pos: { x: 70.5, y: 12 }, z: 0, ownerId: 'hero' }
  sc.timeLimit = 10
  return { h, receiverId: receiver.id }
}

function runPass(receiverX: number, seed: number, through = false) {
  const { h, receiverId } = passScenario(receiverX, seed)
  const rt = new HighlightRuntime(h, { aimAssist: 'full', slowMoAim: false, difficulty: 'normal', seed })
  const events: RuntimeEvent[] = []
  let queued = false
  for (let i = 0; i < 60 * 30 && !rt.finished; i++) {
    if (!queued && rt.phase === 'live') {
      const target = { x: receiverX, y: 12 }
      rt.queueAction(through ? { kind: 'pass', target: { x: receiverX + 3, y: 12 }, through: true } : { kind: 'pass', target })
      queued = true
    }
    rt.update(1 / 60)
    events.push(...rt.drainEvents())
  }
  return { rt, events, receiverId }
}

describe('HighlightRuntime offside', () => {
  it("flags a team-mate beyond the last defender when the hero's pass is played", () => {
    for (const seed of [1, 2, 3]) {
      const { rt, events, receiverId } = runPass(90, seed)
      expect(rt.result?.outcome).toBe('lost_ball')
      expect(rt.result?.offside).toEqual({ playerId: receiverId, byHero: false })
      expect(rt.endReason).toBe('offside')
      const flag = events.find((e) => e.type === 'offside')
      expect(flag).toMatchObject({ type: 'offside', by: receiverId, team: 'hero' })
      // The pass is attempted but never counted as completed.
      expect(rt.result?.passes).toBe(1)
      expect(rt.result?.passesCompleted).toBe(0)
    }
  })

  it('a through ball into space is judged on the position at the pass, not at the reception', () => {
    const { rt } = runPass(90, 2, true)
    expect(rt.result?.offside?.byHero).toBe(false)
    expect(rt.result?.outcome).toBe('lost_ball')
  })

  it('a team-mate onside at the moment of the pass is not flagged (even if he ends up beyond the line)', () => {
    for (const seed of [1, 2, 3]) {
      const { rt, events } = runPass(77, seed, true)
      expect(events.some((e) => e.type === 'offside')).toBe(false)
      expect(rt.result?.offside).toBeUndefined()
    }
  })
})
