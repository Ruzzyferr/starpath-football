import { Rng } from '../../core/rng'
import type { NpcPlayer, World } from '../../core/types'
import { FORMATION_SLOTS, FORMATIONS, positionFamiliarity, selectLineupFromPlayers } from './formations'
import { generateWorld } from './generate'
import { createNpcPlayer } from './players'
import {
  clubFixtures, clubStrength, leagueTableFor, matchKits, nextFixtureFor, playerDisplayName, selectLineup, sortedSquad,
} from './queries'

let world: World
beforeAll(() => {
  world = generateWorld(new Rng(3), { season: 2026, heroCountryId: 'TR', countryIds: ['TR', 'EN', 'ES', 'DE'] })
})

describe('lineup selection', () => {
  it.each(FORMATIONS)('picks 11 distinct players with GK first for %s', (formation) => {
    for (const clubId of world.leagues.EN1.clubIds.slice(0, 5)) {
      const l = selectLineup(world, clubId, formation)
      expect(l.playerIds.length).toBe(11)
      expect(new Set([...l.playerIds, ...l.bench]).size).toBe(11 + l.bench.length)
      expect(l.slots).toEqual(FORMATION_SLOTS[formation])
      expect(world.players[l.playerIds[0]].position).toBe('GK')
      expect(l.bench.length).toBe(7)
      expect(l.bench.some((id) => world.players[id].position === 'GK')).toBe(true)
    }
  })

  it('respects exclusions and injuries', () => {
    const clubId = world.leagues.TR1.clubIds[0]
    const first = selectLineup(world, clubId)
    const excluded = new Set(first.playerIds.slice(0, 3))
    const second = selectLineup(world, clubId, undefined, excluded)
    for (const id of excluded) expect(second.playerIds).not.toContain(id)
    const injured = world.players[first.playerIds[5]]
    injured.injuredWeeks = 3
    expect(selectLineup(world, clubId).playerIds).not.toContain(injured.id)
    injured.injuredWeeks = 0
  })

  it('prefers natural positions but plays the best available', () => {
    const rng = new Rng(1)
    const mk = (id: string, position: NpcPlayer['position'], ovr: number) =>
      createNpcPlayer(rng, { id, nationality: 'EN', position, age: 25, season: 2026, ovr, clubId: 'c' })
    const players = [
      mk('gk', 'GK', 70), mk('gk2', 'GK', 60), mk('cb1', 'CB', 70), mk('cb2', 'CB', 70), mk('lb', 'LB', 70), mk('rb', 'RB', 70),
      mk('cm1', 'CM', 70), mk('cm2', 'CM', 70), mk('dm', 'DM', 70), mk('lw', 'LW', 70), mk('rw', 'RW', 70),
      mk('st', 'ST', 50), mk('am', 'AM', 85),
    ]
    const l = selectLineupFromPlayers(players, '4-3-3')
    expect(l.playerIds[0]).toBe('gk')
    // 85 AM at ST (0.85 → 72) beats the 50-rated natural striker
    expect(l.playerIds[l.slots.indexOf('ST')]).toBe('am')
    expect(positionFamiliarity('GK', 'ST')).toBeLessThan(0.3)
    expect(positionFamiliarity('LB', 'RB')).toBeGreaterThan(0.85)
  })
})

describe('queries', () => {
  it('reports club strength, tables and fixtures', () => {
    const clubId = world.leagues.EN1.clubIds[0]
    const s = clubStrength(world, clubId)
    expect(s.overall).toBeGreaterThan(60)
    const t = leagueTableFor(world, clubId, 2026)
    expect(t?.rows.length).toBe(world.leagues.EN1.clubIds.length)
    expect(t?.position).toBeGreaterThanOrEqual(1)
    const fixtures = clubFixtures(world, clubId, 2026)
    expect(fixtures.filter((f) => f.competition.type === 'league').length).toBe((world.leagues.EN1.clubIds.length - 1) * 2)
    for (let i = 1; i < fixtures.length; i++) {
      const a = fixtures[i - 1].fixture
      const b = fixtures[i].fixture
      expect(a.week * 7 + a.day).toBeLessThan(b.week * 7 + b.day) // never two games on one day
    }
    const next = nextFixtureFor(world, clubId, 2026, 0, 0)
    expect(next?.fixture.id).toBe(fixtures[0].fixture.id)
    const later = nextFixtureFor(world, clubId, 2026, 20, 0)
    expect(later?.fixture.week).toBeGreaterThanOrEqual(20)
  })

  it('formats names and sorts squads', () => {
    const p = { firstName: 'Arda', lastName: 'Yılmaz' }
    expect(playerDisplayName(p)).toBe('A. Yılmaz')
    expect(playerDisplayName(p, 'full')).toBe('Arda Yılmaz')
    expect(playerDisplayName(p, 'last')).toBe('Yılmaz')
    expect(playerDisplayName(undefined)).toBe('—')
    const squad = sortedSquad(world, world.leagues.ES1.clubIds[0])
    expect(squad[0].position).toBe('GK')
    expect(squad[squad.length - 1].position).toBe('ST')
  })

  it('switches the away kit on a colour clash', () => {
    const [a, b] = [world.clubs[world.leagues.DE1.clubIds[0]], world.clubs[world.leagues.DE1.clubIds[1]]]
    const clone = { ...b, colors: { ...a.colors } }
    expect(matchKits(a, clone).away).toBe(clone.awayColors)
  })
})
