import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { START_YEAR } from '../../core/config'
import { CREST_BLACKLIST, crestBlacklisted, generateWorld, hueFamily } from './generate'

const world = generateWorld(new Rng(77), { season: START_YEAR, heroCountryId: 'TR', countryIds: ['TR', 'EN', 'ES', 'DE'] })

describe('2.6#11 crest similarity', () => {
  it('no two clubs of a country share shape, symbol and primary colour', () => {
    const seen = new Map<string, string>()
    const clash: string[] = []
    for (const c of Object.values(world.clubs)) {
      const key = `${c.countryId}|${c.crest.shape}|${c.crest.symbol}|${c.crest.colors[0]}`
      const other = seen.get(key)
      if (other) clash.push(`${other}~${c.id}`)
      seen.set(key, c.id)
    }
    expect(clash).toEqual([])
  })
})

describe('2.12#13 crest blacklist', () => {
  it('no generated club wears a blacklisted (real-club-like) crest', () => {
    const bad = Object.values(world.clubs).filter((c) => crestBlacklisted(c.crest.shape, c.crest.symbol, c.crest.colors[0]!)).map((c) => c.id)
    expect(bad).toEqual([])
  })
  it('the blacklist matches by shape, symbol and colour family', () => {
    expect(CREST_BLACKLIST.length).toBeGreaterThanOrEqual(8)
    expect(hueFamily('#1d4ed8')).toBe('blue')
    expect(crestBlacklisted('shield', 7, '#1d4ed8')).toBe(true)
    expect(crestBlacklisted('shield', 7, '#16a34a')).toBe(false)
    expect(crestBlacklisted('hexagon', 7, '#1d4ed8')).toBe(false)
  })
})

import { quickSimMatch } from './quickSim'
import { clubStrength } from './queries'

describe('2.6#18 cup upset rate', () => {
  it('knockout ties between a top-tier and a bottom-tier club give a plausible upset rate (dog hosts: home edge included)', () => {
    const t1 = world.leagues.EN1!.clubIds.map((id) => world.clubs[id]!)
    const t3 = world.leagues.EN2!.clubIds.map((id) => world.clubs[id]!)
    const strongest = [...t1].sort((a, b) => clubStrength(world, b.id).overall - clubStrength(world, a.id).overall).slice(0, 6)
    const weakest = [...t3].sort((a, b) => clubStrength(world, a.id).overall - clubStrength(world, b.id).overall).slice(0, 6)
    const rng = new Rng(2025)
    let upsets = 0
    let n = 0
    for (let i = 0; i < 1000; i++) {
      const fav = strongest[i % strongest.length]!
      const dog = weakest[(i * 7) % weakest.length]!
      const r = quickSimMatch(rng, dog, fav, world, { knockout: true })
      const dogWon = r.home > r.away || (r.home === r.away && !!r.penalties && r.penalties.home > r.penalties.away)
      if (dogWon) upsets++
      n++
    }
    const rate = upsets / n
    expect(rate).toBeGreaterThan(0.02)
    expect(rate).toBeLessThan(0.35)
  })
})
