import { describe, expect, it } from 'vitest'
import { Rng } from '../../core/rng'
import { START_YEAR } from '../../core/config'
import { makeHeroLife } from '../career/testFixtures'
import { ASSETS } from '../../data/assets'
import { legacyStartFrom } from '../game/legacy'
import { buildCareerSummary } from '../game/hallOfFame'
import { makeGame } from '../game/testHelpers'
import { netWorth, weeklyEconomy } from './economy'
import { assetEffectTotal } from './assetEffects'
import { openBusiness, businessWeek } from './business'
import {
  ACADEMY_PRICE, LEGACY_FUND_CAP, PROJECT_FLAGS, STADIUM_PRICE, STAKE_MAX_PCT, STAKE_PRICE_PER_PCT, academyLevel, buildAcademyStage, buildStadiumStage,
  buyClubStake, contributeLegacyFund, legacyAcademyBonus, legacyFund, legacyFundBonus, projectUpkeep, projectsLegacyPoints, sellClubStake, stakeDividend, stadiumLevel,
  weeklyProjectsTick, STAKE_CONTROL_PCT, OWNER_LEGACY_POINTS, clubOwnerOf, isClubOwner, stakePct,
} from './projects'

const cal = { season: START_YEAR, week: 26, day: 0, slot: 0 }

function rich() {
  const x = makeHeroLife({ age: 31 })
  x.hero.reputation = 70
  x.life.money = 40_000_000
  return x
}

describe('legacy projects', () => {
  it('builds academy and stadium stages for money and has running costs', () => {
    const { life } = rich()
    const m0 = life.money
    expect(buildAcademyStage(life).ok).toBe(true)
    expect(life.money).toBe(m0 - ACADEMY_PRICE[1])
    expect(academyLevel(life)).toBe(1)
    expect(buildAcademyStage(life).ok).toBe(true)
    expect(buildAcademyStage(life).ok).toBe(true)
    expect(buildAcademyStage(life).ok).toBe(false)
    expect(buildStadiumStage(life).ok).toBe(true)
    expect(stadiumLevel(life)).toBe(1)
    expect(projectUpkeep(life)).toBeGreaterThan(0)
    expect(life.money).toBe(m0 - ACADEMY_PRICE[1] - ACADEMY_PRICE[2] - ACADEMY_PRICE[3] - STADIUM_PRICE[1])
  })

  it('refuses when money is short', () => {
    const { life } = rich()
    life.money = 1_000
    expect(buildAcademyStage(life).ok).toBe(false)
    expect(buildStadiumStage(life).ok).toBe(false)
    expect(contributeLegacyFund(life, 5_000).ok).toBe(false)
    expect(buyClubStake(life, 'c0', 5).ok).toBe(false)
  })

  it('weekly economy charges upkeep, pays the stake dividend, and grows the fund', () => {
    const { hero, life } = rich()
    buildAcademyStage(life)
    expect(buyClubStake(life, 'c0', 10).ok).toBe(true)
    expect(contributeLegacyFund(life, 1_000_000).ok).toBe(true)
    expect(buyClubStake(life, 'other', 5).ok).toBe(false) // one club at a time
    expect(buyClubStake(life, 'c0', STAKE_MAX_PCT).ok).toBe(false) // over the cap
    const before = life.money
    const fund0 = legacyFund(life)
    const r = weeklyEconomy(new Rng(1), life, hero, { calendar: cal })
    expect(r.breakdown.upkeep).toBeLessThan(0)
    expect(r.breakdown.business).toBeGreaterThanOrEqual(stakeDividend(life) - 1)
    expect(legacyFund(life)).toBeGreaterThan(fund0)
    expect(life.money).not.toBe(before)
  })

  it('academy graduates arrive twice a year and the stadium makes people happier', () => {
    const { hero, life } = rich()
    life.flags[PROJECT_FLAGS.academy] = 2
    life.flags[PROJECT_FLAGS.stadium] = 1
    const rep0 = hero.reputation
    const lines = weeklyProjectsTick(life, hero, { ...cal, week: 26, season: START_YEAR }).lines
    // absWeek multiple of 26 depends on the calendar mapping; run a full year to be sure.
    let grads = lines.length
    for (let w = 0; w < 52; w++) grads += weeklyProjectsTick(life, hero, { season: START_YEAR, week: w, day: 0, slot: 0 }).lines.length
    expect(grads).toBeGreaterThanOrEqual(2)
    expect(hero.reputation).toBeGreaterThan(rep0)
  })

  it('stake resale returns 90% and counts in net worth', () => {
    const { life } = rich()
    buyClubStake(life, 'c0', 10)
    const nw = netWorth(life, cal)
    const cash = life.money
    expect(nw).toBeGreaterThan(cash)
    const s = sellClubStake(life)
    expect(s.amount).toBe(Math.round(10 * STAKE_PRICE_PER_PCT * 0.9))
    expect(sellClubStake(life).ok).toBe(false)
  })

  it('the legacy fund helps the Legacy child but never makes a millionaire', () => {
    expect(legacyFundBonus(0)).toBe(0)
    expect(legacyFundBonus(400_000)).toBe(100_000)
    expect(legacyFundBonus(50_000_000)).toBe(LEGACY_FUND_CAP)
    expect(legacyAcademyBonus(5)).toBe(3)
    const base = { careerId: 'p', name: 'Parent', gender: 'male' as const, legacyScore: 1500, netWorth: 10_000_000 }
    const plain = legacyStartFrom(base)
    const withFund = legacyStartFrom({ ...base, legacyFund: 600_000, academyLevel: 2 })
    expect(withFund.inheritance).toBe(plain.inheritance + LEGACY_FUND_CAP)
    expect(withFund.reputationBonus).toBe(plain.reputationBonus + 2)
    expect(withFund.inheritance).toBeLessThan(600_000)
  })

  it('collector items appreciate and add Hall of Fame points (capped)', () => {
    const items = ASSETS.filter((a) => a.id.startsWith('col_'))
    expect(items.length).toBeGreaterThanOrEqual(8)
    for (const a of items) {
      expect(a.effect?.key).toBe('collector')
      expect(a.resale).toBeGreaterThanOrEqual(0.9)
    }
    const { life } = rich()
    life.assets = items.map((a) => ({ defId: a.id, boughtSeason: START_YEAR, boughtWeek: 0, pricePaid: a.price }))
    expect(assetEffectTotal(life, 'collector')).toBe(12)
    expect(projectsLegacyPoints(life)).toBe(36)
  })
})

describe('business decisions (boost, manager, expand)', () => {
  it('a boost multiplies revenue and runs out', () => {
    const { hero, life } = rich()
    openBusiness(life, hero, 'gym', cal)
    const b = life.businesses![0]!
    const base = businessWeek(new Rng(5), ({ ...b, history: [] })!, 70, 1).revenue
    b.boost = { mult: 1.4, weeks: 2 }
    const hot = businessWeek(new Rng(5), b!, 70, 1).revenue
    expect(hot).toBeGreaterThan(base)
    businessWeek(new Rng(6), b!, 70, 2)
    expect(b.boost).toBeUndefined()
  })
})

describe('majority club ownership', () => {
  it('crossing 51% makes the hero the owner: better dividend, big legacy points, an epilogue', () => {
    const { life } = rich()
    expect(buyClubStake(life, 'c0', 25).ok).toBe(true)
    expect(isClubOwner(life)).toBe(false)
    const d25 = stakeDividend(life) / stakePct(life)
    const pts25 = projectsLegacyPoints(life)
    const r = buyClubStake(life, 'c0', STAKE_CONTROL_PCT - 25)
    expect(r.ok).toBe(true)
    expect(r.lines.length).toBeGreaterThan(1) // the "you are the owner" line
    expect(isClubOwner(life)).toBe(true)
    expect(stakeDividend(life) / stakePct(life)).toBeGreaterThan(d25)
    expect(projectsLegacyPoints(life)).toBe(pts25 + OWNER_LEGACY_POINTS)
    const o = clubOwnerOf(life, 'Atlas FC')
    expect(o?.pct).toBe(STAKE_CONTROL_PCT)
    expect(o?.epilogue.tr).toContain('Atlas FC')
    expect(o?.epilogue.en).toContain('Atlas FC')
    expect(sellClubStake(life).ok).toBe(true)
    expect(clubOwnerOf(life, 'Atlas FC')).toBeNull()
  })

  it('the share cap now allows a controlling stake and no more', () => {
    const { life } = rich()
    life.money = 80_000_000
    expect(STAKE_MAX_PCT).toBeGreaterThan(STAKE_CONTROL_PCT)
    expect(buyClubStake(life, 'c0', STAKE_MAX_PCT).ok).toBe(true)
    expect(buyClubStake(life, 'c0', 1).ok).toBe(false)
  })

  it('the retirement summary carries the owner epilogue and the Hall of Fame bonus', () => {
    const s = makeGame(77)
    s.hero.birthYear = s.calendar.season - 34
    s.life.money = 60_000_000
    const club = s.hero.contract!.clubId
    expect(buyClubStake(s.life, club, STAKE_CONTROL_PCT).ok).toBe(true)
    const sum = buildCareerSummary(s)
    expect(sum.owner?.clubName).toBe(s.world.clubs[club]!.name)
    expect(sum.owner?.pct).toBe(STAKE_CONTROL_PCT)
    expect(sum.projectsScore).toBeGreaterThanOrEqual(OWNER_LEGACY_POINTS)
    expect(sum.bestMoments.some((m) => m.en.includes('Majority owner'))).toBe(true)
  })
})
