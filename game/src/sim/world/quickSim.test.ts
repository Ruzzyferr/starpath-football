import { Rng } from '../../core/rng'
import type { World } from '../../core/types'
import { generateWorld } from './generate'
import { penaltyShootout, quickSimDetailed, quickSimMatch } from './quickSim'
import { clubStrength } from './queries'

let world: World
beforeAll(() => {
  world = generateWorld(new Rng(11), { season: 2026, heroCountryId: 'TR' })
})

function leaguePairs(rng: Rng, leagueId: string): [string, string] {
  const ids = world.leagues[leagueId]!.clubIds
  const a = rng.pick(ids)
  let b = rng.pick(ids)
  while (b === a) b = rng.pick(ids)
  return [a, b]
}

describe('quickSim', () => {
  it('produces realistic score distributions over 2000 league games', () => {
    const rng = new Rng(5)
    const leagues = ['EN1', 'ES2', 'TR1', 'TR3', 'JP1']
    const N = 2000
    let goals = 0, draws = 0, home = 0, away = 0, maxGoals = 0
    for (let i = 0; i < N; i++) {
      const [h, a] = leaguePairs(rng, leagues[i % leagues.length]!)
      const r = quickSimMatch(rng, world.clubs[h]!, world.clubs[a]!, world)
      goals += r.home + r.away
      maxGoals = Math.max(maxGoals, r.home + r.away)
      if (r.home === r.away) draws++
      else if (r.home > r.away) home++
      else away++
      expect(r.scorers.length).toBe(r.home + r.away)
      expect(r.penalties).toBeUndefined()
    }
    expect(goals / N).toBeGreaterThan(2.35)
    expect(goals / N).toBeLessThan(2.9)
    expect(draws / N).toBeGreaterThan(0.2)
    expect(draws / N).toBeLessThan(0.31)
    expect(home).toBeGreaterThan(away) // home advantage
    expect(maxGoals).toBeLessThan(13)
  })

  it('stronger teams win much more often', () => {
    const ids = [...world.leagues.EN1!.clubIds].sort((a, b) => clubStrength(world, b).overall - clubStrength(world, a).overall)
    const best = world.clubs[ids[0]!]
    const worst = world.clubs[ids[ids.length - 1]!]
    const rng = new Rng(9)
    let bestWins = 0, worstWins = 0
    for (let i = 0; i < 400; i++) {
      const r = quickSimMatch(rng, worst!, best!, world)
      if (r.away > r.home) bestWins++
      else if (r.home > r.away) worstWins++
    }
    expect(bestWins).toBeGreaterThan(worstWins * 2.5)
  })

  it('knockout matches always have a winner and penalties only after a draw', () => {
    const rng = new Rng(13)
    let shootouts = 0
    for (let i = 0; i < 500; i++) {
      const [h, a] = leaguePairs(rng, 'DE1')
      const d = quickSimDetailed(rng, world.clubs[h]!, world.clubs[a]!, world, { knockout: true })
      const r = d.result
      if (r.penalties) {
        shootouts++
        expect(r.home).toBe(r.away)
        expect(r.penalties.home).not.toBe(r.penalties.away)
        expect(d.extraTime).toBe(true)
      } else {
        expect(r.home).not.toBe(r.away)
      }
    }
    expect(shootouts).toBeGreaterThan(20)
    expect(shootouts).toBeLessThan(150)
  })

  it('scorers belong to the scoring side (or are own goals by the other side) and are sorted', () => {
    const rng = new Rng(21)
    for (let i = 0; i < 200; i++) {
      const [h, a] = leaguePairs(rng, 'IT1')
      const d = quickSimDetailed(rng, world.clubs[h]!, world.clubs[a]!, world)
      let last = 0
      d.result.scorers.forEach((s, k) => {
        expect(s.minute).toBeGreaterThanOrEqual(last)
        last = s.minute
        const scoringLineup = s.team === 'home' ? d.homeLineup : d.awayLineup
        const otherLineup = s.team === 'home' ? d.awayLineup : d.homeLineup
        expect((s.ownGoal ? otherLineup : scoringLineup).playerIds).toContain(s.playerId)
        const assist = d.assists[k]
        if (assist) {
          expect(scoringLineup.playerIds).toContain(assist)
          expect(assist).not.toBe(s.playerId)
        }
      })
      expect(d.homeLineup.playerIds.length).toBe(11)
      expect(Object.keys(d.ratings).length).toBe(22)
      expect(d.result.motmId).toBeDefined()
    }
  })

  it('is deterministic for the same rng state', () => {
    const [h, a] = ['EN-01', 'EN-02']
    const r1 = quickSimDetailed(new Rng(77), world.clubs[h]!, world.clubs[a]!, world, { knockout: true })
    const r2 = quickSimDetailed(new Rng(77), world.clubs[h]!, world.clubs[a]!, world, { knockout: true })
    expect(r1).toEqual(r2)
  })

  it('penalty shootouts are decisive with plausible scores', () => {
    const rng = new Rng(4)
    for (let i = 0; i < 500; i++) {
      const p = penaltyShootout(rng)
      expect(p.home).not.toBe(p.away)
      expect(Math.max(p.home, p.away)).toBeGreaterThanOrEqual(Math.min(p.home, p.away) + 1)
      expect(Math.max(p.home, p.away)).toBeLessThanOrEqual(20)
    }
  })
})
