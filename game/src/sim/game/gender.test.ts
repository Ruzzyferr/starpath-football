import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { heroGender, worldGender } from '../../core/gender'
import { NAME_POOLS } from '../../data/world/names'
import { generateWorld } from '../world/generate'
import { nameStyleOf } from '../world/players'
import { packState, unpackState } from './persist'
import { makeGame } from './testHelpers'

describe('hero gender', () => {
  it('defaults to male (old saves, omitted input)', () => {
    expect(heroGender(undefined)).toBe('male')
    expect(heroGender({})).toBe('male')
    expect(worldGender({})).toBe('male')
    const s = makeGame(11)
    expect(s.hero.gender).toBe('male')
    expect(s.world.gender).toBeUndefined()
  })

  it('a female hero gets a female world: names, faces, best friend', () => {
    const s = makeGame(11, { gender: 'female' })
    expect(s.hero.gender).toBe('female')
    expect(s.hero.appearance.gender).toBe('female')
    expect(s.world.gender).toBe('female')
    const players = Object.values(s.world.players)
    expect(players.length).toBeGreaterThan(1000)
    for (const p of players.slice(0, 2000)) {
      expect(NAME_POOLS[nameStyleOf(p.nationality)].firstFemale).toContain(p.firstName)
      expect(p.appearance.gender).toBe('female')
      expect(p.appearance.beard).toBe(0)
    }
  })

  it('male worlds are unchanged by the option (same seed → same names)', () => {
    const a = generateWorld(new Rng(5), { season: 2026, heroCountryId: 'TR', countryIds: ['TR'] })
    const b = generateWorld(new Rng(5), { season: 2026, heroCountryId: 'TR', countryIds: ['TR'], gender: 'male' })
    expect(Object.values(a.players).map((p) => p.firstName)).toEqual(Object.values(b.players).map((p) => p.firstName))
    for (const p of Object.values(a.players).slice(0, 300)) expect(NAME_POOLS[nameStyleOf(p.nationality)].first).toContain(p.firstName)
  })

  it('free agents of a female world are female', () => {
    const w = generateWorld(new Rng(9), { season: 2026, heroCountryId: 'TR', countryIds: ['TR'], gender: 'female' })
    const fa = Object.values(w.players).filter((p) => p.clubId === null)
    expect(fa.length).toBeGreaterThan(0)
    for (const p of fa) expect(p.appearance.gender).toBe('female')
  })

  it('the save codec keeps player appearance gender', () => {
    const s = makeGame(3, { gender: 'female' })
    const round = unpackState(JSON.parse(JSON.stringify(packState(s))))
    const p = Object.values(round.world.players)[0]!
    expect(p.appearance.gender).toBe('female')
    expect(round.hero.gender).toBe('female')
  })
})
