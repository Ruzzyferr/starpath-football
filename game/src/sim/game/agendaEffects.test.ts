/**
 * No silent no-ops (coordinator follow-up): every way a mandatory agenda task
 * can be resolved — quick, each decision, skip — must move something real in
 * the save (a relation that exists, a meter, XP, money, a selection flag). The
 * old `rel(s, 'teammates', …)` targeted a relationship id that never existed.
 */
import { describe, expect, it } from 'vitest'
import type { GameState } from '../../core/types'
import { absWeek } from '../career/common'
import { ensureRelation } from '../life/relationships'
import { advanceDay, isHeroMatchday } from './calendar'
import { AGENDA_FLAG, MANDATORY_KINDS, ensureAgenda, mandatoryTask, resolveTask, type ResolveMode } from './agenda'
import { autoPlayHeroMatch } from './match'
import { NT_COACH_REL } from './national'
import { makeGame } from './testHelpers'

function career(): GameState {
  const s = makeGame(808)
  for (let i = 0; i < 40; i++) {
    s.pendingEvents.length = 0
    if (isHeroMatchday(s)) autoPlayHeroMatch(s)
    advanceDay(s)
  }
  s.pendingEvents.length = 0
  const w = absWeek(s.calendar)
  // The circle every task can address (partner, family, national coach), as a mid-career save has.
  ensureRelation(s.life, 'partner', 'partner', 'Partner', 20, w)
  ensureRelation(s.life, 'mother', 'mother', 'Mother', 40, w)
  ensureRelation(s.life, NT_COACH_REL, 'manager', 'Coach', 10, w)
  s.hero.suspendedMatches = 2
  s.hero.fatigue = 50
  return s
}

/** The save without the agenda bookkeeping (what the task itself must change). */
function fingerprint(s: GameState): string {
  const flags = { ...s.life.flags }
  delete flags[AGENDA_FLAG]
  const rels = Object.fromEntries(Object.entries(s.life.relationships).map(([k, r]) => [k, r.value]))
  return JSON.stringify({ hero: s.hero, life: { ...s.life, flags, relationships: rels } })
}

describe('agenda effects target real systems', () => {
  const base = career()
  const day = ensureAgenda(base).day
  for (const kind of MANDATORY_KINDS) {
    const task = mandatoryTask(base, kind, day)
    const ways: { mode: ResolveMode; choice?: string; performance?: number; picks?: string[] }[] = [{ mode: 'quick' }]
    for (const c of task.play?.choices ?? []) ways.push({ mode: 'played', choice: c.id })
    if (task.play?.drill || task.play?.game) ways.push({ mode: 'played', performance: 0.9 })
    if (task.play?.scene) ways.push({ mode: 'played', picks: [] })
    if (task.skip) ways.push({ mode: 'skip' })
    for (const w of ways) {
      it(`${kind} ${w.mode}${w.choice ? `:${w.choice}` : ''} changes the save`, () => {
        const s = JSON.parse(JSON.stringify(base)) as GameState
        const a = ensureAgenda(s)
        a.tasks = [mandatoryTask(s, kind, a.day)]
        s.life.flags[AGENDA_FLAG] = JSON.stringify(a)
        const before = fingerprint(s)
        const r = resolveTask(s, a.tasks[0]!.id, w.mode, w)
        expect(r.ok).toBe(true)
        expect(fingerprint(s), `${kind} ${w.mode} is a no-op`).not.toBe(before)
      })
    }
  }

  it('captain talks and the team meeting reach every teammate', () => {
    const s = JSON.parse(JSON.stringify(base)) as GameState
    const mates = () => Object.values(s.life.relationships).filter((r) => r.kind === 'teammate')
    expect(mates().length).toBeGreaterThan(5)
    const sum0 = mates().reduce((a, r) => a + r.value, 0)
    const a = ensureAgenda(s)
    a.tasks = [mandatoryTask(s, 'captainMentoring', a.day), mandatoryTask(s, 'teamMeeting', a.day)]
    s.life.flags[AGENDA_FLAG] = JSON.stringify(a)
    resolveTask(s, a.tasks[0]!.id, 'played')
    resolveTask(s, a.tasks[1]!.id, 'played', { choice: 'team' })
    expect(mates().reduce((x, r) => x + r.value, 0)).toBeGreaterThan(sum0 + mates().length * 4)
  })
})
