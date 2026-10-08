/**
 * Trigger coverage for the round-2 content packs (veteran years, projects, business
 * decisions, casino career): every spontaneous card must be reachable in some prepared
 * state, every chain step must be reachable from a parent, and the new delta kinds work.
 */
import { describe, expect, it } from 'vitest'
import { Rng } from '../../../core/rng'
import type { GameState } from '../../../core/types'
import { businessDecisionEvents } from './content/businessDecisions'
import { casinoCareerEvents } from './content/casinoCareer'
import { projectEvents } from './content/projects'
import { veteranEvents } from './content/veteran'
import { veteran2Events } from './content/veteran2'
import { ALL_EVENTS } from './content'
import { applyEffectResult, buildVars, getEventDef, isEligible } from './engine'
import { makeTestState } from './testFixture'
import { bizBoost, bizExpand, bizManager, fx, t } from './dsl'
import { openBusiness } from '../business'
import { PROJECT_FLAGS } from '../projects'

const ALL_TAGS = ['weekly', 'season_end', 'new_season', 'casino', 'national_break', 'post_match', 'match_loss']
const PACKS = [...businessDecisionEvents, ...projectEvents, ...veteranEvents, ...veteran2Events, ...casinoCareerEvents]

function vet(seed: number, tweak?: (s: GameState) => void): GameState {
  const s = makeTestState({ seed, partner: true, money: 30_000_000, reputation: 85 })
  s.hero.birthYear = s.calendar.season - 34
  s.calendar.week = 20
  s.life.relationships.partner!.value = 70
  s.hero.careerStats.apps = 400
  s.hero.trophies = [1, 2, 3, 4, 5].map((n) => ({ season: 2020 + n, name: t('Kupa', 'Cup') })) as never
  Object.assign(s.life.flags, { farewell_season: true, pundit_contact: true, coach_path: true, coach_badge: 2, podcast: true, racehorse: 1 })
  s.life.casino.addiction = 70
  s.life.casino.lost = 400_000
  s.life.casino.visitsThisWeek = 1
  s.life.sponsors.push({ id: 's1', brand: 'Volta', weekly: 5_000, untilSeason: 2030 } as never)
  s.life.assets.push({ defId: 'col_signed_shirt', boughtSeason: 2020, boughtWeek: 1, pricePaid: 15_000 })
  tweak?.(s)
  return s
}

describe('round-2 content packs', () => {
  it('adds 70+ new cards, all registered, ids unique', () => {
    expect(PACKS.length).toBeGreaterThanOrEqual(76)
    const ids = new Set(ALL_EVENTS.map((e) => e.id))
    expect(ids.size).toBe(ALL_EVENTS.length)
    for (const e of PACKS) expect(ids.has(e.id), e.id).toBe(true)
  })

  it('every spontaneous card fires in at least one prepared state', () => {
    const variants: GameState[] = []
    for (const seed of [1, 2]) {
      variants.push(vet(seed))
      variants.push(vet(seed, (s) => { s.life.flags[PROJECT_FLAGS.academy] = 1; s.life.flags[PROJECT_FLAGS.graduates] = 2 }))
      variants.push(vet(seed, (s) => { s.life.flags[PROJECT_FLAGS.stadium] = 1 }))
      variants.push(vet(seed, (s) => { s.life.flags[PROJECT_FLAGS.stake] = 10; s.life.flags[PROJECT_FLAGS.fund] = 500_000 }))
      variants.push(vet(seed, (s) => {
        for (const k of ['restaurant', 'gym', 'clothing'] as const) openBusiness(s.life, s.hero, k, s.calendar)
        s.life.businesses!.forEach((b) => { b.totalProfit = 100_000; b.history = Array.from({ length: 6 }, (_, i) => ({ w: i, revenue: 1, rent: 0, staff: 0, manager: 0, stock: 0, incident: 0, profit: 100 })) })
        s.life.flags['proj:fund'] = 300_000
      }))
      variants.push(vet(seed, (s) => { s.life.flags.racehorse = false; s.life.flags.coach_path = false; s.life.sponsors = []; s.life.casino.addiction = 20; s.life.casino.won = 0; s.life.casino.lost = 0 }))
      variants.push(vet(seed, (s) => { s.life.flags.casino_turnover = 200_000; s.life.casino.addiction = 20 }))
      variants.push(vet(seed, (s) => { s.life.flags.coach_path = false; s.life.flags.coach_badge = 0; s.life.assets = [] }))
    }
    const missing = PACKS.filter((e) => !e.followUpOnly).filter((e) => !variants.some((s) => ALL_TAGS.some((tag) => isEligible(s, e, [tag]))))
    expect(missing.map((e) => e.id)).toEqual([])
  })

  it('chain steps are reachable from some parent choice', () => {
    const state = vet(3)
    const reached = new Set<string>()
    for (const def of ALL_EVENTS) {
      def.choices.forEach((c, i) => {
        for (let seed = 1; seed <= 6; seed++) {
          const s = structuredClone(state)
          const rng = new Rng(seed * 11 + i)
          const vars = buildVars(s, rng, def, [])
          try {
            for (const f of c.effects({ state: s, vars, absWeek: 0, tags: [] }, rng).followUps ?? []) reached.add(f.eventId)
          } catch { /* covered by content.test */ }
        }
      })
    }
    const orphans = PACKS.filter((e) => e.followUpOnly && !reached.has(e.id)).map((e) => e.id)
    expect(orphans).toEqual([])
  })

  it('late-career cards stay out of a young hero\'s deck', () => {
    const young = makeTestState({ seed: 4, partner: true, money: 30_000_000, reputation: 85 })
    young.hero.birthYear = young.calendar.season - 20
    for (const id of ['teammates.armband_handover', 'club.testimonial_idea', 'mentor.protege_selected', 'press.column_offer', 'milestone.stand_naming']) {
      const e = getEventDef(id)!
      expect(ALL_TAGS.some((tag) => isEligible(young, e, [tag])), id).toBe(false)
    }
  })

  it('business deltas: boost, manager and free expansion change the shop', () => {
    const s = vet(5)
    openBusiness(s.life, s.hero, 'restaurant', s.calendar)
    const b = s.life.businesses![0]
    const def = getEventDef('business.expand_restaurant')!
    const r = applyEffectResult(s, new Rng(1), def, {}, fx(t('x', 'x'), bizBoost(3, 1.3, 6), bizManager(true), bizExpand(200_000, 2)))
    expect(b.boost).toEqual({ mult: 1.3, weeks: 6 })
    expect(b.manager).toBe(true)
    expect(b.level).toBe(2)
    expect(b.invested).toBeGreaterThan(250_000)
    expect(r.deltas.length).toBeGreaterThan(0)
  })

  it('project cards start real projects (flags + cash)', () => {
    const s = vet(6, (st) => { st.life.flags.racehorse = false })
    const cash0 = s.life.money
    const def = getEventDef('money.academy_blueprint')!
    const rng = new Rng(2)
    const vars = buildVars(s, rng, def, [])
    const res = def.choices[0]!.effects({ state: s, vars, absWeek: 0, tags: [] }, rng)
    applyEffectResult(s, rng, def, vars, res)
    expect(s.life.flags[PROJECT_FLAGS.academy]).toBe(1)
    expect(s.life.money).toBeLessThan(cash0)
    const stake = getEventDef('money.club_stake_offer')!
    const v2 = buildVars(s, rng, stake, [])
    applyEffectResult(s, rng, stake, v2, stake.choices[1]!.effects({ state: s, vars: v2, absWeek: 0, tags: [] }, rng))
    expect(s.life.flags[PROJECT_FLAGS.stake]).toBe(5)
    expect(s.life.flags[PROJECT_FLAGS.stakeClub]).toBe('c0')
  })
})
