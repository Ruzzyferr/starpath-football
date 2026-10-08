/**
 * Career-end bridge over the real backend: event-driven achievements (with the
 * Steam sink), retirement → global Hall of Fame → Legacy new game, trials.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { MemoryStorage } from '../../state/save'
import { MemoryKV } from '../../state/metaStore'
import { gameState, installBackend } from '../store'
import { DEFAULT_CAREER } from './index'
import { useStorage } from './persistence'
import { realActions as A } from './realActions'
import { realData as D } from './realData'
import * as M from './meta'

const S = () => {
  const s = gameState.value
  if (!s) throw new Error('no state')
  return s
}

function clearEvents(): void {
  for (let i = 0; i < 20 && S().pendingEvents.length > 0; i++) {
    const v = D.eventView(0)
    A.resolveEvent(0, Math.max(0, v?.choices.findIndex((c) => !c.requirement || c.requirement.met) ?? 0))
  }
}

const steam: string[] = []

beforeAll(() => {
  useStorage(new MemoryStorage())
  M.useMetaStorage(new MemoryKV())
  M.setUnlockSink((id) => steam.push(id))
  installBackend({ actions: A, data: D })
  M.installMeta()
})

describe('meta bridge', () => {
  it('a new career + its first actions unlock achievements and reach the Steam sink', () => {
    A.newGame({ ...DEFAULT_CAREER, seed: 4242 })
    A.planSlot(0, null)
    expect(steam).toContain('first_contract')
    expect(M.achievementsView().unlocked).toBeGreaterThan(0)
    expect(M.metaData.value.achievements.counters.careersStarted).toBe(1)
  })

  it('a played match is turned into a match event (debut)', () => {
    for (let i = 0; i < 40 && S().hero.careerStats.apps === 0; i++) {
      clearEvents()
      const fx = D.nextFixture()
      if (fx?.daysUntil === 0 && S().calendar.slot >= 1) A.advance()
      else A.advanceToMatch()
    }
    expect(S().hero.careerStats.apps).toBeGreaterThan(0)
    expect(M.metaData.value.achievements.unlocked.debut).toBeDefined()
    expect(M.personalRecordRows().length).toBeGreaterThan(0)
  })

  it('retire → Hall of Fame (global) → legacy terms; achievements persist across careers', () => {
    S().hero.birthYear = S().calendar.season - 35
    expect(M.retirementView()?.canRetire).toBe(true)
    const sum = M.retireNow({ testimonial: true })
    expect(sum).not.toBeNull()
    expect(S().hero.retired).toBe(true)
    const hof = M.hallOfFame()
    expect(hof).toHaveLength(1)
    expect(M.summaryView(hof[0]!.careerId)?.name).toBe(sum?.name)
    expect(M.metaData.value.achievements.unlocked.retired).toBeDefined()
    expect(steam).toContain('retired')
    const leg = M.legacyFor(hof[0]!.careerId)
    expect(leg?.inheritance).toBeGreaterThanOrEqual(5000)
    A.newGame({ ...DEFAULT_CAREER, seed: 99, lastName: DEFAULT_CAREER.lastName, legacy: leg ?? undefined })
    A.planSlot(0, null)
    expect(S().hero.perks).toContain('famous_name')
    expect(M.metaData.value.achievements.unlocked.legacy_start).toBeDefined()
    expect(M.hallOfFame()).toHaveLength(1)
  })

  it('trials career: invitations, then signing through the bridge', () => {
    A.newGame({ ...DEFAULT_CAREER, seed: 7, trials: true })
    expect(M.needsTrial()).toBe(true)
    const academy = M.trialInvites().find((i) => i.kind === 'academy')
    expect(academy).toBeDefined()
    const r = M.finishTrial(academy?.id ?? '', 0.4)
    expect(r.signed).toBe(true)
    expect(M.needsTrial()).toBe(false)
    expect(S().hero.contract?.role).toBe('youth')
  })

  it('profile & contract views', () => {
    expect(M.potential()?.stars).toBeGreaterThan(0)
    const m = M.market(1000)
    expect(m?.samples.length).toBe(5)
    expect(M.clubRecordRows(S().hero.contract?.clubId ?? '').length).toBeGreaterThan(0)
  })
})
