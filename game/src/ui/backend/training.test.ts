/**
 * Training screen wiring over the REAL backend: mini-game performance → XP,
 * session availability, trainer offers ↔ hire, perk unlocks.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryStorage } from '../../state/save'
import { TRAINER_QUALITY_BONUS } from '../../sim/career/training'
import { gameState, installBackend } from '../store'
import { DEFAULT_CAREER } from './index'
import { useStorage } from './persistence'
import { realActions as A } from './realActions'
import { realData as D } from './realData'

const S = () => {
  const s = gameState.value
  if (!s) throw new Error('no state')
  return s
}

/** Fresh career, morning, rested, no events in the way. */
function fresh(seed: number): void {
  A.newGame({ ...DEFAULT_CAREER, seed })
  const s = S()
  s.pendingEvents = []
  s.calendar.slot = 0
  s.life.energy = 100
  s.hero.fatigue = 0
  s.hero.injury = null
  s.life.money = 1_000_000
}

describe('training (real backend)', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    useStorage(new MemoryStorage())
    installBackend({ actions: A, data: D })
  })
  afterAll(() => vi.useRealTimers())
  beforeEach(() => fresh(4242))

  it('sessions expose drills, expected XP and availability', () => {
    const sessions = D.trainingSessions()
    const shooting = sessions.find((x) => x.id === 'shooting')!
    expect(shooting.drill).toEqual({ kind: 'finishing', variant: 'standard' })
    expect(sessions.find((x) => x.id === 'setPiece')!.drill?.variant).toBe('setPiece')
    expect(sessions.find((x) => x.id === 'recovery')!.drill).toBeNull()
    expect(sessions.some((x) => x.id === 'goalkeeping')).toBe(S().hero.position === 'GK')
    expect(shooting.available).toBe(true)
    expect(shooting.xpMax).toBeGreaterThan(shooting.xp)
    expect(shooting.xp).toBeGreaterThan(0)
  })

  it('a better drill score earns more XP', () => {
    const lo = A.trainSession('shooting', 0.1)
    fresh(4242)
    const hi = A.trainSession('shooting', 1)
    expect(lo.ok && hi.ok).toBe(true)
    expect(hi.performance).toBe(1)
    expect(hi.xp).toBeGreaterThan(lo.xp * 2)
    expect(hi.attrXp[0].xp).toBeGreaterThanOrEqual(hi.attrXp[hi.attrXp.length - 1].xp)
    expect(hi.deltas[0]).toEqual({ key: 'xp', value: hi.xp })
    expect(hi.deltas.some((d) => d.key === 'energy' && d.value < 0)).toBe(true)
  })

  it('auto training uses 0.6 and matches the session preview', () => {
    const preview = D.trainingSessions().find((x) => x.id === 'passing')!.xp
    const r = A.trainSession('passing')
    expect(r.performance).toBeCloseTo(0.6)
    expect(Math.abs(r.xp - preview)).toBeLessThanOrEqual(1)
    expect(A.train('passing').length).toBeGreaterThan(0) // compat API still returns chips
  })

  it('refuses sessions that are not available and says why', () => {
    S().life.energy = 0
    const v = D.trainingSessions().find((x) => x.id === 'physical')!
    expect(v.available).toBe(false)
    expect(v.lockedReason?.en).toMatch(/energy/i)
    const r = A.trainSession('physical', 0.9)
    expect(r.ok).toBe(false)
    expect(r.xp).toBe(0)
    expect(A.trainSession('nope', 1).ok).toBe(false)
  })

  it('trainer offers are exactly what hiring gives, and quality matters', () => {
    const offers = D.trainerOffers()
    const elite = offers.find((o) => o.id === 'technical:3')!
    expect(elite.available).toBe(true)
    expect(elite.bonus).toBe(TRAINER_QUALITY_BONUS[3])
    expect(A.hireTrainer(elite.id)).toBe(true)
    const t = S().life.trainer!
    expect(t.name).toBe(elite.name)
    expect(t.group).toBe('technical')
    expect(t.quality).toBe(3)
    expect(t.weeklyFee).toBe(elite.weeklyFee)
    const after = D.trainerOffers().find((o) => o.id === elite.id)!
    expect(after.current).toBe(true)
    expect(after.available).toBe(false)
    // An elite technical trainer boosts shooting XP more than a basic one.
    const withElite = D.trainingSessions().find((x) => x.id === 'shooting')!.xp
    S().life.trainer = { ...t, quality: 1 }
    gameState.value = { ...S() }
    const withBasic = D.trainingSessions().find((x) => x.id === 'shooting')!.xp
    expect(withElite).toBeGreaterThan(withBasic)
    A.fireTrainer()
    expect(S().life.trainer).toBeNull()
  })

  it('hiring is refused in the evening and when broke', () => {
    S().calendar.slot = 2
    gameState.value = { ...S() }
    const o = D.trainerOffers().find((x) => x.id === 'physical:1')!
    expect(o.available).toBe(false)
    expect(A.hireTrainer(o.id)).toBe(false)
    fresh(4242)
    S().life.money = 10
    gameState.value = { ...S() }
    expect(D.trainerOffers().find((x) => x.id === 'physical:2')!.available).toBe(false)
    expect(A.hireTrainer('physical:2')).toBe(false)
    expect(A.hireTrainer('bogus:2')).toBe(false)
  })

  it('perk tree unlocks through the real backend', () => {
    S().hero.perkPoints = 5
    gameState.value = { ...S() }
    const p = D.perks().find((x) => x.available && x.cost <= 5)!
    expect(p).toBeDefined()
    expect(A.unlockPerk(p.id)).toBe(true)
    expect(S().hero.perks).toContain(p.id)
    expect(S().hero.perkPoints).toBe(5 - p.cost)
    expect(D.perks().find((x) => x.id === p.id)!.owned).toBe(true)
    // Children of the unlocked perk may now be available; locked ones still refuse.
    const locked = D.perks().find((x) => !x.owned && !x.available)
    if (locked) expect(A.unlockPerk(locked.id)).toBe(false)
  })
})
