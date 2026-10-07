import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { START_YEAR } from '../../core/config'
import { generateWorld } from './generate'
import { endOfSeason } from './season'

describe('club records and manager changes', () => {
  it('fills records and replaces managers after a season, deterministically', () => {
    const run = () => {
      const w = generateWorld(new Rng('mgr-test'), { season: START_YEAR, heroCountryId: 'TR', countryIds: ['TR', 'EN', 'PT', 'NL'] })
      const before = Object.fromEntries(Object.values(w.clubs).map((c) => [c.id, c.managerName]))
      endOfSeason(w, new Rng('eos'), START_YEAR)
      return { w, before }
    }
    const { w, before } = run()
    const clubs = Object.values(w.clubs)
    expect(Object.keys(w.records ?? {}).length).toBeGreaterThan(clubs.length * 0.9)
    expect(clubs.some((c) => (w.records?.[c.id]?.titles ?? 0) > 0)).toBe(true)
    expect(clubs.some((c) => w.records?.[c.id]?.biggestWin)).toBe(true)
    const changes = w.managerChanges ?? []
    expect(changes.length).toBeGreaterThan(0)
    expect(changes.length).toBeLessThan(clubs.length * 0.5)
    for (const ch of changes) { expect(before[ch.clubId]).toBe(ch.from); expect(w.clubs[ch.clubId]!.managerName).toBe(ch.to) }
    expect(run().w.managerChanges).toEqual(changes)
  })
})
