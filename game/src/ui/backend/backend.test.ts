/**
 * End-to-end integration of the REAL backend (no DOM): the UI's GameActions
 * and GameData over the actual simulation, driven like a player would.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Rng } from '../../core/rng'
import { ASSETS } from '../../data/assets'
import { generateContractOffer } from '../../sim/career/contract'
import { getOffers } from '../../sim/game'
import { clubContextOf } from '../../sim/game/internal'
import { setOffers } from '../../sim/game/season'
import { findNonFinite } from '../../sim/game/testHelpers'
import { MemoryStorage } from '../../state/save'
import { blackjack, gameState, installBackend, match, negotiation, pendingNav } from '../store'
import { DEFAULT_CAREER } from './index'
import { MS_PER_MINUTE } from './liveMatch'
import { flushAutosave, useStorage } from './persistence'
import { quickResolveAll } from './benchPath'
import { realActions as A } from './realActions'
import { realData as D } from './realData'

const S = () => {
  const s = gameState.value
  if (!s) throw new Error('no state')
  return s
}

function clearEvents(): number {
  quickResolveAll() // daily agenda: mandatory tasks block Advance (backend/benchPath)
  let n = 0
  while (S().pendingEvents.length > 0 && n < 20) {
    const v = D.eventView(0)
    expect(v).not.toBeNull()
    const pick = Math.max(0, v!.choices.findIndex((c) => !c.requirement || c.requirement.met))
    const out = A.resolveEvent(0, pick)
    expect(out.text.en.length).toBeGreaterThan(0)
    n++
  }
  return n
}

describe('real backend end to end', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    useStorage(new MemoryStorage())
    installBackend({ actions: A, data: D })
  })
  afterAll(() => {
    vi.useRealTimers()
  })

  it('plays a career loop: plan → match → events → shop → casino → contract → save/load', async () => {
    // ── New career ──
    A.newGame({ ...DEFAULT_CAREER, birthYear: 2006, seed: 777 }) // 20: aged to 21 before the casino step
    const s0 = S()
    expect(s0.meta.slot).toBe(1)
    expect(D.heroOvr()).toBeGreaterThan(30)
    expect(D.countries().length).toBeGreaterThanOrEqual(10)
    expect(D.squad().length).toBeGreaterThan(15)
    expect(D.squad().every((m) => m.relation !== null)).toBe(true)
    expect(D.fixtures().length).toBeGreaterThan(20)
    expect(D.perks().length).toBeGreaterThan(20)
    expect(D.trainingSessions().length).toBeGreaterThanOrEqual(7)
    expect(D.trainerOffers().length).toBeGreaterThan(0)
    const club = S().world.clubs[S().hero.contract!.clubId]!
    expect(D.leagueTable(club.leagueId)?.length).toBe(club ? S().world.leagues[club.leagueId]!.clubIds.length : 0)
    expect(D.ovrHistory().length).toBeGreaterThanOrEqual(2)
    for (const it of D.interest()) expect(it.club.name).toBeTruthy()
    expect(D.socialFeed().length).toBeGreaterThan(0)
    expect(D.socialFeed().every((p) => !/undefined|NaN/.test(p.text.en + p.handle))).toBe(true)

    // ── Plan the day and advance ──
    clearEvents()
    const acts = D.activities()
    expect(acts.length).toBeGreaterThan(20)
    for (const a of acts) {
      expect(Number.isFinite(a.energy)).toBe(true)
      expect(a.name.en).toBeTruthy()
    }
    const morning = acts.find((a) => a.available && a.category === 'training' && a.id.startsWith('train_'))!
    expect(morning).toBeDefined()
    A.planSlot(0, morning.id)
    expect(D.dayPlan().slots[0]!.activityId).toBe(morning.id)
    const energy0 = S().life.energy
    A.advance()
    expect(S().calendar.slot).toBe(1)
    expect(S().life.energy).toBeLessThan(energy0)
    expect(D.dayPlan().slots[0]).toMatchObject({ state: 'done', activityId: morning.id })

    // ── Advance to matchday ──
    for (let i = 0; i < 15; i++) {
      clearEvents()
      const fx = D.nextFixture()
      if (fx?.daysUntil === 0 && S().calendar.slot >= 1) break
      A.advanceToMatch()
    }
    clearEvents()
    const fx = D.nextFixture()!
    expect(fx.daysUntil).toBe(0)
    expect(D.dayPlan().slots[1]!.state).toBe('match')

    // ── Live match, every moment simmed ──
    A.playMatch()
    expect(match.value).not.toBeNull()
    const pre = D.preMatch()!
    expect(pre.homeLineup).toHaveLength(11)
    expect(pre.awayLineup).toHaveLength(11)
    expect(pre.homeLineup.concat(pre.awayLineup).some((p) => p.isHero) || !pre.heroStarting).toBe(true)
    A.matchSetSpeed(4)
    A.matchPause(false)
    let moments = 0
    for (let guard = 0; guard < 400 && !match.value!.finished; guard++) {
      if (match.value!.pendingMoment) {
        A.simMoment()
        moments++
      } else if (match.value!.decision) A.matchDecide(match.value!.decision.fallback)
      else vi.advanceTimersByTime(MS_PER_MINUTE[4])
    }
    const m = match.value!
    expect(m.finished).toBe(true)
    expect(m.minute).toBeGreaterThanOrEqual(90)
    expect(m.events.some((e) => e.type === 'fulltime')).toBe(true)
    console.log(`match: ${m.score.join('-')}, moments simmed ${moments}, hero rating ${m.heroStats.rating}`)

    // ── Post-match ──
    const post = D.postMatch()!
    expect(post).not.toBeNull()
    expect(post.score).toEqual(m.score)
    expect(Number.isFinite(post.rating)).toBe(true)
    expect(post.motm.name).not.toMatch(/undefined/)
    if (post.interview) {
      expect(post.interview.options).toHaveLength(4)
      const d = A.answerInterview('humble')
      expect(Array.isArray(d)).toBe(true)
      expect(D.postMatch()!.interview).toBeNull()
    }
    A.finishMatch()
    expect(D.postMatch()).toBeNull()
    expect(match.value).toBeNull()
    const played = D.fixtures().find((f) => f.fixtureId === fx.fixtureId)!
    expect(played.result).not.toBeNull()
    expect(D.formHistory().length).toBeGreaterThanOrEqual(post.stats.minutes > 0 ? 1 : 0)

    // ── Resolve an event ──
    for (let i = 0; i < 40 && S().pendingEvents.length === 0; i++) { quickResolveAll(); A.advance() }
    expect(S().pendingEvents.length).toBeGreaterThan(0)
    const ev = D.eventView(0)!
    expect(ev.title.en).not.toMatch(/\{\w+\}/)
    expect(ev.choices.length).toBeGreaterThan(0)
    const ci = Math.max(0, ev.choices.findIndex((c) => !c.requirement || c.requirement.met))
    const out = A.resolveEvent(0, ci)
    expect(out.success).toBe(true)
    clearEvents()

    // ── Buy an asset (top up cash to afford the cheapest item) ──
    const cheapest = [...ASSETS].filter((a) => (a.minReputation ?? 0) <= S().hero.reputation).sort((a, b) => a.price - b.price)[0]!
    S().life.money += cheapest.price + 5000
    const owned0 = S().life.assets.length
    expect(A.buy(cheapest.id)).toBe(true)
    expect(S().life.assets.length).toBe(owned0 + 1)

    // ── Casino: blackjack round in the evening ──
    for (let i = 0; i < 4 && S().calendar.slot < 2; i++) {
      clearEvents()
      A.advance()
    }
    clearEvents()
    S().life.energy = Math.max(S().life.energy, 40)
    S().life.money = Math.max(S().life.money, 2000)
    const money0 = S().life.money
    S().hero.injury = null // casino is not open to injured heroes; this step tests the games
    S().hero.birthYear = S().calendar.season - 21 // casino is 21+
    let bj = A.casino.blackjackDeal(100)
    expect(bj.player.length).toBe(2)
    for (let i = 0; i < 10 && bj.phase === 'player'; i++) bj = A.casino.blackjackStand()
    expect(bj.phase).toBe('done')
    expect(bj.result).not.toBeNull()
    expect(blackjack.value?.phase).toBe('done')
    expect(Math.round(S().life.money - money0)).toBe(bj.payout)
    expect(D.casinoStatus().visitsThisWeek).toBeGreaterThan(0)
    expect(D.horses()).toHaveLength(8)

    // ── Contract negotiation: use a real offer if any, else table a transfer offer from a league rival ──
    if (getOffers(S()).length === 0) {
      const own = S().world.clubs[S().hero.contract!.clubId]!
      const rival = Object.values(S().world.clubs).find((c) => c.id !== own.id && c.leagueId === own.leagueId)!
      const contract = generateContractOffer(new Rng(5), S().hero, { club: clubContextOf(S(), rival.id), season: S().calendar.season, kind: 'transfer' })
      setOffers(S(), [{ id: 'test-offer', clubId: rival.id, clubName: rival.name, fee: 25_000, isLoan: false, viaReleaseClause: false, contract }])
    }
    const offer = getOffers(S())[0]!
    A.openNegotiation(offer.clubId)
    const n = negotiation.value!
    expect(n.status).toBe('open')
    expect(n.club.id).toBe(offer.clubId)
    A.proposeTerms({ ...n.clubOffer, wage: Math.round(n.clubOffer.wage * 1.05) })
    if (negotiation.value!.status === 'open') A.acceptOffer()
    expect(negotiation.value!.status).toBe('accepted')
    expect(S().hero.contract!.clubId).toBe(offer.clubId)
    expect(D.squad().length).toBeGreaterThan(15)
    console.log(`negotiation with ${n.club.name}: ${negotiation.value!.status}, wage ${S().hero.contract!.wage}`)

    // ── Save → load → equality ──
    expect(findNonFinite(S())).toEqual([])
    await A.save()
    await flushAutosave()
    const slots = D.saveSlots()
    expect(slots[0]!.empty).toBe(false)
    expect(slots[0]!.heroName).toBe('Arda Yıldız')
    const before = S()
    const key = JSON.stringify({
      hero: before.hero, cal: before.calendar, money: before.life.money, assets: before.life.assets, rels: before.life.relationships,
      events: before.pendingEvents, rng: before.rng, players: Object.keys(before.world.players).length, flags: before.life.flags,
    })
    expect(await A.load(1)).toBe(true)
    const after = S()
    expect(after).not.toBe(before)
    const key2 = JSON.stringify({
      hero: after.hero, cal: after.calendar, money: after.life.money, assets: after.life.assets, rels: after.life.relationships,
      events: after.pendingEvents, rng: after.rng, players: Object.keys(after.world.players).length, flags: after.life.flags,
    })
    expect(key2).toBe(key)
    expect(D.nextFixture()).not.toBeNull()

    // Export / import round trip into slot 3.
    const json = await A.exportSave(1)
    expect(await A.importSave(json, 3)).toBe(true)
    expect(D.saveSlots()[2]!.empty).toBe(false)
  }, 120_000)

  it('reaches the end of the season and serves the season review', () => {
    A.newGame({ ...DEFAULT_CAREER, birthYear: 2005, seed: 4242 }) // 21: casino is 21+
    pendingNav.value = null
    let matches = 0
    for (let i = 0; i < 600 && pendingNav.value !== 'seasonEnd'; i++) {
      clearEvents()
      const fx = D.nextFixture()
      if (fx?.daysUntil === 0 && S().calendar.slot >= 1) {
        A.advance() // skip → the sim plays the hero's match
        matches++
      } else A.advanceToMatch()
    }
    expect(pendingNav.value).toBe('seasonEnd')
    const sum = D.seasonSummary()!
    expect(sum).not.toBeNull()
    expect(sum.stats.apps).toBeGreaterThan(0)
    expect(sum.leaguePosition).toBeGreaterThan(0)
    expect(sum.awards.length).toBeGreaterThan(0)
    expect(Number.isFinite(sum.ovrEnd) && Number.isFinite(sum.moneyEarned)).toBe(true)
    expect(D.ovrHistory().length).toBeGreaterThan(10)
    expect(D.netWorthHistory().length).toBeGreaterThan(10)
    expect(D.transferNews().length).toBeGreaterThan(0)
    expect(D.topScorers(S().world.clubs[S().hero.contract?.clubId ?? '']?.leagueId ?? '').length).toBeGreaterThanOrEqual(0)
    A.continueSeason()
    expect(pendingNav.value).toBeNull()
    expect(findNonFinite(S())).toEqual([])
    console.log(`season done: ${matches} hero matches skipped/simmed, apps ${sum.stats.apps}, goals ${sum.stats.goals}, pos ${sum.leaguePosition}`)
  }, 240_000)
})
