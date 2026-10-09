import { describe, expect, it } from 'vitest'
import type { GameState } from '../../core/types'
import { advanceDay, isHeroMatchday } from './calendar'
import { autoPlayHeroMatch, prepareHeroMatch } from './match'
import {
  AGENDA_FLAG, MAX_MANDATORY_PER_DAY, agendaAfterActivity, agendaBlock, autoResolveAgenda, ensureAgenda, generateAgenda, pendingMandatory,
  prepBuffs, resolveTask, type Agenda, type AgendaTask,
} from './agenda'
import { readJson } from './internal'
import { nextClubFixture, selectionTerms } from './selection'
import { makeGame } from './testHelpers'

/** Play days with the autopilot (cards cleared) until `until` or the cap. */
function run(s: GameState, days: number, until?: (s: GameState) => boolean): void {
  for (let i = 0; i < days; i++) {
    s.pendingEvents.length = 0
    if (until?.(s)) return
    if (isHeroMatchday(s)) autoPlayHeroMatch(s)
    advanceDay(s)
  }
  s.pendingEvents.length = 0
}

const inject = (s: GameState, tasks: AgendaTask[]): void => {
  const a = ensureAgenda(s)
  a.tasks = tasks
  s.life.flags[AGENDA_FLAG] = JSON.stringify(a)
}

describe('daily agenda', () => {
  it('is deterministic for the same state and day', () => {
    const a = makeGame(501)
    const b = makeGame(501)
    run(a, 30)
    run(b, 30)
    expect(JSON.stringify(generateAgenda(a))).toBe(JSON.stringify(generateAgenda(b)))
  })

  it('never sets more than 2 mandatory tasks a day, averages 1–5 a week in season and varies the kinds', () => {
    const s = makeGame(502)
    const kinds = new Set<string>()
    let mandatory = 0
    let weeks = 0
    for (let d = 0; d < 7 * 30; d++) {
      s.pendingEvents.length = 0
      const a = ensureAgenda(s)
      const m = a.tasks.filter((t) => t.mandatory)
      expect(m.length).toBeLessThanOrEqual(MAX_MANDATORY_PER_DAY)
      if (s.calendar.week >= 2 && s.calendar.week <= 40) {
        mandatory += m.length
        if (s.calendar.day === 0) weeks++
      }
      for (const t of m) kinds.add(t.kind)
      if (isHeroMatchday(s)) autoPlayHeroMatch(s)
      advanceDay(s)
    }
    const perWeek = mandatory / Math.max(1, weeks)
    expect(perWeek).toBeGreaterThanOrEqual(1)
    expect(perWeek).toBeLessThanOrEqual(5)
    expect(kinds.size).toBeGreaterThanOrEqual(2)
  })

  it('blocks the day until mandatory tasks are done; quick resolve clears the block', () => {
    const s = makeGame(503)
    run(s, 10)
    const day = ensureAgenda(s).day
    inject(s, [{ id: `m:dateNight:${day}`, mandatory: true, kind: 'dateNight', title: { tr: 'a', en: 'a' }, why: { tr: '', en: '' }, reward: { tr: '', en: '' }, skip: { tr: '', en: '' } }])
    expect(agendaBlock(s)).not.toBeNull()
    expect(resolveTask(s, `m:dateNight:${day}`, 'quick').ok).toBe(true)
    expect(agendaBlock(s)).toBeNull()
    expect(pendingMandatory(s)).toHaveLength(0)
  })

  it('played beats quick, and skipping is a decision with consequences', () => {
    const base = makeGame(504)
    run(base, 12)
    base.life.relationships.partner ??= { id: 'partner', kind: 'partner', name: 'P', value: 20, memory: [], lastContactWeek: 0 }
    const day = ensureAgenda(base).day
    const task: AgendaTask = { id: `m:dateNight:${day}`, mandatory: true, kind: 'dateNight', title: { tr: 'a', en: 'a' }, why: { tr: '', en: '' }, reward: { tr: '', en: '' }, play: { choices: [{ id: 'special', label: { tr: '', en: '' }, hint: { tr: '', en: '' } }] }, skip: { tr: '', en: '' } }
    const out: Record<string, number> = {}
    for (const mode of ['quick', 'played', 'skip'] as const) {
      const s = structuredClone(base)
      inject(s, [{ ...task }])
      expect(resolveTask(s, task.id, mode, { choice: 'special' }).ok).toBe(true)
      out[mode] = s.life.relationships.partner!.value
    }
    expect(out.played!).toBeGreaterThan(out.quick!)
    expect(out.skip!).toBeLessThan(base.life.relationships.partner!.value)
    // A task without a skip option cannot be skipped.
    const s = structuredClone(base)
    inject(s, [{ ...task, id: `m:dopingTest:${day}`, kind: 'dopingTest', skip: undefined }])
    expect(resolveTask(s, `m:dopingTest:${day}`, 'skip').ok).toBe(false)
  })

  it('skipping compulsory training costs start chance at the next match', () => {
    const s = makeGame(505)
    run(s, 40, (x) => x.calendar.week >= 3)
    const day = ensureAgenda(s).day
    inject(s, [{ id: `m:teamTraining:${day}`, mandatory: true, kind: 'teamTraining', title: { tr: 'a', en: 'a' }, why: { tr: '', en: '' }, reward: { tr: '', en: '' }, skip: { tr: '', en: '' } }])
    const disc = s.life.discipline
    expect(resolveTask(s, `m:teamTraining:${day}`, 'skip').ok).toBe(true)
    expect(s.life.discipline).toBeLessThan(disc)
    expect(selectionTerms(s, nextClubFixture(s)).some((t) => t.key === 'skippedTraining')).toBe(true)
  })

  it('a preparation goal completes with its activity and buffs the matchup', () => {
    const s = makeGame(506)
    run(s, 40, (x) => x.calendar.week >= 3)
    const day = ensureAgenda(s).day
    inject(s, [{ id: `p:crossing:${day}`, mandatory: false, kind: 'train', attr: 'crossing', activity: 'train_crossing', title: { tr: 'a', en: 'a' }, why: { tr: '', en: '' }, reward: { tr: '', en: '' } }])
    expect(agendaAfterActivity(s, 'train_crossing')).not.toBeNull()
    const fx = nextClubFixture(s)!
    expect(prepBuffs(s, fx.fixture.id)).toContain('crossing')
    expect(selectionTerms(s, fx).some((t) => t.key === 'prep')).toBe(true)
    // The buff reaches the hero's match attributes.
    run(s, 14, (x) => isHeroMatchday(x))
    if (!isHeroMatchday(s) || nextClubFixture(s)?.fixture.id !== fx.fixture.id) return
    const before = s.hero.attrs.crossing
    const prep = prepareHeroMatch(s)!
    const team = prep.isHome ? prep.setup.home : prep.setup.away
    const hp = [...team.lineup, ...team.bench].find((p) => p.isHero)!
    expect(hp.attrs.crossing).toBeGreaterThanOrEqual(before)
  })

  it('the autopilot quick-resolves leftovers at the end of the day', () => {
    const s = makeGame(507)
    run(s, 10)
    const day = ensureAgenda(s).day
    inject(s, [{ id: `m:autographs:${day}`, mandatory: true, kind: 'autographs', title: { tr: 'a', en: 'a' }, why: { tr: '', en: '' }, reward: { tr: '', en: '' } }])
    expect(autoResolveAgenda(s)).toBe(1)
    const a = readJson<Agenda | null>(s.life, AGENDA_FLAG, null)!
    expect(a.tasks[0]!.done).toBe('quick')
  })
})
