/**
 * UI bridge for the short interactive moments (sim/game/scenes, agenda,
 * weekIdeas): the national camp check-in, the manager's office and the team
 * dinner as dialogue scenes, the doping test as a calm mini-game and the
 * 1-on-1 with a teammate as a pair drill. One host (BenchSceneHost, mounted in
 * App) opens whichever is set in {@link benchScene}; every entry keeps a
 * quick resolve that does exactly what the one tap did before.
 */
import { signal } from '@preact/signals'
import type { AttributeKey, LText } from '../../core/types'
import { ACTIVITY_BY_ID } from '../../data/activities'
import { activityBlock } from '../../sim/life/activities'
import { activityContext } from '../../sim/game/internal'
import { resolveTask } from '../../sim/game/agenda'
import {
  applyManagerTalk, applyTeamDinner, managerTalkScene, nationalCampScene, teamDinnerScene,
  type Scene, type SceneEffect, type SceneOutcome,
} from '../../sim/game/scenes'
import { talkBlock } from '../../sim/game/selection'
import { ONE_ON_ONE_ENERGY, ONE_ON_ONE_XP, oneOnOne, oneOnOneBlock, oneOnOnePartner } from '../../sim/game/weekIdeas'
import { developmentAreas } from '../../sim/career/attributeLife'
import { heroOvr } from '../../sim/career/progression'
import { clamp } from '../../sim/career/common'
import { playerDisplayName } from '../../sim/world/queries'
import type { TrainingOutcomeView, TrainingSessionView } from '../store'
import { commit, current, get, notify } from './session'
import { realActions } from './realActions'
import { talkManager } from './benchPath'

export type { Scene, SceneEffect, SceneOutcome }

export type BenchScene =
  | { kind: 'managerTalk' }
  | { kind: 'teamDinner' }
  | { kind: 'oneOnOne' }
  | { kind: 'nationalCamp'; taskId: string }
  | { kind: 'doping'; taskId: string }

/** The open moment (null = none). */
export const benchScene = signal<BenchScene | null>(null)

/** The dinner scene was played: the evening itself (activity, its events) runs once the scene closes. */
let dinnerPending = false

/** Close the open moment (and run a played dinner's evening, so its events do not pop over the scene). */
export function closeMoment(): void {
  benchScene.value = null
  if (dinnerPending) {
    dinnerPending = false
    realActions.doActivity('team_dinner')
  }
}

const say = (l: LText | null | undefined): void => notify(l ?? null, 'info')

/** The scene to show for an open moment (null: not available any more). */
export function sceneOf(b: BenchScene): Scene | null {
  const s = current()
  if (!s) return null
  switch (b.kind) {
    case 'managerTalk': return managerTalkScene(s)
    case 'teamDinner': return teamDinnerScene(s)
    case 'nationalCamp': return nationalCampScene(s)
    default: return null
  }
}

/** Why the team dinner cannot happen now (the activity's own blocks). */
export function teamDinnerBlock(): LText | null {
  const s = current()
  const def = ACTIVITY_BY_ID.team_dinner
  if (!s || !def) return null
  return activityBlock(s.hero, s.life, def, activityContext(s))
}

/** Open the manager's office (falls back to the toast when the talk is not possible). */
export function openManagerTalk(): void {
  const s = current()
  const why = s ? talkBlock(s) : null
  if (why) {
    say(why)
    return
  }
  benchScene.value = { kind: 'managerTalk' }
}

export function openTeamDinner(): void {
  const why = teamDinnerBlock()
  if (why) {
    say(why)
    return
  }
  const s = current()
  if (s && !teamDinnerScene(s)) {
    realActions.doActivity('team_dinner')
    return
  }
  benchScene.value = { kind: 'teamDinner' }
}

export function openOneOnOne(): void {
  const s = current()
  const why = s ? oneOnOneBlock(s) : null
  if (why) {
    say(why)
    return
  }
  benchScene.value = { kind: 'oneOnOne' }
}

/** Finish a dialogue scene with the picked answers. */
export function finishScene(b: BenchScene, picks: string[]): SceneOutcome {
  const fail: SceneOutcome = { ok: false, lines: [], effects: [] }
  if (b.kind === 'managerTalk') {
    const s = get()
    const r = applyManagerTalk(s, picks)
    if (!r.ok) {
      say(r.lines[0])
      return r
    }
    commit(s)
    return r
  }
  if (b.kind === 'teamDinner') {
    if (teamDinnerBlock()) return fail
    const s = get()
    const r = applyTeamDinner(s, picks)
    if (!r.ok) return r
    commit(s, { silent: true })
    // The evening itself (time, energy, money, the base dressing-room boost) runs on close.
    dinnerPending = true
    return r
  }
  if (b.kind === 'nationalCamp') {
    const s = get()
    const r = resolveTask(s, b.taskId, 'played', { picks })
    if (!r.ok) {
      say(r.lines[0])
      return fail
    }
    commit(s)
    return r.outcome ?? { ok: true, lines: r.lines, effects: [] }
  }
  return fail
}

/** The quick resolve of a moment: exactly the old one-tap outcome. Returns the lines to toast. */
export function quickScene(b: BenchScene): LText[] {
  switch (b.kind) {
    case 'managerTalk': return talkManager()
    case 'teamDinner':
      realActions.doActivity('team_dinner')
      return []
    case 'oneOnOne': {
      const s = get()
      const r = oneOnOne(s)
      if (!r.ok) {
        say(r.lines[0])
        return []
      }
      commit(s)
      return r.lines
    }
    case 'nationalCamp':
    case 'doping': {
      const s = get()
      const r = resolveTask(s, b.taskId, 'quick')
      if (!r.ok) {
        say(r.lines[0])
        return []
      }
      commit(s)
      return r.lines
    }
  }
}

export interface DopingOutcome { ok: boolean; lines: LText[]; effects: SceneEffect[] }

/** The doping test played (0..1 calm + forms): resolves the task and reports what moved. */
export function finishDoping(taskId: string, performance: number): DopingOutcome {
  const s = get()
  const h = s.hero
  const m0 = h.morale
  const d0 = s.life.discipline
  const r = resolveTask(s, taskId, 'played', { performance })
  if (!r.ok) {
    say(r.lines[0])
    return { ok: false, lines: [], effects: [] }
  }
  commit(s)
  // Raw XP the played test gives (sim/game/agenda dopingTest).
  const xp = Math.round(2 + clamp(performance, 0, 1) * 6)
  const effects: SceneEffect[] = [
    { key: 'morale', label: { tr: 'Moral', en: 'Morale' }, value: Math.round(h.morale - m0) },
    { key: 'xp', label: { tr: 'Özellik XP', en: 'Attribute XP' }, value: xp, attr: 'composure' },
  ]
  if (s.life.discipline !== d0) effects.push({ key: 'trust', label: { tr: 'Disiplin', en: 'Discipline' }, value: Math.round(s.life.discipline - d0) })
  return { ok: true, lines: r.lines, effects }
}

/** The 1-on-1 as a training-drill session view (the pair drill: passing, or the keeper drill for keepers). */
export function oneOnOneSession(): TrainingSessionView | null {
  const s = current()
  if (!s) return null
  const mate = oneOnOnePartner(s)
  if (!mate) return null
  const h = s.hero
  const factor = clamp(1 + (mate.ovr - heroOvr(h)) / 20, 0.6, 1.5)
  const areas = developmentAreas(h).slice(0, 2)
  const base = Math.round(ONE_ON_ONE_XP * factor * areas.length * 10) / 10
  const name = playerDisplayName(mate, 'short')
  const gk = h.position === 'GK'
  return {
    id: 'oneOnOne',
    name: { tr: `${name} ile birebir`, en: `One-on-one with ${name}` },
    desc: { tr: '', en: '' },
    group: 'technical', icon: 'handshake', energy: ONE_ON_ONE_ENERGY, focus: areas,
    xp: base, xpMax: Math.round(base * 1.333 * 10) / 10, xpMin: Math.round(base * 0.5 * 10) / 10,
    injuryRisk: 'safe', available: true,
    drill: { kind: gk ? 'goalkeeping' : 'passing', variant: 'standard' },
  }
}

/** Apply the played 1-on-1 (DrillOverlay's apply hook). */
export function applyOneOnOne(performance: number | undefined): TrainingOutcomeView {
  const s = get()
  const r = oneOnOne(s, performance)
  if (!r.ok) return { ok: false, error: r.lines[0], performance: performance ?? 0.6, xp: 0, attrXp: [], deltas: [], injured: false }
  commit(s)
  const attrXp: { key: AttributeKey; xp: number }[] = (r.xp ?? []).map((x) => ({ key: x.key, xp: x.xp }))
  return {
    ok: true, performance: performance ?? 0.6, injured: false, attrXp,
    xp: Math.round(attrXp.reduce((a, x) => a + x.xp, 0) * 10) / 10,
    deltas: [
      { key: 'xp', value: 0 },
      ...(r.relation ? [{ key: 'relation' as const, value: r.relation, label: r.partner ?? '', rel: 'teammate' as const }] : []),
      { key: 'energy', value: -ONE_ON_ONE_ENERGY },
    ],
  }
}
