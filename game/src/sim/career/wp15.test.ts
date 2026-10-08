import { Rng } from '../../core/rng'
import { absWeek } from './common'
import { counterOffer, extraBonusLimits, generateContractOffer, startNegotiation, toContract, type ClubContext } from './contract'
import { applyInjury, injuryInsurancePayout } from './condition'
import { MINUTES_GUARANTEE_START, startProbability } from './squadRole'
import { makeHeroLife, makeState } from './testFixtures'
import { breakTermDeposit, netWorth, openTermDeposit, termInterest, weeklyEconomy, IMAGE_RIGHTS_BONUS } from '../life/economy'
import { goalkeeperAwardScore } from '../world/awards'
import { applyMatchToHero } from './matchOutcome'
import { buildCareerSummary, legacyScore, POST_CAREER } from '../game/hallOfFame'

const club: ClubContext = { clubId: 'c1', clubName: 'Test FC', reputation: 70, squadAvgOvr: 60 }

function open(seed: number, role: 'reserve' | 'star') {
  const { hero, life } = makeHeroLife()
  const offer = generateContractOffer(new Rng(seed), hero, { club, season: 2026 })
  offer.terms.role = role
  return { hero, life, st: startNegotiation(new Rng(seed), offer, hero, { season: 2026 }) }
}

describe('WP-15 contract clauses', () => {
  it('insurance is granted and pays out on injury', () => {
    const { hero, life, st } = open(5, 'reserve')
    const step = counterOffer(new Rng(1), st, { insurance: true })
    expect(['agreed', 'open']).toContain(step.state.status)
    expect(step.state.offer.terms.insurance).toBe(true)
    hero.contract = { ...toContract(step.state.offer), wage: 1000 }
    const before = life.money
    applyInjury(hero, life, { name: { tr: 'x', en: 'x' }, weeksLeft: 4, severity: 2 })
    expect(life.money - before).toBe(3000)
    expect(injuryInsurancePayout({ contract: { ...hero.contract, insurance: false } }, { severity: 3 })).toBe(0)
  })

  it('minutes guarantee and image rights are refused to a reserve, granted to a star', () => {
    const lo = open(7, 'reserve')
    const refused = counterOffer(new Rng(1), lo.st, { minutesGuarantee: true, imageRights: true })
    expect(refused.state.offer.terms.minutesGuarantee).not.toBe(true)
    expect(refused.state.offer.terms.imageRights).not.toBe(true)
    const hi = open(7, 'star')
    const ok = counterOffer(new Rng(2), hi.st, { minutesGuarantee: true, imageRights: true })
    expect(ok.state.offer.terms.minutesGuarantee).toBe(true)
    expect(ok.state.offer.terms.imageRights).toBe(true)
  })

  it('minutes guarantee lifts the start probability floor', () => {
    const { hero, life } = makeHeroLife()
    hero.contract = { clubId: 'c1', wage: 1000, untilSeason: 2030, signingBonus: 0, goalBonus: 0, assistBonus: 0, releaseClause: null, role: 'reserve' }
    hero.fatigue = 0
    const base = startProbability(hero, life)
    hero.contract.minutesGuarantee = true
    expect(startProbability(hero, life)).toBeGreaterThanOrEqual(MINUTES_GUARANTEE_START)
    expect(startProbability(hero, life)).toBeGreaterThan(base)
  })

  it('image rights raise sponsor income by 15%', () => {
    const s = makeState()
    s.life.sponsors = [{ id: 's', brand: 'B', category: 'kit', weekly: 10_000, untilSeason: 2099, minReputation: 0 } as never]
    hero0(s)
    const a = weeklyEconomy(new Rng(1), structuredClone(s.life), s.hero, { calendar: s.calendar }).breakdown.sponsors
    s.hero.contract!.imageRights = true
    const b = weeklyEconomy(new Rng(1), structuredClone(s.life), s.hero, { calendar: s.calendar }).breakdown.sponsors
    expect(b).toBe(Math.round(a * IMAGE_RIGHTS_BONUS))
  })

  it('extra bonuses are capped by hidden limits and appearance bonus is paid per match', () => {
    const { st } = open(3, 'star')
    const lim = extraBonusLimits(st)
    const step = counterOffer(new Rng(4), st, { appearanceBonus: lim.appearanceBonus * 50 })
    expect(step.state.offer.terms.appearanceBonus ?? 0).toBeLessThanOrEqual(lim.appearanceBonus)
    const state = makeState()
    hero0(state)
    state.hero.contract!.appearanceBonus = 700
    const before = state.life.money
    applyMatchToHero(state, { rating: 6.5, goals: 0, assists: 0, minutes: 90, started: true, won: false, drew: true, importance: 0.3 }, new Rng(1))
    expect(state.life.money - before).toBeGreaterThanOrEqual(700)
  })
})

function hero0(s: ReturnType<typeof makeState>): void {
  s.hero.contract = { clubId: 'c1', wage: 5000, untilSeason: 2030, signingBonus: 0, goalBonus: 0, assistBonus: 0, releaseClause: null, role: 'starter' }
}

describe('WP-15 economy & legacy', () => {
  it('term deposit locks cash, matures with interest, and early break costs the interest + 1%', () => {
    const { life, hero } = makeHeroLife()
    life.money = 100_000
    const cal = { season: 2026, week: 1 }
    openTermDeposit(life, 50_000, 13, cal)
    expect(life.money).toBe(50_000)
    const td = life.bank.termDeposits![0]!
    expect(netWorth(life, cal)).toBeGreaterThanOrEqual(100_000)
    const brk = structuredClone(life)
    breakTermDeposit(brk, td.id)
    expect(brk.money).toBe(50_000 + 49_500)
    expect(absWeek({ season: 2026, week: 14 })).toBe(td.maturesAt)
    const before = life.money
    weeklyEconomy(new Rng(1), life, hero, { calendar: { season: 2026, week: 14, day: 1, slot: 1 } })
    expect(life.bank.termDeposits).toHaveLength(0)
    expect(life.money - before).toBeGreaterThan(50_000 + termInterest(td!) - 1000)
  })

  it('goalkeeper award score rewards shutouts, saves and rating', () => {
    const a = goalkeeperAwardScore({ apps: 30, cleanSheets: 10, saves: 90, ratingSum: 30 * 7.2 })
    const b = goalkeeperAwardScore({ apps: 30, cleanSheets: 10, saves: 30, ratingSum: 30 * 6.5 })
    expect(a).toBeGreaterThan(b)
  })

  it('post-career path adds legacy points and text', () => {
    const base = { totals: { apps: 0, goals: 0, assists: 0, motm: 0, cleanSheets: 0, avgRating: 0 }, trophies: [], awards: [], caps: 0, intGoals: 0, reputation: 0, netWorth: 0 }
    const none = legacyScore(base).total
    expect(legacyScore({ ...base, postCareer: 'coach' }).total).toBe(none + POST_CAREER.coach.score)
    const state = makeState()
    expect(buildCareerSummary(state, { postCareer: 'pundit' }).postCareer).toBe('pundit')
    expect(buildCareerSummary(state).postCareer).toBeUndefined()
  })
})

describe('WP-15 extras', () => {
  it('birth city: local fans at creation and one-off welcome at the hometown club', async () => {
    const { applyBirthCity, hometownClubWelcome, HOMETOWN_BASE_FOLLOWERS, HOMETOWN_CLUB_FOLLOWERS } = await import('./hometown')
    const { hero, life } = makeHeroLife()
    const f0 = life.followers
    applyBirthCity(hero, life)
    expect(life.followers).toBe(f0)
    hero.birthCity = 'Ankara'
    applyBirthCity(hero, life)
    expect(life.followers).toBe(f0 + HOMETOWN_BASE_FOLLOWERS)
    const cal = { season: 2026, week: 1, day: 0, slot: 0 }
    expect(hometownClubWelcome(hero, life, 'Izmir', 'X', cal)).toHaveLength(0)
    expect(hometownClubWelcome(hero, life, ' ankara', 'Y', cal).length).toBeGreaterThan(0)
    expect(life.followers).toBe(f0 + HOMETOWN_BASE_FOLLOWERS + HOMETOWN_CLUB_FOLLOWERS)
    expect(hometownClubWelcome(hero, life, 'Ankara', 'Y', cal)).toHaveLength(0)
  })

  it('disgrace (scandal level 4) ends every sponsor deal', async () => {
    const { checkMoralityClause } = await import('../life/sponsors')
    const { hero, life } = makeHeroLife()
    life.sponsors = [1, 2, 3].map((i) => ({ id: `s${i}`, brand: `B${i}`, category: 'kit', weekly: 1000, untilSeason: 2099, minReputation: 0 }) as never)
    const r = checkMoralityClause(new Rng(1), life, hero, 4, { season: 2026, week: 1, day: 0, slot: 0 })
    expect(r.terminated).toHaveLength(3)
    expect(life.sponsors).toHaveLength(0)
  })

  it('business revenue is capped at 3x the level base', async () => {
    const { businessRevenueCap, BUSINESS_DEFS, LEVEL_REVENUE } = await import('../life/business')
    expect(businessRevenueCap({ kind: 'gym', level: 2 })).toBe(BUSINESS_DEFS.gym.baseRevenue * LEVEL_REVENUE[2] * 3)
  })

  it('economy invariants hold over 5 seasons of random state (2.5#126)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { hero, life } = makeHeroLife({ seed })
      hero.contract = { clubId: 'c', wage: 500 * seed, untilSeason: 2040, signingBonus: 0, goalBonus: 0, assistBonus: 0, releaseClause: null, role: 'starter' }
      life.money = seed * 5000
      const rng = new Rng(seed)
      for (let w = 0; w < 260; w++) {
        const cal = { season: 2026 + Math.floor(w / 52), week: w % 52, day: 0, slot: 0 }
        weeklyEconomy(rng, life, hero, { calendar: cal })
        expect(Number.isFinite(life.money)).toBe(true)
        expect(life.bank.savings).toBeGreaterThanOrEqual(0)
        expect(life.bank.creditScore).toBeGreaterThanOrEqual(300)
        expect(life.bank.creditScore).toBeLessThanOrEqual(850)
      }
    }
  })

  it('asset upkeep stays within 2% of price (assets over 5k) per week (2.5#24 spending curve)', async () => {
    const { ASSETS } = await import('../../data/assets')
    for (const a of ASSETS.filter((x) => x.price >= 5000)) expect(a.upkeep / a.price, a.id).toBeLessThanOrEqual(0.02)
  })
})
