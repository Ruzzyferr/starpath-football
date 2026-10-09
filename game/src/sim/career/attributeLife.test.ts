/**
 * Owner requirement: every one of the 30 attributes is developable through training (at least
 * one session, and a playable drill wherever a ball drill makes sense), and the hero's role
 * weak stats are surfaced as development areas.
 */
import { describe, expect, it } from 'vitest'
import { ATTRIBUTE_KEYS, V6_ATTRIBUTE_KEYS, isGoalkeepingAttr, type AttributeKey } from '../../core/types'
import { DRILL_FOR_TRAINING } from '../../game/training/scoring'
import { bestSessionFor, developmentAreas, sessionsFor, signatureStrengths, statList, styleFit, trainingCoverage } from './attributeLife'
import { ROLE_SPEC } from './createHero'
import { makeHeroLife } from './testFixtures'
import { TRAINING_TYPES, runTraining, trainingXp, type TrainingType } from './training'

const GK_ONLY: readonly TrainingType[] = ['goalkeeping', 'distribution', 'keeperDiving']

describe('attribute → training coverage', () => {
  it('has 30 attributes and every one is trained by at least one session', () => {
    expect(ATTRIBUTE_KEYS.length).toBe(30)
    const cov = trainingCoverage()
    for (const k of ATTRIBUTE_KEYS) expect(cov[k].length, k).toBeGreaterThanOrEqual(1)
  })

  it('every attribute is trained by a session with a playable drill (leadership by the drilled tactical session)', () => {
    for (const k of ATTRIBUTE_KEYS) {
      const drilled = sessionsFor(k).filter((s) => DRILL_FOR_TRAINING[s.type] !== null)
      expect(drilled.length, k).toBeGreaterThanOrEqual(1)
    }
  })

  it('outfielders can train every outfield attribute without the keeper sessions', () => {
    for (const k of ATTRIBUTE_KEYS.filter((x) => !isGoalkeepingAttr(x))) {
      expect(sessionsFor(k).some((s) => !GK_ONLY.includes(s.type)), k).toBe(true)
    }
  })

  it('each v6 attribute (and leadership / work rate) has a dedicated session where it is the main focus', () => {
    const dedicated: Partial<Record<AttributeKey, TrainingType>> = {
      acceleration: 'sprint', balance: 'core', longPassing: 'longPass', anticipation: 'reading', workRate: 'pressing',
      leadership: 'leadership', diving: 'keeperDiving', curve: 'setPiece', aggression: 'tackling',
    }
    for (const [k, type] of Object.entries(dedicated) as [AttributeKey, TrainingType][]) {
      const attrs = TRAINING_TYPES[type].attrs
      const main = Object.entries(attrs).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]![0]
      if (k === 'curve' || k === 'aggression') expect(attrs[k] ?? 0, `${k} in ${type}`).toBeGreaterThan(0)
      else expect(main, `${type} is about ${k}`).toBe(k)
    }
    for (const k of V6_ATTRIBUTE_KEYS) expect(bestSessionFor(k)).not.toBeNull()
  })

  it('new sessions map to the new drills', () => {
    expect(DRILL_FOR_TRAINING.sprint).toEqual({ kind: 'sprint', variant: 'standard' })
    expect(DRILL_FOR_TRAINING.core).toEqual({ kind: 'sprint', variant: 'contact' })
    expect(DRILL_FOR_TRAINING.longPass).toEqual({ kind: 'crossing', variant: 'switch' })
    expect(DRILL_FOR_TRAINING.reading).toEqual({ kind: 'interception', variant: 'standard' })
    expect(DRILL_FOR_TRAINING.pressing).toEqual({ kind: 'interception', variant: 'press' })
    expect(DRILL_FOR_TRAINING.keeperDiving).toEqual({ kind: 'goalkeeping', variant: 'diving' })
    expect(DRILL_FOR_TRAINING.leadership).toBeNull()
  })
})

describe('XP flow of the attribute sessions', () => {
  const cases: [TrainingType, AttributeKey][] = [
    ['sprint', 'acceleration'], ['core', 'balance'], ['longPass', 'longPassing'], ['reading', 'anticipation'],
    ['pressing', 'workRate'], ['leadership', 'leadership'], ['keeperDiving', 'diving'],
  ]
  for (const [type, key] of cases) {
    it(`${type}: a better drill score pours more ${key} XP, and the session moves the attribute`, () => {
      const { hero, life } = makeHeroLife({ position: type === 'keeperDiving' ? 'GK' : 'CM', role: type === 'keeperDiving' ? 'shotStopper' : 'boxToBox' })
      const lo = trainingXp(hero, life, type, 0.3)[key] ?? 0
      const hi = trainingXp(hero, life, type, 1)[key] ?? 0
      expect(hi).toBeGreaterThan(lo * 1.5)
      const before = hero.attrs[key] + (hero.attrXp[key] ?? 0)
      for (let i = 0; i < 6; i++) {
        life.energy = 100
        hero.fatigue = 0
        hero.injury = null
        const r = runTraining({ chance: () => false } as never, hero, life, { type, performance: 0.9, season: 2026 })
        expect(r.ok).toBe(true)
        expect(r.xp[key] ?? 0).toBeGreaterThan(0)
      }
      expect(hero.attrs[key] + (hero.attrXp[key] ?? 0)).toBeGreaterThan(before)
    })
  }
})

describe('development areas & strengths', () => {
  it('development areas are the role spec weak stats, weakest first, never keeper stats for outfielders', () => {
    const { hero } = makeHeroLife({ position: 'CM', role: 'playmaker' })
    const areas = developmentAreas(hero)
    expect(new Set(areas)).toEqual(new Set(ROLE_SPEC.playmaker.minus))
    for (let i = 1; i < areas.length; i++) expect(hero.attrs[areas[i]!]).toBeGreaterThanOrEqual(hero.attrs[areas[i - 1]!])
    const gk = makeHeroLife({ position: 'GK', role: 'reflexKeeper' }).hero
    expect(developmentAreas(gk).length).toBeGreaterThan(0)
  })

  it('signature strengths cite real top stats with their values', () => {
    const { hero } = makeHeroLife({ position: 'ST', role: 'runner' })
    hero.attrs.acceleration = 97
    const top = signatureStrengths(hero)
    expect(top).toContain('acceleration')
    expect(statList(hero, ['acceleration']).en).toBe('Acceleration 97')
    expect(statList(hero, ['acceleration', 'pace']).tr).toContain(' ve ')
  })

  it('style fit: a runner suits a counter-attacking side more than a possession side', () => {
    const { hero } = makeHeroLife({ position: 'ST', role: 'runner' })
    hero.attrs.pace = 92
    hero.attrs.acceleration = 94
    hero.attrs.passing = 40
    hero.attrs.vision = 38
    expect(styleFit(hero.attrs, 'counter')).toBeGreaterThan(styleFit(hero.attrs, 'possession'))
    expect(styleFit(hero.attrs, 'balanced')).toBe(0)
  })
})
