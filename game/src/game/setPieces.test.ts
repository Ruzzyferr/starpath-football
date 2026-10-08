/**
 * Set-piece choices (GAP-AUDIT 2.1#95 wall instruction, 2.1#97 corner height /
 * curl): hero-taken corners and the wall at free kicks against — generation,
 * runtime, picker input, replay determinism, auto-resolve, prompts.
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../core/rng'
import type { Position } from '../core/types'
import { generatedHighlight } from './demoHighlights'
import { HighlightRuntime, type HeroAction } from './runtime'
import { InputRecorder, applyInput, replayInputs } from './inputReplay'
import { CHOICE_TIMEOUT, chooseFkShot, cornerKick, cornerRuns, cornerZoneTarget, sanitizeWall, wallGap } from './setPieceChoice'
import { PAD, PickerState, keyToPickerInput, padToPickerInputs } from './setPiecePicker'
import { WALL_MAX, WALL_MIN, wallSpots } from './setup'
import { GOAL_CENTER_Y } from './physics'
import { autoResolve } from '../sim/match/autoResolve'
import { HIGHLIGHT_PROMPTS } from '../sim/match/commentary'
import { MatchSim } from '../sim/match/engine'
import { highlightRatingDelta } from '../sim/match/rating'
import { makeAttributes, makeSetup } from '../sim/match/testFixtures'
import { DEFENSIVE_KINDS, PITCH_LENGTH, type HighlightResult } from '../sim/match/types'
import { tr as trMatch, en as enMatch } from '../i18n/sections/match'
import { pickMatchHint } from '../ui/tutorial/hints'

const DT = 1 / 60

describe('set-piece choices: data', () => {
  it('prompts, kind names, defensive flag, hints', () => {
    for (const k of ['corner_kick', 'fk_wall'] as const) {
      expect(HIGHLIGHT_PROMPTS[k].tr.length).toBeGreaterThan(10)
      expect(HIGHLIGHT_PROMPTS[k].en.length).toBeGreaterThan(10)
      expect((trMatch.kind as Record<string, string>)[k]).toBeTruthy()
      expect((enMatch.kind as Record<string, string>)[k]).toBeTruthy()
    }
    expect(DEFENSIVE_KINDS.has('fk_wall') && !DEFENSIVE_KINDS.has('corner_kick')).toBe(true)
    expect(pickMatchHint('corner_kick', () => false)).toBe('cornerPick')
    expect(pickMatchHint('fk_wall', () => false)).toBe('wallSet')
  })

  it('auto-resolve: corners are mostly cleared, free kicks mostly kept out', () => {
    const rng = new Rng(9)
    const count = (kind: 'corner_kick' | 'fk_wall', pos: Position) => {
      const attrs = makeAttributes(rng, pos, 70)
      const out: Record<string, number> = {}
      for (let i = 0; i < 400; i++) {
        const o = autoResolve(kind, attrs, 1, rng).outcome
        out[o] = (out[o] ?? 0) + 1
      }
      return out
    }
    const c = count('corner_kick', 'LW')
    expect(c.cleared).toBeGreaterThan(150)
    expect((c.assist ?? 0) + (c.goal ?? 0)).toBeGreaterThan(10)
    const f = count('fk_wall', 'GK')
    expect(f.defended).toBeGreaterThan(280)
    expect(f.conceded).toBeGreaterThan(10)
  })

  it('rating: a cleared corner costs little, a held free kick earns a little', () => {
    const r = (outcome: HighlightResult['outcome']): HighlightResult => ({ outcome, passes: 0, passesCompleted: 0, shots: 0, shotsOnTarget: 0, dribbles: 0, tackles: 0 })
    expect(highlightRatingDelta('corner_kick', r('cleared'))).toBeGreaterThan(highlightRatingDelta('corner_kick', r('lost_ball')))
    expect(highlightRatingDelta('fk_wall', r('defended'))).toBeGreaterThan(0)
    expect(highlightRatingDelta('fk_wall', r('conceded'))).toBeLessThan(0)
  })
})

describe('picker input', () => {
  it('maps keys and pad buttons', () => {
    expect(keyToPickerInput('Digit2', 'corner')).toEqual({ kind: 'zone', zone: 'far' })
    expect(keyToPickerInput('KeyZ', 'corner')).toEqual({ kind: 'height' })
    expect(keyToPickerInput('Digit5', 'wall')).toEqual({ kind: 'count', count: 5 })
    expect(keyToPickerInput('Digit1', 'wall')).toBeNull()
    expect(keyToPickerInput('Space', 'wall')).toEqual({ kind: 'confirm' })
    const now: boolean[] = []
    now[PAD.x] = true
    now[PAD.a] = true
    expect(padToPickerInputs([], now, 'corner')).toEqual([{ kind: 'height' }, { kind: 'confirm' }])
    expect(padToPickerInputs(now, now, 'corner')).toEqual([])
  })

  it('corner: toggles then a zone commits the full choice', () => {
    const st = new PickerState('corner')
    expect(st.apply({ kind: 'height' })).toBeNull()
    expect(st.apply({ kind: 'curl' })).toBeNull()
    expect(st.apply({ kind: 'zone', zone: 'near' })).toEqual({ kind: 'corner', zone: 'near', height: 'driven', curl: 'out' })
    expect(st.apply({ kind: 'confirm' })).toBeNull() // already done
  })

  it('wall: count stays in 2–5, nudge on a 0.5 m grid, screen direction respected', () => {
    const st = new PickerState('wall', false)
    for (let i = 0; i < 6; i++) st.apply({ kind: 'up' })
    expect(st.wall.count).toBe(WALL_MAX)
    for (let i = 0; i < 6; i++) st.apply({ kind: 'down' })
    expect(st.wall.count).toBe(WALL_MIN)
    st.apply({ kind: 'right' })
    expect(st.wall.nudge).toBe(-0.5)
    expect(st.apply({ kind: 'confirm' })).toEqual({ kind: 'wall', count: 2, nudge: -0.5 })
    expect(sanitizeWall({ count: 9, nudge: 0.74 })).toEqual({ count: 5, nudge: 0.5 })
    expect(sanitizeWall({ count: Number.NaN, nudge: -9 })).toEqual({ count: 4, nudge: -1.5 })
  })
})

describe('corner_kick', () => {
  it('generation: the hero stands over the ball at the flag, headers in the box', () => {
    for (let s = 1; s <= 8; s++) {
      const h = generatedHighlight('corner_kick', s)
      const hero = h.scenario.players.find((p) => p.isHero)!
      expect(hero.pos.x).toBeGreaterThan(PITCH_LENGTH - 2)
      expect(h.scenario.ball.ownerId).toBe(hero.id)
      const inBox = h.scenario.players.filter((p) => p.side === hero.side && !p.isHero && p.pos.x > PITCH_LENGTH - 16.5)
      expect(inBox.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('the clock stops until the delivery is chosen; idle players get the default', () => {
    const rt = new HighlightRuntime(generatedHighlight('corner_kick', 2), { seed: 2 })
    for (let i = 0; i < 120; i++) rt.update(DT)
    expect(rt.pendingChoice).toBe('corner')
    const t = rt.time
    for (let i = 0; i < 60; i++) rt.update(DT)
    expect(rt.time).toBe(t)
    for (let i = 0; i < CHOICE_TIMEOUT * 60 + 10; i++) rt.update(DT)
    expect(rt.pendingChoice).toBeNull()
    expect(rt.cornerChoice).toEqual({ zone: 'far', height: 'floated', curl: 'in' })
  })

  it('delivery follows the choice: zone target, height and curl handedness', () => {
    const top = { x: PITCH_LENGTH - 0.6, y: 0.6 }
    const bottom = { x: PITCH_LENGTH - 0.6, y: 67.4 }
    expect(cornerZoneTarget('near', top).y).toBeLessThan(GOAL_CENTER_Y)
    expect(cornerZoneTarget('far', top).y).toBeGreaterThan(GOAL_CENTER_Y)
    expect(cornerZoneTarget('near', bottom).y).toBeGreaterThan(GOAL_CENTER_Y)
    const inT = cornerKick({ zone: 'far', height: 'floated', curl: 'in' }, top)
    const outT = cornerKick({ zone: 'far', height: 'floated', curl: 'out' }, top)
    const inB = cornerKick({ zone: 'far', height: 'floated', curl: 'in' }, bottom)
    expect(Math.sign(inT.curl)).toBe(-Math.sign(outT.curl))
    expect(Math.sign(inT.curl)).toBe(-Math.sign(inB.curl))
    const driven = cornerKick({ zone: 'near', height: 'driven', curl: 'in' }, top)
    expect(driven.targetZ).toBeLessThan(inT.targetZ)
    expect(driven.power).toBeGreaterThan(inT.power)
    expect(cornerKick({ zone: 'short', height: 'driven', curl: 'in' }, top).kind).toBe('pass')
  })

  it('runs: the best header attacks the chosen zone', () => {
    const top = { x: PITCH_LENGTH - 0.6, y: 0.6 }
    const runners = [
      { id: 'a', pos: { x: 95, y: 30 }, heading: 60 },
      { id: 'b', pos: { x: 96, y: 36 }, heading: 90 },
      { id: 'c', pos: { x: 94, y: 40 }, heading: 70 },
    ]
    const runs = cornerRuns({ zone: 'near', height: 'driven', curl: 'in' }, top, runners)
    const near = cornerZoneTarget('near', top)
    expect(Math.hypot(runs.get('b')!.x - near.x, runs.get('b')!.y - near.y)).toBeLessThan(2)
    expect(cornerRuns({ zone: 'short', height: 'driven', curl: 'in' }, top, runners).size).toBe(0)
  })

  it('plays out to assist / goal / cleared (and the ball goes where it was asked)', () => {
    const seen = new Set<string>()
    let nearDrops = 0
    let farDrops = 0
    for (let s = 1; s <= 24; s++) {
      const zone = s % 2 ? 'near' : 'far'
      const rt = new HighlightRuntime(generatedHighlight('corner_kick', s), { seed: s })
      const spotY = rt.setPiece!.spot.y
      let firstY: number | null = null
      for (let f = 0; f < 40 * 60 && !rt.finished; f++) {
        if (rt.pendingChoice) rt.queueAction({ kind: 'corner', zone, height: 'floated', curl: 'in' })
        rt.update(DT)
        for (const e of rt.drainEvents()) if ((e.type === 'touch' || e.type === 'header') && firstY === null && rt.ball.x > PITCH_LENGTH - 20) firstY = rt.ball.y
      }
      expect(rt.finished).toBe(true)
      seen.add(rt.result!.outcome)
      if (firstY !== null) {
        const nearSide = Math.abs(firstY - spotY) < Math.abs(GOAL_CENTER_Y - spotY)
        if (zone === 'near' && nearSide) nearDrops++
        if (zone === 'far' && !nearSide) farDrops++
      }
    }
    expect(seen.has('cleared')).toBe(true)
    expect([...seen].every((o) => ['assist', 'goal', 'cleared', 'pass_complete', 'saved', 'missed', 'blocked', 'woodwork', 'foul_won', 'foul_committed', 'lost_ball'].includes(o))).toBe(true)
    expect(nearDrops + farDrops).toBeGreaterThan(12)
  })
})

describe('fk_wall', () => {
  it('generation: their taker 16–33 m out, our keeper on his line, a wall of four', () => {
    for (const pos of ['GK', 'CB'] as Position[]) {
      for (let s = 1; s <= 6; s++) {
        const h = generatedHighlight('fk_wall', s, { heroPos: pos })
        const rt = new HighlightRuntime(h, { seed: s })
        expect(rt.defending).toBe(true)
        expect(rt.pendingChoice).toBe('wall')
        const sp = rt.setPiece!
        expect(sp.spot.x).toBeGreaterThanOrEqual(16.5)
        expect(sp.spot.x).toBeLessThanOrEqual(32)
        expect(sp.wall).toHaveLength(4)
        // Captain: the hero stands in the wall; keeper: he is in goal.
        expect(sp.wall.includes(rt.hero.id)).toBe(pos !== 'GK')
        expect(rt.heroIsKeeper).toBe(pos === 'GK')
      }
    }
  })

  it('the wall follows the choice (count and shift) and previews match the commit', () => {
    const h = generatedHighlight('fk_wall', 3, { heroPos: 'CB' })
    const a = new HighlightRuntime(h, { seed: 3 })
    const b = new HighlightRuntime(h, { seed: 3 })
    for (let i = 0; i < 60; i++) {
      a.update(DT)
      b.update(DT)
    }
    // b plays with the preview a while before committing.
    b.previewWall({ count: 2, nudge: 1 })
    b.previewWall({ count: 5, nudge: -1.5 })
    a.queueAction({ kind: 'wall', count: 3, nudge: 0.5 })
    b.queueAction({ kind: 'wall', count: 3, nudge: 0.5 })
    a.update(DT)
    b.update(DT)
    expect(a.setPiece!.wall).toEqual(b.setPiece!.wall)
    expect(a.setPiece!.wall).toHaveLength(3)
    const spots = wallSpots(a.setPiece!.spot, 3, 0.5)
    a.setPiece!.wall.forEach((id, i) => {
      const ag = a.agents.find((x) => x.id === id)!
      expect(Math.hypot(ag.pos.x - spots[i]!.x, ag.pos.y - spots[i]!.y)).toBeLessThan(0.01)
    })
    for (const ag of a.agents) {
      const bg = b.agents.find((x) => x.id === ag.id)!
      expect(Math.hypot(ag.pos.x - bg.pos.x, ag.pos.y - bg.pos.y)).toBeLessThan(1e-9)
    }
  })

  it('the taker reads the wall: an open near post is attacked low, a covered one is not', () => {
    const spot = { x: 22, y: 24 }
    const open = { spot, wall: wallSpots(spot, 2, 1.5), keeper: { x: 1, y: 33 }, skill: 0.6 }
    const shut = { spot, wall: wallSpots(spot, 4, 0), keeper: { x: 1, y: 33 }, skill: 0.6 }
    let lowOpen = 0
    let lowShut = 0
    for (let i = 0; i < 200; i++) {
      if (chooseFkShot(open, new Rng(i)).label === 'near_low') lowOpen++
      if (chooseFkShot(shut, new Rng(i)).label === 'near_low') lowShut++
    }
    expect(lowOpen).toBeGreaterThan(100)
    expect(lowShut).toBeLessThan(10)
    expect(wallGap(shut, { x: -0.2, y: GOAL_CENTER_Y - 3 })).toBeLessThan(0.55)
  })

  it('a full wall invites a delivery to the free man instead', () => {
    const spot = { x: 24, y: 40 }
    const view = { spot, wall: wallSpots(spot, 5, 0), keeper: { x: 1, y: 34 }, skill: 0.5, runners: [{ id: 'r1', pos: { x: 10, y: 30 } }], markers: [{ x: 6, y: 40 }] }
    let crosses = 0
    for (let i = 0; i < 200; i++) if (chooseFkShot(view, new Rng(i)).label === 'cross') crosses++
    expect(crosses).toBeGreaterThan(20)
    expect(chooseFkShot({ ...view, wall: wallSpots(spot, 3, 0) }, new Rng(1)).label).not.toBe('cross')
  })

  it('outcomes: kept out or conceded only; the taker always strikes after the wall is set', () => {
    for (const pos of ['GK', 'CB'] as Position[]) {
      const seen = new Set<string>()
      for (let s = 1; s <= 12; s++) {
        const rt = new HighlightRuntime(generatedHighlight('fk_wall', s, { heroPos: pos }), { seed: s })
        let kicked = false
        for (let f = 0; f < 40 * 60 && !rt.finished; f++) {
          if (rt.pendingChoice) rt.queueAction({ kind: 'wall', count: 2 + (s % 4), nudge: 0 })
          rt.update(DT)
          for (const e of rt.drainEvents()) if (e.type === 'kick' && !e.hero && !kicked) kicked = true
        }
        expect(kicked).toBe(true)
        expect(rt.fkShot).not.toBeNull()
        seen.add(rt.result!.outcome)
      }
      expect([...seen].every((o) => o === 'defended' || o === 'conceded' || o === 'foul_committed' || o === 'goal')).toBe(true)
      expect(seen.has('defended')).toBe(true)
    }
  })
})

describe('input replay with set-piece choices', () => {
  it('a recorded corner and a recorded wall replay bit for bit', () => {
    for (const [kind, pos, choice] of [
      ['corner_kick', 'LW', { kind: 'corner', zone: 'spot', height: 'driven', curl: 'out' }],
      ['fk_wall', 'GK', { kind: 'wall', count: 5, nudge: -1 }],
    ] as const) {
      const h = generatedHighlight(kind, 5, { heroPos: pos })
      const opts = { seed: 77, aimAssist: 'half' as const }
      const rt = new HighlightRuntime(h, opts)
      const rec = new InputRecorder()
      let sent = false
      for (let f = 0; f < 40 * 60 && !rt.finished; f++) {
        const actions: HeroAction[] = []
        if (rt.pendingChoice && !sent && f > 70) {
          actions.push({ ...choice } as HeroAction)
          sent = true
        }
        applyInput(rt, { move: { x: f % 90 < 45 ? 0.3 : -0.2, y: 0.1 }, sprint: false, actions, aim: null }, DT, rec)
        rt.drainEvents()
      }
      const again = replayInputs(h, rec.toRecording(h.id, opts))
      expect(again.result).toEqual(rt.result)
      expect(again.time).toBe(rt.time)
      expect(again.ball.x).toBe(rt.ball.x)
    }
  })
})

describe('engine: who gets the set-piece moments', () => {
  const kinds = (pos: Position, captain: boolean, heroOvr: number, n = 30) => {
    const out: Record<string, number> = {}
    for (let i = 0; i < n; i++) {
      const setup = makeSetup({ seed: 9100 + i, heroSide: 'home', home: { heroPosition: pos, heroOvr, ovr: 62 }, away: { ovr: 70 } })
      if (captain) setup.heroCaptain = true
      const m = new MatchSim(setup, 'en')
      while (!m.finished) {
        if (m.pendingHighlight) {
          out[m.pendingHighlight.kind] = (out[m.pendingHighlight.kind] ?? 0) + 1
          m.skipHighlight()
        } else m.step()
      }
    }
    return out
  }

  it('the designated corner taker takes corners as moments', () => {
    expect(kinds('LW', false, 92).corner_kick ?? 0).toBeGreaterThan(0)
    // A weak crosser is never the designated taker.
    expect(kinds('LW', false, 40).corner_kick ?? 0).toBe(0)
  })

  it('the keeper, or the captain, sets the wall; an ordinary outfielder does not', () => {
    expect(kinds('GK', false, 70).fk_wall ?? 0).toBeGreaterThan(0)
    expect(kinds('CB', true, 70).fk_wall ?? 0).toBeGreaterThan(0)
    expect(kinds('CB', false, 70).fk_wall ?? 0).toBe(0)
  })
})
