import { describe, expect, it } from 'vitest'
import { MemoryStorage, SaveManager } from '../../state/save'
import { START_YEAR } from '../../core/config'
import { heroOvr } from '../career/progression'
import { teammateId } from '../life/relationships'
import { leagueTableFor } from '../world/queries'
import { autoRun, findNonFinite, makeGame } from './testHelpers'
import { advanceDay, advanceToNextMatch, isHeroMatchday } from './calendar'
import { finishHeroMatch, prepareHeroMatch, resumeHeroMatch, saveMatchProgress, startHeroMatch } from './match'
import {
  acceptNegotiation, buyAsset, counterNegotiation, currentNegotiation, doActivity, firstEnabledChoice, playSlots, resolveEventChoice,
  startNegotiation, train,
} from './actions'
import { getOffers } from './season'
import { dashboard } from './summary'
import { loadGame, packedSize, saveGame } from './persist'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const SAVE_BUDGET = 2.5 * 1024 * 1024

describe('newGame', () => {
  it('creates a playable career within the save-size budget', () => {
    const t0 = performance.now()
    const s = makeGame(42)
    const ms = performance.now() - t0
    const size = packedSize(s)
    console.log(`newGame: ${ms.toFixed(0)} ms, save ${(size / 1024).toFixed(0)} KB (unpacked ${(JSON.stringify(s).length / 1024).toFixed(0)} KB), ${Object.keys(s.world.players).length} players, ${Object.keys(s.world.clubs).length} clubs`)
    expect(size).toBeLessThan(SAVE_BUDGET)
    expect(Object.keys(s.world.countries)).toHaveLength(6)
    // Hero placed at a lowest-tier club of his country.
    const club = s.world.clubs[s.hero.contract!.clubId]
    expect(club.countryId).toBe('TR')
    expect(s.world.leagues[club.leagueId].tier).toBe(3)
    expect(s.hero.contract!.untilSeason).toBeGreaterThanOrEqual(START_YEAR + 1)
    // Teammates + manager relationships.
    for (const id of club.squad) expect(s.life.relationships[teammateId(id)]).toBeDefined()
    expect(s.life.relationships.manager?.name).toBe(club.managerName)
    expect(s.calendar).toEqual({ season: START_YEAR, week: 0, day: 0, slot: 0 })
    expect(s.life.log.length).toBeGreaterThan(0)
    expect(s.life.news.length).toBeGreaterThan(0)
    expect(s.pendingEvents.length).toBe(1)
    expect(findNonFinite(s)).toEqual([])
  })

  it('is deterministic for a seed', () => {
    const a = makeGame(7)
    const b = makeGame(7)
    a.meta.createdAt = b.meta.createdAt = 0
    a.meta.updatedAt = b.meta.updatedAt = 0
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('calendar & actions', () => {
  it('activities consume slots, the day rolls over and weekly ticks run', () => {
    const s = makeGame(5)
    s.pendingEvents = []
    const r = train(s, 'shooting', 0.9)
    expect(r.ok).toBe(true)
    expect(s.calendar.slot).toBe(1)
    const r2 = doActivity(s, 'rest')
    expect(r2.ok).toBe(true)
    const money0 = s.life.money
    for (let i = 0; i < 7; i++) advanceDay(s)
    expect(s.calendar.week).toBe(1)
    expect(s.life.money).not.toBe(money0) // wage paid
    expect(buyAsset(s, 'no_such_asset').ok).toBe(false)
  })

  it('stops at matchday and plays an interactive match with save/resume', () => {
    const s = makeGame(9)
    let guard = 0
    while (!isHeroMatchday(s) && guard++ < 100) {
      while (s.pendingEvents.length) resolveEventChoice(s, 0, firstEnabledChoice(s, 0))
      advanceToNextMatch(s)
    }
    expect(isHeroMatchday(s)).toBe(true)
    const prep = prepareHeroMatch(s)!
    expect(prep).not.toBeNull()
    const heroTeam = prep.setup[prep.setup.heroSide!]
    expect([...heroTeam.lineup, ...heroTeam.bench].filter((p) => p.isHero)).toHaveLength(1)
    expect(heroTeam.lineup).toHaveLength(11)
    // Same prep on a second call (selection rolled once).
    expect(prepareHeroMatch(s)!.starts).toBe(prep.starts)
    const sim = startHeroMatch(s)!
    for (let i = 0; i < 30; i++) sim.pendingHighlight ? sim.skipHighlight() : sim.step()
    saveMatchProgress(s, sim)
    const restored = resumeHeroMatch(JSON.parse(JSON.stringify(s)))!
    expect(restored.snapshot().minute).toBe(sim.snapshot().minute)
    restored.simulateToEnd(true)
    const apps0 = s.hero.seasonStats.apps
    const rep = finishHeroMatch(s, restored)
    expect(s.activeMatchId).toBeNull()
    expect(prep.fixture.result).not.toBeNull()
    expect(rep.lines.length).toBeGreaterThan(0)
    expect(s.hero.seasonStats.apps).toBeGreaterThanOrEqual(apps0)
    expect(typeof s.life.flags.last_match_goals).toBe('number')
  })
})

describe('casino & negotiation', () => {
  it('casino games need a visit and settle money', () => {
    const s = makeGame(11)
    s.pendingEvents = []
    s.life.money = 5000
    expect(playSlots(s, 10).ok).toBe(false)
    s.calendar.slot = 2
    s.calendar.day = 1
    // Under 18: turned away at the door, and the games refuse too.
    s.hero.birthYear = s.calendar.season - 17
    expect(doActivity(s, 'casino').ok).toBe(false)
    expect(playSlots(s, 10).ok).toBe(false)
    s.hero.birthYear = s.calendar.season - 20
    const v = doActivity(s, 'casino')
    expect(v.ok).toBe(true)
    const m0 = s.life.money
    const spin = playSlots(s, 10)
    expect(spin.ok).toBe(true)
    expect(s.life.money).toBe(m0 - 10 + spin.value!.payout)
    expect(playSlots(s, 1e9).ok).toBe(false)
    advanceDay(s)
    expect(playSlots(s, 10).ok).toBe(false) // casino closed next day
  })

  it('negotiates and signs an offer', () => {
    const s = makeGame(3)
    autoRun(s, (x) => getOffers(x).length > 0, 3000)
    const offer = getOffers(s)[0]
    expect(offer).toBeDefined()
    const st = startNegotiation(s, offer.id)
    expect(st.ok).toBe(true)
    const c = counterNegotiation(s, { wage: Math.round(offer.contract.terms.wage * 1.05) })
    expect(c.ok).toBe(true)
    if (currentNegotiation(s)) expect(acceptNegotiation(s).ok).toBe(true)
    expect(s.hero.contract?.clubId).toBe(offer.clubId)
    expect(getOffers(s).some((o) => o.id === offer.id)).toBe(false)
  })
})

describe('full season', () => {
  it('auto-plays a full season sanely and round-trips through the save system', async () => {
    const s = makeGame(2026)
    const t0 = performance.now()
    const stats = autoRun(s, (x) => x.calendar.season > START_YEAR)
    const ms = performance.now() - t0
    const json = JSON.stringify(s)
    const size = packedSize(s)
    console.log(`season: ${ms.toFixed(0)} ms (${(ms / Math.max(1, stats.days)).toFixed(1)} ms/day over ${stats.days} days), hero matches ${stats.heroMatches}, events ${stats.events}, save ${(size / 1024).toFixed(0)} KB, OVR ${heroOvr(s.hero)}, money ${Math.round(s.life.money)}`)
    expect(s.calendar.season).toBe(START_YEAR + 1)
    expect(s.calendar.week).toBe(0)
    expect(findNonFinite(s)).toEqual([])
    expect(s.life.money).toBeGreaterThan(-1)
    expect(s.life.money).toBeLessThan(1e8)
    expect(s.hero.history).toHaveLength(1)
    expect(s.hero.history[0].season).toBe(START_YEAR)
    expect(s.hero.history[0].stats.apps).toBe(s.hero.careerStats.apps)
    expect(stats.heroMatches).toBeGreaterThan(20)
    expect(s.world.honours.some((h) => h.season === START_YEAR)).toBe(true)
    // New season competitions exist with complete tables.
    const club = s.hero.contract ? s.world.clubs[s.hero.contract.clubId] : Object.values(s.world.clubs)[0]
    const t = leagueTableFor(s.world, club.id, START_YEAR + 1)!
    expect(t.rows.length).toBe(s.world.leagues[club.leagueId].clubIds.length)
    expect(size).toBeLessThan(SAVE_BUDGET)
    const d = dashboard(s)
    expect(d.nextFixture).not.toBeNull()

    const mgr = new SaveManager(new MemoryStorage())
    await saveGame(mgr, 0, s, 123)
    const loaded = await loadGame(mgr, 0)
    expect(loaded.ok).toBe(true)
    if (loaded.ok) expect(loaded.state).toEqual(JSON.parse(JSON.stringify(s)))
    expect((await mgr.summaries())[0]?.heroName).toBe('Arda Yıldız')
    void json
  }, 60_000)
})

describe.skipIf(!env.SOAK)('soak', () => {
  it('runs 5 seasons without breaking', () => {
    const s = makeGame(77)
    const t0 = performance.now()
    const stats = autoRun(s, (x) => x.calendar.season >= START_YEAR + 5, 40_000, true)
    const ms = performance.now() - t0
    const size = packedSize(s)
    console.log(`soak 5 seasons: ${(ms / 1000).toFixed(1)} s, matches ${stats.heroMatches}, events ${stats.events}, save ${(size / 1024).toFixed(0)} KB, OVR ${heroOvr(s.hero)}, money ${Math.round(s.life.money)}, history ${s.hero.history.length}, signed ${stats.signed}, clubs ${s.hero.history.map((h) => h.clubName).join(' > ')}, wage ${s.hero.contract?.wage}`)
    expect(s.life.money).toBeGreaterThan(-1)
    expect(s.calendar.season).toBe(START_YEAR + 5)
    expect(s.hero.history).toHaveLength(5)
    expect(findNonFinite(s)).toEqual([])
    expect(size).toBeLessThan(SAVE_BUDGET)
  }, 300_000)
})
