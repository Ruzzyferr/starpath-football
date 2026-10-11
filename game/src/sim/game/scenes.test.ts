import { describe, expect, it } from 'vitest'
import type { GameState } from '../../core/types'
import { absWeek } from '../career/common'
import { MANAGER_REL } from '../career/squadRole'
import { ensureRelation } from '../life/relationships'
import { advanceDay, isHeroMatchday } from './calendar'
import { AGENDA_FLAG, ensureAgenda, resolveTask, type AgendaTask } from './agenda'
import { autoPlayHeroMatch } from './match'
import { NT_COACH_REL } from './national'
import { applyManagerTalk, applyNationalCamp, applyTeamDinner, managerTalkScene, nationalCampScene, teamDinnerScene } from './scenes'
import { TALK_FLAG, talkBlock } from './selection'
import { oneOnOne, oneOnOneBlock } from './weekIdeas'
import { makeGame } from './testHelpers'

function inSeason(seed: number): GameState {
  const s = makeGame(seed)
  for (let i = 0; i < 40; i++) {
    s.pendingEvents.length = 0
    if (isHeroMatchday(s)) autoPlayHeroMatch(s)
    advanceDay(s)
  }
  for (let i = 0; i < 7 && isHeroMatchday(s); i++) {
    autoPlayHeroMatch(s)
    advanceDay(s)
  }
  s.pendingEvents.length = 0
  s.calendar.slot = 0
  s.life.energy = 100
  ensureRelation(s.life, NT_COACH_REL, 'manager', 'Coach', 10, absWeek(s.calendar))
  return s
}

const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s)) as GameState

describe('dialogue scenes', () => {
  it('build the same scene for the same save and day', () => {
    const a = inSeason(71)
    const b = inSeason(71)
    expect(JSON.stringify(nationalCampScene(a))).toBe(JSON.stringify(nationalCampScene(b)))
    expect(JSON.stringify(managerTalkScene(a))).toBe(JSON.stringify(managerTalkScene(b)))
    expect(JSON.stringify(teamDinnerScene(a))).toBe(JSON.stringify(teamDinnerScene(b)))
    const sc = nationalCampScene(a)
    expect(sc.steps).toHaveLength(3)
    for (const st of sc.steps) expect(st.options.length).toBeGreaterThanOrEqual(2)
  })

  it('national camp: answers move the coach relation and the call-up meter, deterministically', () => {
    const base = inSeason(72)
    const sc = nationalCampScene(base)
    const style = sc.cast[0]!.style
    const best = style === 'demanding' ? ['ready', 'starter', 'yes'] : ['honest', 'team', 'learn']
    const good = clone(base)
    const bad = clone(base)
    const r1 = applyNationalCamp(good, best)
    applyNationalCamp(bad, ['ready', 'starter', 'own'])
    expect(r1.ok).toBe(true)
    expect(good.life.relationships[NT_COACH_REL]!.value).toBeGreaterThan(bad.life.relationships[NT_COACH_REL]!.value)
    expect(r1.meter!.after).toBeGreaterThanOrEqual(r1.meter!.before)
    expect(r1.effects.find((e) => e.key === 'coach')!.value).toBeGreaterThan(0)
    // Same picks, same result.
    const again = clone(base)
    expect(JSON.stringify(applyNationalCamp(again, best))).toBe(JSON.stringify(r1))
  })

  it('national camp through the agenda: played with picks resolves the task with an outcome', () => {
    const s = inSeason(73)
    const a = ensureAgenda(s)
    const task: AgendaTask = { id: `m:nationalCamp:${a.day}`, mandatory: true, kind: 'nationalCamp', title: { tr: 'k', en: 'k' }, why: { tr: '', en: '' }, reward: { tr: '', en: '' }, play: { scene: 'nationalCamp' } }
    a.tasks = [task]
    s.life.flags[AGENDA_FLAG] = JSON.stringify(a)
    const r = resolveTask(s, task.id, 'played', { picks: ['proud', 'team', 'learn'] })
    expect(r.ok).toBe(true)
    expect(r.outcome?.effects.length).toBeGreaterThan(0)
    expect(ensureAgenda(s).tasks[0]!.done).toBe('played')
  })

  it('doping test played: calm play gives composure XP and morale, nerves cost morale', () => {
    const mk = (perf: number) => {
      const s = inSeason(74)
      const a = ensureAgenda(s)
      a.tasks = [{ id: `m:dopingTest:${a.day}`, mandatory: true, kind: 'dopingTest', title: { tr: 'd', en: 'd' }, why: { tr: '', en: '' }, reward: { tr: '', en: '' }, play: { game: 'doping' } }]
      s.life.flags[AGENDA_FLAG] = JSON.stringify(a)
      const xp0 = (s.hero.attrXp.composure ?? 0) + s.hero.attrs.composure * 1000
      const m0 = s.hero.morale
      resolveTask(s, a.tasks[0]!.id, 'played', { performance: perf })
      return { xp: (s.hero.attrXp.composure ?? 0) + s.hero.attrs.composure * 1000 - xp0, morale: s.hero.morale - m0 }
    }
    const calm = mk(0.95)
    const nervy = mk(0.1)
    expect(calm.xp).toBeGreaterThan(nervy.xp)
    expect(calm.morale).toBeGreaterThan(0)
    expect(nervy.morale).toBeLessThan(0)
  })

  it('manager talk: fitting answers and social stats earn trust; the start chance meter is reported; once a week', () => {
    const base = inSeason(75)
    expect(talkBlock(base)).toBeNull()
    const sc = managerTalkScene(base)!
    expect(sc.steps).toHaveLength(2)
    const s = clone(base)
    // The answers his style asks for (the hint under the portrait).
    const style = sc.cast[0]!.style
    const fitting = style === 'demanding' ? ['offer', 'promise'] : style === 'fatherly' ? ['ask', 'thanks'] : ['ask', 'detail']
    s.hero.attrs.composure = 70
    s.hero.attrs.leadership = 70
    const r = applyManagerTalk(s, fitting)
    expect(r.rapport!.fit).toBeGreaterThanOrEqual(0.65)
    expect(r.ok).toBe(true)
    expect(r.meter).toBeDefined()
    expect(s.hero.managerTrust).toBeGreaterThan(base.hero.managerTrust)
    expect(s.life.flags[TALK_FLAG]).toBe(absWeek(s.calendar))
    expect(applyManagerTalk(s, ['ask', 'thanks']).ok).toBe(false)
    // Demanding a start in poor form backfires on the relation.
    const d = clone(base)
    d.hero.form = 40
    applyManagerTalk(d, ['demand', 'thanks'])
    expect(d.life.relationships[MANAGER_REL]!.value).toBeLessThan(clone(base).life.relationships[MANAGER_REL]!.value + 2)
  })

  it('team dinner: the seat-mate bond grows, the bill is paid, teammates move', () => {
    const base = inSeason(76)
    const sc = teamDinnerScene(base)!
    expect(sc.cast).toHaveLength(2)
    const s = clone(base)
    const r = applyTeamDinner(s, ['sitA', 'jokes', 'pay'])
    expect(r.ok).toBe(true)
    expect(s.life.money).toBe(base.life.money - 450)
    expect(r.effects.some((e) => e.key === 'mate' && e.value > 0)).toBe(true)
    expect(r.effects.find((e) => e.key === 'teammates')!.value).toBeGreaterThan(0)
  })

  it('one-on-one: a played drill scales XP and the bond; no performance = the quick session', () => {
    const base = inSeason(77)
    expect(oneOnOneBlock(base)).toBeNull()
    const quick = clone(base)
    const top = clone(base)
    const low = clone(base)
    const q = oneOnOne(quick)
    const t = oneOnOne(top, 1)
    const l = oneOnOne(low, 0.05)
    const sum = (x: typeof q) => (x.xp ?? []).reduce((a, y) => a + y.xp, 0)
    expect(sum(t)).toBeGreaterThan(sum(q))
    expect(sum(q)).toBeGreaterThan(sum(l))
    expect(t.relation!).toBeGreaterThanOrEqual(q.relation!)
    expect(q.partner).toBeTruthy()
  })
})
