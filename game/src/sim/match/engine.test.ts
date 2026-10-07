import { Rng } from '../../core/rng'
import type { Formation, Position, TacticStyle } from '../../core/types'
import { MatchSim } from './engine'
import { makeSetup } from './testFixtures'
import type { HighlightResult, MatchSnapshot } from './types'
import { PITCH_LENGTH, PITCH_WIDTH } from './types'

const FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '4-1-4-1', '3-4-3']
const STYLES: TacticStyle[] = ['possession', 'counter', 'direct', 'pressing', 'defensive', 'balanced']

const blank = (outcome: HighlightResult['outcome']): HighlightResult => ({
  outcome, passes: 0, passesCompleted: 0, shots: 0, shotsOnTarget: 0, dribbles: 0, tackles: 0,
})

function heroMatch(seed: number, pos: Position, extra: Partial<Parameters<typeof makeSetup>[0]> = {}) {
  const formation: Formation = pos === 'AM' ? '4-2-3-1' : pos === 'DM' || pos === 'LW' ? '4-3-3' : '4-4-2'
  return makeSetup({ seed, heroSide: 'home', home: { heroPosition: pos, formation }, ...extra })
}

describe('MatchSim determinism', () => {
  it('produces identical events for the same seed (AI match)', () => {
    const a = new MatchSim(makeSetup({ seed: 42 }), 'en').simulateToEnd()
    const b = new MatchSim(makeSetup({ seed: 42 }), 'en').simulateToEnd()
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events))
    expect(a.score).toEqual(b.score)
  })

  it('produces identical events for the same seed with hero highlights auto-resolved', () => {
    const run = () => new MatchSim(heroMatch(7, 'ST'), 'tr').simulateToEnd()
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
  })

  it('differs across seeds', () => {
    const a = new MatchSim(makeSetup({ seed: 1 }), 'en').simulateToEnd()
    const b = new MatchSim(makeSetup({ seed: 2 }), 'en').simulateToEnd()
    expect(JSON.stringify(a.events)).not.toBe(JSON.stringify(b.events))
  })
})

describe('MatchSim statistics (1000 matches)', () => {
  it('has realistic goals, home win rate, shots and is fast', () => {
    const rng = new Rng(2026)
    const N = 1000
    let goals = 0, homeWins = 0, draws = 0, shots = 0, onTarget = 0, possLow = 100, possHigh = 0, ms = 0
    for (let i = 0; i < N; i++) {
      const setup = makeSetup({
        seed: 10_000 + i,
        home: { ovr: rng.int(60, 76), formation: rng.pick(FORMATIONS), style: rng.pick(STYLES) },
        away: { ovr: rng.int(60, 76), formation: rng.pick(FORMATIONS), style: rng.pick(STYLES) },
        weather: rng.pick(['clear', 'rain', 'snow', 'wind', 'hot'] as const),
      })
      const sim = new MatchSim(setup, 'en')
      const t = performance.now()
      const s = sim.simulateToEnd()
      ms += performance.now() - t
      goals += s.score[0] + s.score[1]
      if (s.score[0] > s.score[1]) homeWins++
      else if (s.score[0] === s.score[1]) draws++
      shots += s.shots[0] + s.shots[1]
      onTarget += s.shotsOnTarget[0] + s.shotsOnTarget[1]
      possLow = Math.min(possLow, s.possession[0])
      possHigh = Math.max(possHigh, s.possession[0])
    }
    const avgGoals = goals / N
    const homeRate = homeWins / N
    const shotsPerTeam = shots / N / 2
    expect(avgGoals).toBeGreaterThanOrEqual(2.2)
    expect(avgGoals).toBeLessThanOrEqual(3.0)
    expect(homeRate).toBeGreaterThanOrEqual(0.42)
    expect(homeRate).toBeLessThanOrEqual(0.5)
    expect(draws / N).toBeGreaterThan(0.18)
    expect(shotsPerTeam).toBeGreaterThanOrEqual(11)
    expect(shotsPerTeam).toBeLessThanOrEqual(15.5)
    expect(onTarget / shots).toBeGreaterThan(0.28)
    expect(onTarget / shots).toBeLessThan(0.45)
    expect(possHigh - possLow).toBeGreaterThan(25) // possession variety
    expect(ms / N).toBeLessThan(2)
  })
})

describe('MatchSim flow', () => {
  it('emits kickoff, halftime and fulltime and finishes after 90+ minutes', () => {
    const s = new MatchSim(makeSetup({ seed: 5 }), 'tr').simulateToEnd()
    const types = s.events.map((e) => e.type)
    expect(types[0]).toBe('kickoff')
    expect(types).toContain('halftime')
    expect(types[types.length - 1]).toBe('fulltime')
    expect(s.finished).toBe(true)
    expect(s.phase).toBe('done')
    expect(s.minute).toBe(90)
    expect(s.possession[0] + s.possession[1]).toBe(100)
  })

  it('score on every event is monotonic and matches goal events', () => {
    const s = new MatchSim(makeSetup({ seed: 77 }), 'en').simulateToEnd()
    const goals = s.events.filter((e) => e.type === 'goal')
    const home = goals.filter((g) => g.side === 'home').length
    expect(home).toBe(s.score[0])
    expect(goals.length - home).toBe(s.score[1])
  })

  it('knockouts always produce a winner (extra time / penalties)', () => {
    let shootouts = 0
    for (let i = 0; i < 300; i++) {
      const sim = new MatchSim(makeSetup({ seed: 500 + i, knockout: true }), 'en')
      const s = sim.simulateToEnd()
      const r = sim.result()
      if (r.home === r.away) {
        shootouts++
        expect(r.penalties).toBeDefined()
        expect(r.penalties?.home).not.toBe(r.penalties?.away)
        expect(s.events.some((e) => e.type === 'extratime')).toBe(true)
      }
      expect(s.finished).toBe(true)
    }
    expect(shootouts).toBeGreaterThan(5)
  })

  it('knockout with a hero in a shootout still finishes with a winner', () => {
    for (let i = 0; i < 80; i++) {
      const sim = new MatchSim(heroMatch(900 + i, 'ST', { knockout: true }), 'en')
      sim.simulateToEnd()
      const r = sim.result()
      expect(r.home !== r.away || (r.penalties && r.penalties.home !== r.penalties.away)).toBe(true)
    }
  })

  it('result() lists scorers and a man of the match', () => {
    const sim = new MatchSim(makeSetup({ seed: 31 }), 'en')
    sim.simulateToEnd()
    const r = sim.result()
    expect(r.scorers.length).toBe(r.home + r.away)
    expect(r.motmId).toBeTruthy()
  })
})

describe('Hero highlights', () => {
  function countFor(pos: Position, n = 80) {
    const counts: number[] = []
    for (let i = 0; i < n; i++) {
      const s = new MatchSim(heroMatch(3000 + i, pos), 'en').simulateToEnd()
      if (s.heroStats.minutes >= 90) counts.push(s.heroStats.highlightsPlayed)
    }
    return counts
  }

  it.each(['ST', 'LW', 'RW', 'AM', 'CM', 'DM', 'LB', 'CB', 'GK'] as Position[])('%s gets 4–9 highlights per 90', (pos) => {
    const counts = countFor(pos)
    expect(counts.length).toBeGreaterThan(40)
    for (const c of counts) {
      expect(c).toBeGreaterThanOrEqual(4)
      expect(c).toBeLessThanOrEqual(9)
    }
  })

  it('strikers get more moments than centre-backs', () => {
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(avg(countFor('ST'))).toBeGreaterThan(avg(countFor('CB')) + 1)
  })

  it('kinds depend on position and scenarios are well formed', () => {
    const kinds = (pos: Position) => {
      const out: Record<string, number> = {}
      const sim = (seed: number) => new MatchSim(heroMatch(seed, pos), 'tr')
      for (let i = 0; i < 25; i++) {
        const m = sim(4000 + i)
        while (!m.finished) {
          if (m.pendingHighlight) {
            const h = m.pendingHighlight
            out[h.kind] = (out[h.kind] ?? 0) + 1
            const sc = h.scenario
            expect(sc.kind).toBe(h.kind)
            expect(sc.players.length).toBeGreaterThanOrEqual(10)
            expect(sc.players.length).toBeLessThanOrEqual(22)
            expect(sc.players.filter((p) => p.isHero)).toHaveLength(1)
            expect(sc.timeLimit).toBeGreaterThanOrEqual(8)
            expect(sc.timeLimit).toBeLessThanOrEqual(20)
            expect(sc.prompt.length).toBeGreaterThan(5)
            if (sc.ball.ownerId) expect(sc.players.some((p) => p.id === sc.ball.ownerId)).toBe(true)
            for (const p of sc.players) {
              expect(p.pos.x).toBeGreaterThanOrEqual(0)
              expect(p.pos.x).toBeLessThanOrEqual(PITCH_LENGTH)
              expect(p.pos.y).toBeGreaterThanOrEqual(0)
              expect(p.pos.y).toBeLessThanOrEqual(PITCH_WIDTH)
            }
            m.skipHighlight()
          } else m.step()
        }
      }
      return out
    }
    const gk = kinds('GK')
    expect(Object.keys(gk).every((k) => k === 'gk_save' || k === 'gk_penalty' || k === 'fk_wall')).toBe(true)
    const cb = kinds('CB')
    expect(cb.defend ?? 0).toBeGreaterThan((cb.one_on_one ?? 0) + (cb.cross ?? 0))
    const st = kinds('ST')
    expect((st.one_on_one ?? 0) + (st.counter ?? 0)).toBeGreaterThan(st.defend ?? 0)
  })

  it('refuses to step while a highlight is pending', () => {
    const sim = new MatchSim(heroMatch(11, 'ST'), 'en')
    while (!sim.pendingHighlight && !sim.finished) sim.step()
    expect(sim.pendingHighlight).not.toBeNull()
    const minute = sim.snapshot().minute
    expect(sim.step()).toEqual([])
    expect(sim.snapshot().minute).toBe(minute)
  })

  it('resolving a goal updates score, scorers and hero stats', () => {
    const sim = new MatchSim(heroMatch(12, 'ST'), 'en')
    while (!sim.pendingHighlight || sim.pendingHighlight.kind === 'defend') {
      if (sim.pendingHighlight) sim.skipHighlight()
      else sim.step()
    }
    const before = sim.snapshot()
    const ev = sim.resolveHighlight({ ...blank('goal'), shots: 1, shotsOnTarget: 1 })
    const after = sim.snapshot()
    expect(after.score[0]).toBe(before.score[0] + 1)
    expect(after.heroStats.goals).toBe(before.heroStats.goals + 1)
    expect(after.heroStats.highlightsPlayed).toBe(before.heroStats.highlightsPlayed + 1)
    expect(after.heroStats.rating).toBeGreaterThan(before.heroStats.rating)
    expect(ev.some((e) => e.type === 'goal' && e.playerId === 'hero')).toBe(true)
    sim.simulateToEnd()
    expect(sim.result().scorers.some((s) => s.playerId === 'hero')).toBe(true)
  })

  it('a red card takes the hero off and stops highlights', () => {
    const sim = new MatchSim(heroMatch(13, 'CM'), 'en')
    while (!sim.pendingHighlight) sim.step()
    sim.resolveHighlight({ ...blank('foul_committed'), card: 'red' })
    expect(sim.snapshot().heroOnPitch).toBe(false)
    const played = sim.snapshot().heroStats.highlightsPlayed
    const end = sim.simulateToEnd()
    expect(end.heroStats.highlightsPlayed).toBe(played)
    expect(end.heroStats.red).toBe(1)
  })

  it('a hero on the bench may come on between 55 and 80 minutes', () => {
    let cameOn = 0
    for (let i = 0; i < 120; i++) {
      const setup = makeSetup({ seed: 6000 + i, heroSide: 'home', home: { heroPosition: 'ST', heroOnBench: true } })
      const s = new MatchSim(setup, 'en').simulateToEnd()
      const sub = s.events.find((e) => e.type === 'sub' && e.playerId === 'hero')
      if (!sub) {
        expect(s.heroStats.minutes).toBe(0)
        continue
      }
      cameOn++
      expect(sub.minute).toBeGreaterThanOrEqual(55)
      expect(sub.minute).toBeLessThanOrEqual(80)
      expect(s.heroStats.minutes).toBeLessThanOrEqual(36)
    }
    expect(cameOn / 120).toBeGreaterThan(0.4)
    expect(cameOn / 120).toBeLessThan(0.95)
  })

  it('poor relations reduce highlights and produce "ignored" commentary', () => {
    let good = 0, bad = 0, ignored = 0
    for (let i = 0; i < 60; i++) {
      const g = new MatchSim(makeSetup({ seed: 7000 + i, heroSide: 'home', home: { heroPosition: 'ST', relation: 90 } }), 'en').simulateToEnd()
      const b = new MatchSim(makeSetup({ seed: 7000 + i, heroSide: 'home', home: { heroPosition: 'ST', relation: -90 } }), 'en').simulateToEnd()
      good += g.heroStats.highlightsPlayed
      bad += b.heroStats.highlightsPlayed
      ignored += b.events.filter((e) => e.type === 'commentary' && /ignores|instead of|not look|never comes|not clicking|did not want|other way|alone instead/.test(e.text)).length
    }
    expect(bad).toBeLessThan(good)
    expect(ignored).toBeGreaterThan(10)
  })
})

describe('serialize / restore', () => {
  function drive(sim: MatchSim, steps: number): void {
    for (let i = 0; i < steps && !sim.finished; i++) {
      if (sim.pendingHighlight) sim.skipHighlight()
      else sim.step()
    }
  }

  it('continues identically after a mid-match restore (AI match)', () => {
    const a = new MatchSim(makeSetup({ seed: 99 }), 'en')
    drive(a, 50)
    const b = MatchSim.restore(a.serialize())
    expect(JSON.stringify(a.simulateToEnd())).toBe(JSON.stringify(b.simulateToEnd()))
  })

  it('continues identically with a pending highlight and knockout shootout', () => {
    for (const seed of [101, 102, 103, 104]) {
      const a = new MatchSim(heroMatch(seed, 'AM', { knockout: true }), 'tr')
      drive(a, 40)
      while (!a.pendingHighlight && !a.finished) a.step()
      const json = a.serialize()
      const b = MatchSim.restore(json)
      expect(b.pendingHighlight).toEqual(a.pendingHighlight)
      const ra: MatchSnapshot = a.simulateToEnd()
      const rb: MatchSnapshot = b.simulateToEnd()
      expect(JSON.stringify(rb)).toBe(JSON.stringify(ra))
      expect(b.result()).toEqual(a.result())
    }
  })

  it('serialized state is plain JSON', () => {
    const a = new MatchSim(heroMatch(5, 'ST'), 'en')
    drive(a, 30)
    const json = a.serialize()
    expect(JSON.stringify(JSON.parse(json))).toBe(json)
  })
})

describe('ratings in matches', () => {
  it('hero rating stays within 1–10 even in extreme matches', () => {
    for (const outcome of ['goal', 'conceded', 'lost_ball'] as const) {
      const sim = new MatchSim(heroMatch(55, 'CM'), 'en')
      while (!sim.finished) {
        if (sim.pendingHighlight) sim.resolveHighlight({ ...blank(outcome), passes: 5, passesCompleted: outcome === 'goal' ? 5 : 0 })
        else sim.step()
      }
      const r = sim.snapshot().heroStats.rating
      expect(r).toBeGreaterThanOrEqual(1)
      expect(r).toBeLessThanOrEqual(10)
      expect(sim.result().heroRating).toBe(r)
    }
  })

  it('an average auto-simmed hero rates around 6–8', () => {
    let sum = 0
    for (let i = 0; i < 100; i++) sum += new MatchSim(heroMatch(8000 + i, 'CM'), 'en').simulateToEnd().heroStats.rating
    expect(sum / 100).toBeGreaterThan(6)
    expect(sum / 100).toBeLessThan(8)
  })
})
