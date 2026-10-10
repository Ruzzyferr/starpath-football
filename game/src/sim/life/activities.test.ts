import { Rng } from '../../core/rng'
import type { Calendar, Hero, Life } from '../../core/types'
import { ACTIVITIES } from '../../data/activities'
import { createHero, createLife } from '../career/createHero'
import { ensureRelation, ensureTeammates } from './relationships'
import {
  absDay, activityBlock, autoPlanDay, availableActivities, performActivity, physioSessionsThisWeek, startDay,
  type ActivityContext,
} from './activities'

const APPEAR = { skin: 0, hairStyle: 0, hairColor: 0, beard: 0, eyeColor: 0, face: 0, accessory: 0 }

function setup(seed = 1): { rng: Rng; hero: Hero; life: Life } {
  const rng = new Rng(seed)
  const hero = createHero(rng, {
    firstName: 'Arda', lastName: 'Yıldız', nickname: 'Arda', nationality: 'TR', position: 'ST', foot: 'R',
    appearance: APPEAR, role: 'runner', background: 'academy', birthYear: 2005,
  })
  const life = createLife(rng, hero, 'academy')
  life.money = 200000
  hero.reputation = 30
  ensureRelation(life, 'manager', 'manager', 'Hoca', 20)
  ensureRelation(life, 'partner', 'partner', 'Deniz', 40)
  ensureTeammates(life, [{ npcId: 'a', name: 'Ali' }, { npcId: 'b', name: 'Bora' }])
  life.sponsors.push({ id: 's1', brand: 'Strada Kicks', category: 'boots', weekly: 1000, untilSeason: 2030, minReputation: 5 })
  return { rng, hero, life }
}

const cal = (slot = 0, day = 1): Calendar => ({ season: 2026, week: 3, day, slot })
const ctx = (over: Partial<ActivityContext> = {}): ActivityContext => ({ calendar: cal(), inSeason: true, matchToday: false, matchTomorrow: false, ...over })

function sane(hero: Hero, life: Life): void {
  for (const v of [life.energy, life.happiness, life.stress, life.health, life.discipline, hero.fatigue, hero.sharpness, hero.reputation]) {
    expect(Number.isFinite(v)).toBe(true)
    expect(v).toBeGreaterThanOrEqual(0)
    expect(v).toBeLessThanOrEqual(100)
  }
  expect(Number.isFinite(life.money)).toBe(true)
  expect(Number.isFinite(life.followers)).toBe(true)
  for (const r of Object.values(life.relationships)) expect(Number.isFinite(r.value)).toBe(true)
}

describe('activities', () => {
  it('every activity performs sanely in some valid context', () => {
    for (const def of ACTIVITIES) {
      const { rng, hero, life } = setup(7)
      if (def.id === 'fire_trainer') life.trainer = { name: 'x', group: 'physical', weeklyFee: 800 }
      const c = ctx({ calendar: cal(def.allowedSlots[0]), inSeason: !def.conditions.offSeasonOnly })
      expect(activityBlock(hero, life, def, c)).toBeNull()
      const r = performActivity(rng, hero, life, def.id, c, { postType: 'family', trainerGroup: 'physical' })
      expect(r.ok).toBe(true)
      expect(r.slotsUsed).toBe(def.slots)
      expect(r.lines.length).toBeGreaterThan(0)
      sane(hero, life)
    }
  })

  it('random activity spam keeps all meters bounded and energy non-negative', () => {
    const { rng, hero, life } = setup(3)
    for (let i = 0; i < 3000; i++) {
      const c = ctx({ calendar: cal(i % 3, Math.floor(i / 3) % 7), inSeason: i % 500 < 400, matchTomorrow: i % 11 === 0 })
      if (i % 3 === 0) startDay(hero, life, c)
      const opts = availableActivities(hero, life, c).filter((a) => a.available)
      if (opts.length === 0) continue
      performActivity(rng, hero, life, rng.pick(opts).def.id, c, { performance: rng.next(), postType: 'provocation' })
      if (hero.injury && rng.chance(0.1)) hero.injury = null
      sane(hero, life)
      if (life.money < 1000) life.money += 50000
    }
  })

  it('training activity grants XP', () => {
    const { rng, hero, life } = setup(5)
    const before = Object.values(hero.attrXp).reduce((a, b) => a + (b ?? 0), 0) + Object.values(hero.attrs).reduce((a, b) => a + b, 0) * 100
    const r = performActivity(rng, hero, life, 'train_shooting', ctx(), { performance: 1 })
    expect(r.ok).toBe(true)
    const after = Object.values(hero.attrXp).reduce((a, b) => a + (b ?? 0), 0) + Object.values(hero.attrs).reduce((a, b) => a + b, 0) * 100
    expect(after).toBeGreaterThan(before)
  })

  it('injured hero cannot train but can do physio and yoga', () => {
    const { rng, hero, life } = setup(9)
    hero.injury = { name: { tr: 'x', en: 'x' }, weeksLeft: 3, severity: 2 }
    expect(performActivity(rng, hero, life, 'train_shooting', ctx()).ok).toBe(false)
    expect(performActivity(rng, hero, life, 'gym', ctx()).ok).toBe(false)
    expect(performActivity(rng, hero, life, 'physio', ctx()).ok).toBe(true)
    expect(physioSessionsThisWeek(life, cal())).toBe(1)
    expect(performActivity(rng, hero, life, 'train_recovery', ctx({ calendar: cal(1) })).ok).toBe(true)
  })

  it('travel is off-season only and takes the whole day', () => {
    const { rng, hero, life } = setup(2)
    expect(performActivity(rng, hero, life, 'travel', ctx({ inSeason: true })).ok).toBe(false)
    const r = performActivity(rng, hero, life, 'travel', ctx({ inSeason: false }))
    expect(r.ok).toBe(true)
    expect(r.slotsUsed).toBe(3)
    // cooldown
    expect(performActivity(rng, hero, life, 'travel', ctx({ inSeason: false, calendar: cal(0, 3) })).ok).toBe(false)
  })

  it('nightclub before a match costs discipline and causes a hangover', () => {
    const { rng, hero, life } = setup(4)
    const d0 = life.discipline
    const r = performActivity(rng, hero, life, 'party', ctx({ calendar: cal(2), matchTomorrow: true }))
    expect(r.ok).toBe(true)
    expect(r.triggerTags).toContain('nightlife')
    expect(r.triggerTags).toContain('pre_match_night')
    expect(life.discipline).toBe(d0 - 9)
    const next = cal(0, 2)
    expect(life.flags.nightlife_day).toBe(absDay(next) - 1)
    startDay(hero, life, { calendar: next })
    expect(life.energy).toBe(70)
  })

  it('night owl perk reduces party energy', () => {
    const a = setup(4)
    const b = setup(4)
    b.hero.perks.push('night_owl')
    performActivity(a.rng, a.hero, a.life, 'party', ctx({ calendar: cal(2) }))
    performActivity(b.rng, b.hero, b.life, 'party', ctx({ calendar: cal(2) }))
    expect(b.life.energy).toBeGreaterThan(a.life.energy)
  })

  it('nightclub is 18+, casino is 21+ (friendly lock, no side effects)', () => {
    const { rng, hero, life } = setup()
    hero.birthYear = 2009 // 17 in 2026
    const evening = ctx({ calendar: cal(2), inSeason: false })
    for (const [id, re] of [['casino', /21\+.*4 year/], ['party', /18\+.*1 year/]] as const) {
      const def = ACTIVITIES.find((a) => a.id === id)!
      const why = activityBlock(hero, life, def, evening)
      expect(why?.en).toMatch(re)
      const m = life.money
      const r = performActivity(rng, hero, life, id, evening)
      expect(r.ok).toBe(false)
      expect(life.money).toBe(m)
    }
    const casino = ACTIVITIES.find((a) => a.id === 'casino')!
    hero.birthYear = 2006 // 20: nightclub yes, casino still closed for a year
    expect(activityBlock(hero, life, ACTIVITIES.find((a) => a.id === 'party')!, evening)).toBeNull()
    expect(activityBlock(hero, life, casino, evening)?.en).toMatch(/21\+.*1 year/)
    hero.birthYear = 2005
    expect(activityBlock(hero, life, casino, evening)).toBeNull()
  })

  it('casino only returns tags', () => {
    const { rng, hero, life } = setup(4)
    const m = life.money
    const r = performActivity(rng, hero, life, 'casino', ctx({ calendar: cal(2) }))
    expect(r.triggerTags).toEqual(expect.arrayContaining(['casino', 'gambling']))
    expect(life.money).toBe(m)
  })

  it('sponsor shoot pays and requires a sponsor', () => {
    const { rng, hero, life } = setup(4)
    const m = life.money
    expect(performActivity(rng, hero, life, 'sponsor_shoot', ctx()).ok).toBe(true)
    expect(life.money).toBe(m + 500)
    life.sponsors = []
    expect(performActivity(rng, hero, life, 'sponsor_shoot', ctx()).ok).toBe(false)
  })

  it('hire trainer sets life.trainer', () => {
    const { rng, hero, life } = setup(4)
    performActivity(rng, hero, life, 'hire_trainer', ctx(), { trainerGroup: 'mental', trainerQuality: 3 })
    expect(life.trainer?.group).toBe('mental')
    expect(life.trainer?.weeklyFee).toBe(7000)
  })

  it('family visit raises family relations and records memory', () => {
    const { rng, hero, life } = setup(4)
    const before = life.relationships.mother!.value
    performActivity(rng, hero, life, 'family_visit', ctx({ calendar: cal(1) }))
    expect(life.relationships.mother!.value).toBeGreaterThan(before)
    expect(life.relationships.mother!.memory.length).toBe(1)
    expect(life.relationships.mother!.lastContactWeek).toBe(3)
  })

  it('autoPlanDay never schedules exhausting work the day before a match', () => {
    for (let seed = 0; seed < 30; seed++) {
      const { hero, life } = setup(seed)
      hero.fatigue = seed * 3
      const plan = autoPlanDay(hero, life, ctx({ matchTomorrow: true, calendar: cal(0, seed % 7) }))
      expect(plan.length).toBe(3)
      for (const p of plan) {
        expect(['party', 'casino', 'gym', 'train_physical', 'travel']).not.toContain(p.activityId)
        expect(p.options.intensity).not.toBe('hard')
      }
    }
  })

  it('autoPlanDay injured routine uses physio and executes', () => {
    const { rng, hero, life } = setup(6)
    hero.injury = { name: { tr: 'x', en: 'x' }, weeksLeft: 3, severity: 2 }
    const plan = autoPlanDay(hero, life, ctx())
    expect(plan[0]!.activityId).toBe('physio')
    plan.forEach((p, slot) => {
      expect(performActivity(rng, hero, life, p.activityId, ctx({ calendar: cal(slot) }), p.options).ok).toBe(true)
    })
  })

  it('autoPlanDay normal week keeps fatigue under control', () => {
    const { rng, hero, life } = setup(8)
    for (let day = 0; day < 28; day++) {
      const c0 = ctx({ calendar: cal(0, day % 7), matchToday: day % 7 === 5, matchTomorrow: day % 7 === 4 })
      startDay(hero, life, c0)
      autoPlanDay(hero, life, c0).forEach((p, slot) => {
        performActivity(rng, hero, life, p.activityId, { ...c0, calendar: cal(slot, day % 7) }, p.options)
      })
      if (hero.injury) hero.injury = null
      sane(hero, life)
    }
    expect(hero.fatigue).toBeLessThan(80)
  })
})

describe('energy drink (2.5#16)', () => {
  it('is a cheap rest-slot boost with a fatigue cost', () => {
    const d = ACTIVITIES.find((a) => a.id === 'energy_drink')
    expect(d).toBeDefined()
    expect(d!.energy).toBeLessThan(0)
    expect(d!.fatigue).toBeGreaterThan(0)
    expect(d!.money).toBeLessThan(0)
  })
})

describe('sleep quality (2.5#18)', () => {
  it('a night refills 75% of the missing energy at base and up to 100% with a premium bed', async () => {
    const { startDay, sleepQuality, SLEEP_BASE } = await import('./activities')
    const { makeHeroLife } = await import('../career/testFixtures')
    const { hero, life } = makeHeroLife({ age: 24 })
    const cal = { season: 2026, week: 3, day: 2, slot: 0 } as never
    life.assets = []
    expect(sleepQuality(life)).toBe(SLEEP_BASE)
    life.energy = 20
    startDay(hero, life, { calendar: cal })
    expect(life.energy).toBe(80) // 20 + 80 * 0.75
    life.assets = [{ defId: 'tech_somnia_bed', boughtSeason: 2026, boughtWeek: 1, pricePaid: 9000 }, { defId: 'house_townhouse', boughtSeason: 2026, boughtWeek: 1, pricePaid: 650000 }] as never
    expect(sleepQuality(life)).toBe(1)
    life.energy = 20
    startDay(hero, life, { calendar: cal })
    expect(life.energy).toBe(100)
  })
})
