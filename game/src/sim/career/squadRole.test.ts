import { Rng } from '../../core/rng'
import type { Calendar, Contract } from '../../core/types'
import { heroOvr } from './progression'
import {
  ROLE_ORDER, benchComplaint, changeTrust, evaluateRoleChange, startProbability, targetRole, trackSelection,
  updateTrustFromMatch, weeklyTrustTick,
} from './squadRole'
import { makeHeroLife } from './testFixtures'
import { ensureRelation } from '../life/relationships'

const cal: Calendar = { season: 2026, week: 3, day: 0, slot: 0 }
const contract = (role: Contract['role']): Contract => ({
  clubId: 'c1', wage: 1000, untilSeason: 2028, signingBonus: 0, goalBonus: 0, assistBonus: 0, releaseClause: null, role,
})

function setup(role: Contract['role'] = 'rotation') {
  const x = makeHeroLife({ age: 24 })
  x.hero.contract = contract(role)
  ensureRelation(x.life, 'manager', 'manager', 'Hoca', 10)
  return x
}

describe('manager trust', () => {
  it('good ratings raise trust, bad ratings lower it, cameo counts less', () => {
    const { hero } = setup()
    hero.managerTrust = 50
    expect(updateTrustFromMatch(hero, 8, 90)).toBeGreaterThan(0)
    const t = hero.managerTrust
    expect(updateTrustFromMatch(hero, 4.5, 90)).toBeLessThan(0)
    expect(hero.managerTrust).toBeLessThan(t)
    const full = updateTrustFromMatch(setup().hero, 8, 90)
    const cameo = updateTrustFromMatch(setup().hero, 8, 10)
    expect(cameo).toBeLessThan(full)
  })
  it('a poor rating is not punished when the hero decided the match', () => {
    const lone = updateTrustFromMatch(setup().hero, 5, 90)
    const one = updateTrustFromMatch(setup().hero, 5, 90, 1, 0, true)
    const two = updateTrustFromMatch(setup().hero, 5, 90, 1, 1, false)
    expect(lone).toBeLessThan(0)
    expect(one).toBeLessThan(0)
    expect(one).toBeGreaterThan(lone)
    expect(two).toBeGreaterThanOrEqual(0)
    // good ratings are never scaled
    expect(updateTrustFromMatch(setup().hero, 8, 90, 2, 0, true)).toBe(updateTrustFromMatch(setup().hero, 8, 90))
  })
  it('gains shrink near 100 and trust stays bounded', () => {
    const { hero } = setup()
    hero.managerTrust = 95
    expect(changeTrust(hero, 10)).toBeLessThan(5)
    for (let i = 0; i < 100; i++) changeTrust(hero, 50)
    expect(hero.managerTrust).toBeLessThanOrEqual(100)
  })
  it('weekly drift pulls trust toward a background level', () => {
    const { hero, life } = setup()
    hero.managerTrust = 100
    for (let i = 0; i < 30; i++) weeklyTrustTick(hero, life)
    expect(hero.managerTrust).toBeLessThan(80)
  })
})

describe('roles', () => {
  it('target role follows OVR gap', () => {
    const { hero, life } = setup()
    const ovr = heroOvr(hero)
    hero.managerTrust = 50
    expect(targetRole(hero, life, { squadAvgOvr: ovr + 15, season: 2026 })).toBe('reserve')
    expect(targetRole(hero, life, { squadAvgOvr: ovr, season: 2026 })).toBe('rotation')
    expect(targetRole(hero, life, { squadAvgOvr: ovr - 5, season: 2026 })).toBe('starter')
    expect(targetRole(hero, life, { squadAvgOvr: ovr - 12, season: 2026 })).toBe('star')
  })
  it('moves one step per evaluation (hysteresis)', () => {
    const { hero, life } = setup('reserve')
    hero.managerTrust = 50
    const ctx = { squadAvgOvr: heroOvr(hero) - 15, season: 2026 }
    evaluateRoleChange(hero, life, ctx, cal)
    expect(hero.contract?.role).toBe('rotation')
    evaluateRoleChange(hero, life, ctx, cal)
    expect(hero.contract?.role).toBe('starter')
  })
  it('captaincy requires leadership, trust and an open armband', () => {
    const { hero, life } = setup('star')
    hero.attrs.leadership = 80
    hero.managerTrust = 90
    life.relationships.manager.value = 50
    const ctx = { squadAvgOvr: heroOvr(hero) - 10, season: 2026 }
    expect(targetRole(hero, life, ctx)).toBe('star')
    expect(targetRole(hero, life, { ...ctx, captaincyOpen: true })).toBe('captain')
  })
  it('start probability rises with role and is 0 when unavailable', () => {
    const probs = ROLE_ORDER.map((r) => { const x = setup(r); return startProbability(x.hero, x.life) })
    for (let i = 1; i < probs.length; i++) expect(probs[i]).toBeGreaterThanOrEqual(probs[i - 1])
    const x = setup('star')
    x.hero.suspendedMatches = 1
    expect(startProbability(x.hero, x.life)).toBe(0)
    const y = setup('starter')
    const fresh = startProbability(y.hero, y.life)
    y.hero.fatigue = 95
    expect(startProbability(y.hero, y.life)).toBeLessThan(fresh)
  })
})

describe('bench complaints', () => {
  it('bench streak unlocks the complaint option', () => {
    const { hero, life } = setup('starter')
    trackSelection(hero, life, false)
    trackSelection(hero, life, false)
    expect(life.flags.can_complain).not.toBe(true)
    expect(trackSelection(hero, life, false).length).toBe(1)
    expect(life.flags.can_complain).toBe(true)
    trackSelection(hero, life, true)
    expect(life.flags.bench_streak).toBe(0)
  })
  it('public complaints are costly; polite ones are safe', () => {
    let politeTrustLoss = 0
    let publicTrustLoss = 0
    let listed = 0
    for (let s = 0; s < 200; s++) {
      const a = setup('starter'); a.hero.managerTrust = 50
      benchComplaint(new Rng(s), a.hero, a.life, 'polite', { squadAvgOvr: heroOvr(a.hero), season: 2026 }, cal)
      politeTrustLoss += 50 - a.hero.managerTrust
      const b = setup('starter'); b.hero.managerTrust = 50
      const r = benchComplaint(new Rng(s), b.hero, b.life, 'public', { squadAvgOvr: heroOvr(b.hero), season: 2026 }, cal)
      publicTrustLoss += 50 - b.hero.managerTrust
      if (r.outcome === 'transferListed') listed++
    }
    expect(politeTrustLoss).toBeLessThanOrEqual(0)
    expect(publicTrustLoss / 200).toBeGreaterThanOrEqual(14)
    expect(listed / 200).toBeGreaterThan(0.15)
    expect(listed / 200).toBeLessThan(0.35)
  })
  it('a promise boosts the next start probability', () => {
    const { hero, life } = setup('rotation')
    const before = startProbability(hero, life)
    life.flags.promised_start = true
    expect(startProbability(hero, life)).toBeGreaterThan(before)
  })
})
