import { describe, expect, it } from 'vitest'
import { installMod, validateModPack, type InstalledMod } from './mods'
import { makeGame } from './testHelpers'

const pack = (extra: object = {}) => ({
  format: 'starpath-mod', id: 'rename-pack', version: '1.0.0', name: 'Rename pack',
  world: {
    leagues: [{ id: 'TR1', name: 'Mod Superleague' }],
    clubs: [{ id: 'TR-01', name: 'Test Rovers', shortName: 'TRV', city: 'Moddington', primary: '#112233', secondary: '#FFEEDD', stadium: 'Mod Park' }],
  },
  names: [{ style: 'turkish', first: ['Modalp', 'Modcan', 'Modege', 'Modkaan', 'Modsel', 'Modtuna', 'Modyigit', 'Modzeki'], last: ['Modoglu', 'Modkaya', 'Modtepe', 'Modsoy', 'Modak', 'Modbey', 'Moddag', 'Modgul'] }],
  ...extra,
})
const installed = (p: object): InstalledMod[] => {
  const r = validateModPack(JSON.stringify(p))
  expect(r.errors).toEqual([])
  return installMod([], r.pack!, false, 100, 0).list
}

describe('2.10#60 mod world overrides on new careers', () => {
  it('validates the world section (shapes, whitelist, real names)', () => {
    expect(validateModPack(JSON.stringify(pack())).ok).toBe(true)
    const bad = (w: object) => validateModPack(JSON.stringify(pack({ world: w }))).errors.join(' | ')
    expect(bad({ clubs: [{ id: 'xx', name: 'A' }] })).toMatch(/must look like TR-01/)
    expect(bad({ clubs: [{ id: 'TR-01', shortName: 'ab' }] })).toMatch(/3 capital letters/)
    expect(bad({ clubs: [{ id: 'TR-01', primary: 'red' }] })).toMatch(/#RRGGBB/)
    expect(bad({ clubs: [{ id: 'TR-01', hax: 1 }] })).toMatch(/unknown field "hax"/)
    expect(bad({ leagues: [{ id: 'TR1', name: 'Real Madrid' }] })).toMatch(/looks real/)
    expect(bad({ script: 'x' })).toMatch(/unknown field "script"/)
  })

  it('renames league, club and sprinkles mod names over a new career; deterministic; no mods = untouched', () => {
    const mods = installed(pack())
    const plain = makeGame(77)
    const a = makeGame(77, { mods })
    const b = makeGame(77, { mods })
    expect(JSON.stringify(a.world)).toBe(JSON.stringify(b.world))
    expect(a.world.leagues.TR1.name).toBe('Mod Superleague')
    const c = a.world.clubs['TR-01']
    expect(c).toMatchObject({ name: 'Test Rovers', shortName: 'TRV', city: 'Moddington' })
    expect(c.colors.primary).toBe('#112233')
    expect(c.crest.colors[0]).toBe('#112233')
    expect(c.stadium.name).toBe('Mod Park')
    expect(c.stadium.capacity).toBe(plain.world.clubs['TR-01'].stadium.capacity)
    expect(a.world.competitions[`L-${a.calendar.season}-TR1`].name.en).toBe('Mod Superleague')
    const modNamed = Object.values(a.world.players).filter((p) => p.firstName.startsWith('Mod') || p.lastName.startsWith('Mod'))
    expect(modNamed.length).toBeGreaterThan(20)
    expect(modNamed.every((p) => plain.world.players[p.id].nationality === 'TR' || p.nationality === 'TR')).toBe(true)
    // Same players, same ratings: only names differ.
    expect(Object.keys(a.world.players)).toEqual(Object.keys(plain.world.players))
    expect(a.world.players.p0.ovr).toBe(plain.world.players.p0.ovr)
    // A mod-free career is byte-identical to before.
    expect(JSON.stringify(makeGame(77, { mods: [] }).world)).toBe(JSON.stringify(plain.world))
    // Disabled mods change nothing.
    expect(JSON.stringify(makeGame(77, { mods: mods.map((m) => ({ ...m, enabled: false })) }).world)).toBe(JSON.stringify(plain.world))
  })

  it('refuses overrides that would duplicate a name or code inside a country', () => {
    const plain = makeGame(78)
    const other = plain.world.clubs['TR-02']
    const mods = installed(pack({ world: { clubs: [{ id: 'TR-01', name: other.name, shortName: other.shortName }] }, names: undefined }))
    const g = makeGame(78, { mods })
    expect(g.world.clubs['TR-01'].name).toBe(plain.world.clubs['TR-01'].name)
    expect(g.world.clubs['TR-01'].shortName).toBe(plain.world.clubs['TR-01'].shortName)
  })
})
