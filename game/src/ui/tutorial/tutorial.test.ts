import { describe, expect, it } from 'vitest'
import { INITIAL_TOUR, TOUR_FLAG, TOUR_STEPS, currentStep, readTour, reduceTour, writeTour, type TourState } from './machine'
import { careerWeek, featureState, markCareerStart, START_FLAG, UNLOCK_WEEK, type UnlockContext } from './unlocks'
import { gestureFor, hintId, isHintSuccess, pickDrillHint, pickMatchHint } from './hints'
import { GLOSSARY, matchesQuery } from './glossary'
import { tr } from '../../i18n/tr'
import { en } from '../../i18n/en'

const run = (s: TourState, ...evs: Parameters<typeof reduceTour>[1][]) => evs.reduce(reduceTour, s)

describe('tour state machine', () => {
  it('starts only from a fresh career and walks every step to done', () => {
    let s = reduceTour(INITIAL_TOUR, { type: 'start' })
    expect(s).toEqual({ status: 'active', step: 0 })
    for (let i = 1; i < TOUR_STEPS.length; i++) {
      s = reduceTour(s, { type: 'next' })
      expect(s).toEqual({ status: 'active', step: i })
    }
    s = reduceTour(s, { type: 'next' })
    expect(s.status).toBe('done')
    expect(currentStep(s)).toBeNull()
    // A finished tour never restarts by itself.
    expect(reduceTour(s, { type: 'start' })).toBe(s)
  })

  it('back never goes below the first step; inactive tours ignore navigation', () => {
    const s = run(INITIAL_TOUR, { type: 'start' }, { type: 'back' })
    expect(s.step).toBe(0)
    expect(reduceTour(INITIAL_TOUR, { type: 'next' })).toBe(INITIAL_TOUR)
    expect(run(INITIAL_TOUR, { type: 'start' }, { type: 'next' }, { type: 'next' }, { type: 'back' }).step).toBe(1)
  })

  it('skip ends the tour; replay restarts it from the first step', () => {
    const skipped = run(INITIAL_TOUR, { type: 'start' }, { type: 'next' }, { type: 'skip' })
    expect(skipped.status).toBe('skipped')
    expect(currentStep(skipped)).toBeNull()
    expect(reduceTour(skipped, { type: 'start' })).toBe(skipped)
    expect(reduceTour(skipped, { type: 'replay' })).toEqual({ status: 'active', step: 0 })
    const done = { status: 'done', step: TOUR_STEPS.length - 1 } as const
    expect(reduceTour(done, { type: 'replay' })).toEqual({ status: 'active', step: 0 })
  })

  it('action steps complete only with their own action', () => {
    const planner = TOUR_STEPS.findIndex((x) => x.waitFor === 'openPlanner')
    const planSlot = TOUR_STEPS.findIndex((x) => x.waitFor === 'planSlot')
    const advance = TOUR_STEPS.findIndex((x) => x.waitFor === 'advance')
    expect(planner).toBeGreaterThan(0)
    expect(planSlot).toBe(planner + 1)
    expect(advance).toBe(planSlot + 1)
    const s: TourState = { status: 'active', step: planner }
    expect(reduceTour(s, { type: 'action', action: 'advance' })).toBe(s)
    const s2 = reduceTour(s, { type: 'action', action: 'openPlanner' })
    expect(s2.step).toBe(planSlot)
    const s3 = reduceTour(s2, { type: 'action', action: 'planSlot' })
    const s4 = reduceTour(s3, { type: 'action', action: 'advance' })
    expect(currentStep(s4)?.id).toBe('decisions')
    // Info steps ignore actions.
    expect(reduceTour({ status: 'active', step: 0 }, { type: 'action', action: 'advance' }).step).toBe(0)
  })

  it('covers status bar, planner, decisions, advance and matchday with real targets', () => {
    const ids = TOUR_STEPS.map((x) => x.id)
    expect(ids).toEqual(expect.arrayContaining(['meters', 'planSlot', 'decisions', 'advance', 'matchday']))
    for (const st of TOUR_STEPS.slice(1)) expect(st.target, st.id).toBeTruthy()
  })
})

describe('tour persistence in save flags', () => {
  it('round-trips through life.flags and survives a JSON save/load', () => {
    const flags: Record<string, number | string | boolean> = { other: 1 }
    expect(readTour(flags)).toEqual(INITIAL_TOUR)
    const s = run(INITIAL_TOUR, { type: 'start' }, { type: 'next' }, { type: 'next' })
    expect(writeTour(flags, s)).toBe(true)
    expect(writeTour(flags, s)).toBe(false)
    const reloaded = JSON.parse(JSON.stringify(flags)) as typeof flags
    expect(readTour(reloaded)).toEqual(s)
    expect(reloaded.other).toBe(1)
    writeTour(reloaded, run(s, { type: 'skip' }))
    expect(readTour(reloaded).status).toBe('skipped')
  })

  it('treats corrupt flags as a fresh career and clamps bad steps', () => {
    expect(readTour({ [TOUR_FLAG.status]: 'banana' })).toEqual(INITIAL_TOUR)
    expect(readTour({ [TOUR_FLAG.status]: 'active', [TOUR_FLAG.step]: 999 }).step).toBe(TOUR_STEPS.length - 1)
    expect(readTour({ [TOUR_FLAG.status]: 'active', [TOUR_FLAG.step]: 'x' }).step).toBe(0)
    expect(readTour(null)).toEqual(INITIAL_TOUR)
    const f: Record<string, number | string | boolean> = { [TOUR_FLAG.status]: 'done', [TOUR_FLAG.step]: 3 }
    writeTour(f, INITIAL_TOUR)
    expect(f).toEqual({})
  })
})

describe('progressive unlocks', () => {
  const ctx = (week: number | null, age: UnlockContext['casinoAgeLock'] = null, seen = false): UnlockContext => ({
    careerWeek: week,
    casinoAgeLock: age,
    seen: () => seen,
  })

  it('records the career start once and counts 1-based weeks across seasons', () => {
    const f: Record<string, number | string | boolean> = {}
    markCareerStart(f, { season: 2026, week: 0 })
    markCareerStart(f, { season: 2026, week: 9 })
    expect(typeof f[START_FLAG]).toBe('number')
    expect(careerWeek(f, { season: 2026, week: 0 })).toBe(1)
    expect(careerWeek(f, { season: 2026, week: 2 })).toBe(3)
    expect(careerWeek(f, { season: 2027, week: 0 })!).toBeGreaterThan(40)
    expect(careerWeek({}, { season: 2026, week: 0 })).toBeNull()
  })

  it('locks side systems for the first weeks with a countdown', () => {
    const s = featureState('investments', ctx(1))
    expect(s.unlocked).toBe(false)
    expect(s.reason).toEqual({ kind: 'week', week: UNLOCK_WEEK.investments, weeksLeft: UNLOCK_WEEK.investments - 1 })
    expect(featureState('investments', ctx(UNLOCK_WEEK.investments)).unlocked).toBe(true)
    expect(featureState('sponsors', ctx(UNLOCK_WEEK.sponsors - 1)).unlocked).toBe(false)
  })

  it('casino needs the legal age from the backend selector, whatever the week', () => {
    const s = featureState('casino', ctx(30, { minAge: 18, yearsLeft: 2 }))
    expect(s.unlocked).toBe(false)
    expect(s.reason).toEqual({ kind: 'age', age: 18, yearsLeft: 2 })
    expect(featureState('casino', ctx(30)).unlocked).toBe(true)
  })

  it('"New!" only for features that were gated and not yet opened', () => {
    expect(featureState('sponsors', ctx(10)).isNew).toBe(true)
    expect(featureState('sponsors', ctx(10, null, true)).isNew).toBe(false)
    // Older saves (no start flag): everything open, nothing flagged new.
    const old = featureState('casino', ctx(null))
    expect(old.unlocked).toBe(true)
    expect(old.isNew).toBe(false)
  })
})

describe('control hints', () => {
  it('teaches each control group once', () => {
    const seen = new Set<string>()
    const has = (id: string) => seen.has(id)
    expect(pickMatchHint('one_on_one', has)).toBe('shoot')
    seen.add(hintId('match', 'shoot'))
    expect(pickMatchHint('one_on_one', has)).toBe('move')
    expect(pickMatchHint('corner', has)).toBe('header')
    expect(pickMatchHint('gk_save', has)).toBe('keeper')
    seen.add(hintId('match', 'move'))
    expect(pickMatchHint('one_on_one', has)).toBeNull()
    expect(pickDrillHint('finishing', 'setPiece', has)).toBe('setPiece')
    expect(pickDrillHint('finishing', 'standard', has)).toBe('shoot')
    seen.add(hintId('drill', 'shoot'))
    expect(pickDrillHint('finishing', 'standard', has)).toBeNull()
  })

  it('a hint is learned only by the matching successful hero action', () => {
    expect(isHintSuccess('shoot', { type: 'kick', hero: true, kick: 'shot' })).toBe(true)
    expect(isHintSuccess('shoot', { type: 'kick', hero: false, kick: 'shot' })).toBe(false)
    expect(isHintSuccess('shoot', { type: 'kick', hero: true, kick: 'pass' })).toBe(false)
    expect(isHintSuccess('pass', { type: 'kick', hero: true, kick: 'through' })).toBe(true)
    expect(isHintSuccess('pass', { type: 'kick', hero: true })).toBe(true) // drill kick
    expect(isHintSuccess('defend', { type: 'tackle', by: 'h1' }, 'h1')).toBe(true)
    expect(isHintSuccess('defend', { type: 'tackle', by: 'o3' }, 'h1')).toBe(false)
    expect(isHintSuccess('keeper', { type: 'save', by: 'h1' }, 'h1')).toBe(true)
    expect(isHintSuccess('header', { type: 'kick', hero: true, kick: 'header' })).toBe(true)
    expect(isHintSuccess('fitness', { type: 'score', good: true })).toBe(true)
  })

  it('picks a platform-appropriate gesture', () => {
    expect(gestureFor('shoot', 'touch')).toBe('swipe')
    expect(gestureFor('pass', 'touch')).toBe('tap')
    expect(gestureFor('shoot', 'mouse')).toBe('click')
    expect(gestureFor('move', 'mouse')).toBe('keys')
    expect(gestureFor('shoot', 'pad')).toBe('keys')
  })

  it('has hint copy for every group on every platform in both languages', () => {
    for (const dict of [tr, en]) {
      for (const p of ['touch', 'mouse', 'pad'] as const) {
        for (const g of ['shoot', 'pass', 'move', 'header', 'defend', 'keeper', 'setPiece', 'fitness'] as const) {
          expect(dict.help.hints[p][g].length, `${p}.${g}`).toBeGreaterThan(10)
        }
      }
    }
  })
})

describe('glossary', () => {
  it('has at least 25 bilingual terms', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(25)
    for (const g of GLOSSARY) {
      expect(tr.help.glossary.terms[g.id].def.length).toBeGreaterThan(20)
      expect(en.help.glossary.terms[g.id].def.length).toBeGreaterThan(20)
    }
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(Object.keys(tr.help.glossary.terms).length)
  })

  it('search ignores case and Turkish diacritics', () => {
    expect(matchesQuery('guven', 'Hoca güveni', '', 'tr')).toBe(true)
    expect(matchesQuery('İLİŞKİ', 'İlişki', '', 'tr')).toBe(true)
    expect(matchesQuery('xg', 'Pozisyon kalitesi (xG)', '', 'tr')).toBe(true)
    expect(matchesQuery('zzz', 'Form', 'def', 'en')).toBe(false)
  })
})
