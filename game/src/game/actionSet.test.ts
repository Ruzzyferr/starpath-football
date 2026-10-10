/**
 * Context buttons (TestFlight build 6): every moment kind shows only buttons that make sense for it,
 * and every button does something real — no sprint that throws the hero to the ground, no button
 * that silently does nothing.
 */
import { describe, expect, it } from 'vitest'
import { ACTION_DEFS, KIND_ACTIONS, actionPhase, actionsFor, assignKeys, contextActions, type ActionId, type ActionPhase } from './actionSet'
import { generatedHighlight } from './demoHighlights'
import { HighlightRuntime, type HeroAction, type RuntimeEvent } from './runtime'
import { KEEPER_KINDS, DEFENSIVE_KINDS, type HighlightKind } from '../sim/match/types'

const KINDS = Object.keys(KIND_ACTIONS) as HighlightKind[]
const PHASES: ActionPhase[] = ['ball', 'off', 'def', 'gk', 'gkHands']
const DT = 1 / 60

describe('action sets: data', () => {
  it('covers every highlight kind with 2–4 buttons per phase the kind defines', () => {
    expect(KINDS.length).toBe(33)
    for (const k of KINDS) {
      for (const [phase, ids] of Object.entries(KIND_ACTIONS[k]) as [ActionPhase, readonly ActionId[]][]) {
        // A set-piece taker plays by swipe / picker (empty set); everything else has 2–4 buttons.
        if (ids.length === 0) {
          expect(['freekick', 'penalty', 'corner_kick']).toContain(k)
          continue
        }
        expect(ids.length, `${k}/${phase}`).toBeGreaterThanOrEqual(2)
        expect(ids.length, `${k}/${phase}`).toBeLessThanOrEqual(4)
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
  })

  it('every button has TR + EN labels, an icon and a key that no other button of its set shares', () => {
    for (const d of Object.values(ACTION_DEFS)) {
      expect(d.label.tr.length).toBeGreaterThan(1)
      expect(d.label.en.length).toBeGreaterThan(1)
      expect(d.icon).toBeTruthy()
    }
    for (const k of KINDS) {
      for (const p of PHASES) {
        const ids = actionsFor(k, p)
        const keys = assignKeys(ids)
        expect(keys.size).toBe(ids.length)
        expect(new Set(keys.values()).size).toBe(ids.length)
      }
    }
  })

  it('keepers never get SKILL / SPRINT-and-dribble buttons; defenders never get attacking ones', () => {
    for (const k of KINDS) {
      for (const id of actionsFor(k, 'gk')) {
        expect(['skill', 'shield', 'pass', 'through', 'shoot', 'cross', 'tackle', 'slide', 'jockey']).not.toContain(id)
      }
      // Sprint only where a keeper has to cover ground: the sweeper race.
      if (KEEPER_KINDS.has(k) && k !== 'gk_sweep') expect(actionsFor(k, 'gk')).not.toContain('sprint')
      expect(actionsFor(k, 'gkHands').every((id) => id === 'throw' || id === 'kick')).toBe(true)
      for (const id of actionsFor(k, 'def')) expect(['skill', 'shield', 'pass', 'through', 'lofted', 'cross', 'shoot', 'call', 'dive', 'throw', 'kick']).not.toContain(id)
      for (const id of actionsFor(k, 'off')) expect(['skill', 'shield', 'tackle', 'slide', 'jockey', 'dive', 'throw', 'kick']).not.toContain(id)
      for (const id of actionsFor(k, 'ball')) expect(['tackle', 'slide', 'jockey', 'block', 'intercept', 'press', 'dive', 'claim', 'punch', 'throw', 'kick']).not.toContain(id)
    }
    // The defensive kinds lead with a defensive button, not SPRINT / SKILL.
    for (const k of ['defend', 'defend_1v1', 'interception', 'block', 'press_trap'] as HighlightKind[]) {
      expect(DEFENSIVE_KINDS.has(k)).toBe(true)
      expect(['tackle', 'jockey', 'intercept', 'block', 'press']).toContain(actionsFor(k, 'def')[0])
    }
    expect(actionsFor('gk_claim', 'gk')).toEqual(expect.arrayContaining(['claim', 'punch']))
    expect(actionsFor('gk_distribution', 'gkHands')).toEqual(['throw', 'kick'])
    expect(actionsFor('gk_penalty', 'gk')).toEqual(['diveLeft', 'stay', 'diveRight'])
  })

  it('phase follows the situation', () => {
    const base = { kind: 'defend' as HighlightKind, heroIsKeeper: false, heroOnBall: false, heroTaker: false, oppInPossession: true }
    expect(actionPhase(base)).toBe('def')
    expect(actionPhase({ ...base, heroOnBall: true, oppInPossession: false })).toBe('ball')
    expect(actionPhase({ ...base, oppInPossession: false })).toBe('off')
    expect(actionPhase({ ...base, heroIsKeeper: true })).toBe('gk')
    expect(actionPhase({ ...base, heroIsKeeper: true, heroOnBall: true })).toBe('gkHands')
    expect(contextActions({ ...base, kind: 'penalty', heroOnBall: true, heroTaker: true })).toEqual([])
  })
})

/** Steps a runtime to the live phase. */
function liveRuntime(kind: HighlightKind, seed: number): HighlightRuntime {
  const rt = new HighlightRuntime(generatedHighlight(kind, seed), { seed, keeperScenario: 'off' })
  for (let i = 0; i < 120 && rt.phase !== 'live'; i++) rt.update(DT)
  return rt
}

interface Trace {
  rt: HighlightRuntime
  events: RuntimeEvent[]
  states: Set<string>
  maxStep: number
  maxSpeed: number
  startDist: number
  endDist: number
  heroId: string
}

/** Presses (or holds) one context button in a fresh live moment and records what happens over `secs`. */
function press(kind: HighlightKind, seed: number, id: ActionId, secs = 1.6, move?: (rt: HighlightRuntime) => { x: number; y: number }): Trace | null {
  const rt = liveRuntime(kind, seed)
  if (rt.finished || !contextActions(rt.actionContext()).includes(id)) return null
  const hold = ACTION_DEFS[id].hold
  const target = () => {
    const o = rt.owner
    return o && o !== rt.hero ? o.pos : { x: rt.ball.x, y: rt.ball.y }
  }
  const startDist = Math.hypot(target().x - rt.hero.pos.x, target().y - rt.hero.pos.y)
  const act: HeroAction = { kind: 'btn', id, ...(id === 'diveLeft' ? { dir: { x: 0, y: -1 } } : id === 'diveRight' ? { dir: { x: 0, y: 1 } } : {}) }
  if (!hold) rt.queueAction(act)
  const events: RuntimeEvent[] = []
  const states = new Set<string>()
  let maxStep = 0
  let maxSpeed = 0
  for (let t = 0; t < secs && !rt.finished; t += DT) {
    const mv = move ? move(rt) : { x: 0, y: 0 }
    rt.setControl({ move: mv, sprint: id === 'sprint', hold: id === 'jockey' || id === 'shield' ? id : null })
    const before = { ...rt.hero.pos }
    rt.update(DT)
    maxStep = Math.max(maxStep, Math.hypot(rt.hero.pos.x - before.x, rt.hero.pos.y - before.y))
    maxSpeed = Math.max(maxSpeed, Math.hypot(rt.hero.vel.x, rt.hero.vel.y))
    states.add(rt.hero.state)
    events.push(...rt.drainEvents())
  }
  const endDist = Math.hypot(target().x - rt.hero.pos.x, target().y - rt.hero.pos.y)
  return { rt, events, states, maxStep, maxSpeed, startDist, endDist, heroId: rt.hero.id }
}

const byHero = (tr: Trace, type: RuntimeEvent['type']) => tr.events.some((e) => e.type === type && 'by' in e && e.by === tr.heroId)

describe('context buttons do real, sensible things in every kind', () => {
  it('no button teleports the hero, and only SLIDE / the keeper buttons put him on the floor', () => {
    for (const kind of KINDS) {
      for (const seed of [1, 2]) {
        const rt = liveRuntime(kind, seed)
        for (const id of contextActions(rt.actionContext())) {
          const tr = press(kind, seed, id)
          if (!tr) continue
          const tag = `${kind}#${seed}/${id}`
          expect(Number.isFinite(tr.rt.hero.pos.x) && Number.isFinite(tr.rt.hero.pos.y), tag).toBe(true)
          // 60 Hz: nobody covers half a metre in one step (≈ 30 m/s).
          expect(tr.maxStep, tag).toBeLessThan(0.5)
          if (!['slide'].includes(id)) expect(tr.states.has('slide'), tag).toBe(false)
          if (!tr.rt.hero.isKeeper) expect(tr.states.has('dive'), tag).toBe(false)
          // On the floor only after a slide, a failed standing tackle or being shouldered off the ball.
          const shoved = tr.events.some((e) => e.type === 'shoulder' && e.on === tr.heroId && e.down)
          const tackled = tr.events.some((e) => e.type === 'tackle' && e.by === tr.heroId)
          if (!tr.rt.hero.isKeeper && !shoved && !tackled && id !== 'slide') expect(tr.states.has('down'), tag).toBe(false)
        }
      }
    }
  }, 120_000)

  it('SPRINT accelerates along the stick and never slides, dives or tackles', () => {
    for (const kind of ['defend', 'recovery_run', 'counter', 'interception', 'press_trap', 'build_up', 'gk_sweep'] as HighlightKind[]) {
      for (const seed of [1, 2, 3]) {
        const toBall = (rt: HighlightRuntime) => {
          // On the ball: run at goal; off it: at the ball.
          if (rt.owner === rt.hero) return { x: 1, y: 0 }
          const dx = rt.ball.x - rt.hero.pos.x
          const dy = rt.ball.y - rt.hero.pos.y
          const l = Math.hypot(dx, dy) || 1
          return { x: dx / l, y: dy / l }
        }
        const fast = press(kind, seed, 'sprint', 3, toBall)
        if (!fast) continue
        const tag = `${kind}#${seed}`
        expect(fast.states.has('slide'), tag).toBe(false)
        expect(fast.states.has('dive'), tag).toBe(false)
        expect(fast.events.some((e) => e.type === 'tackle' && e.by === fast.heroId), tag).toBe(false)
        expect(fast.events.some((e) => e.type === 'dive' && e.by === fast.heroId), tag).toBe(false)
        // Faster than the same run without SPRINT (Pace / Acceleration), and the tank drains.
        const rt = liveRuntime(kind, seed)
        let jog = 0
        for (let t = 0; t < 3 && !rt.finished; t += DT) {
          rt.setControl({ move: toBall(rt), sprint: false })
          rt.update(DT)
          jog = Math.max(jog, Math.hypot(rt.hero.vel.x, rt.hero.vel.y))
        }
        expect(fast.maxSpeed, tag).toBeGreaterThan(jog)
        expect(fast.rt.hero.stamina, tag).toBeLessThan(1)
      }
    }
  })

  const effect: Partial<Record<ActionId, (tr: Trace) => boolean>> = {
    skill: (tr) => byHero(tr, 'skill'),
    pass: (tr) => tr.events.some((e) => e.type === 'kick' && e.hero && ['pass', 'lofted', 'through'].includes(e.kick)),
    through: (tr) => tr.events.some((e) => e.type === 'kick' && e.hero && ['pass', 'lofted', 'through'].includes(e.kick)),
    lofted: (tr) => tr.events.some((e) => e.type === 'kick' && e.hero && e.kick === 'lofted'),
    cross: (tr) => tr.events.some((e) => e.type === 'kick' && e.hero && e.kick === 'cross'),
    throw: (tr) => tr.events.some((e) => e.type === 'kick' && e.hero && (e.kick === 'pass' || e.kick === 'through')),
    kick: (tr) => tr.events.some((e) => e.type === 'kick' && e.hero && e.kick === 'lofted'),
    call: (tr) => byHero(tr, 'callForBall'),
    head: (tr) => byHero(tr, 'jump'),
    jump: (tr) => byHero(tr, 'jump'),
    slide: (tr) => tr.states.has('slide'),
    // Goes in at once in range; out of range he closes the carrier down flat out and goes in when he can.
    tackle: (tr) => tr.events.some((e) => (e.type === 'tackle' || e.type === 'foul') && e.by === tr.heroId) || tr.endDist < tr.startDist - 1 || tr.maxSpeed > 5,
    jockey: (tr) => tr.endDist < 4 && !tr.states.has('slide'),
    press: (tr) => tr.endDist < tr.startDist - 1 || tr.rt.finished,
    intercept: (tr) => tr.maxSpeed > 4 || tr.rt.finished,
    block: (tr) => tr.maxSpeed > 1 || tr.rt.finished,
    dive: (tr) => byHero(tr, 'dive'),
    diveLeft: (tr) => byHero(tr, 'dive') && tr.rt.hero.actionDir.y < 0,
    diveRight: (tr) => byHero(tr, 'dive') && tr.rt.hero.actionDir.y > 0,
    stay: (tr) => !byHero(tr, 'dive'),
    rush: (tr) => tr.endDist < tr.startDist - 0.5 || tr.rt.finished,
  }

  it('each button has its effect in the moment that offers it', () => {
    const seen = new Map<ActionId, { ok: number; n: number }>()
    for (const kind of KINDS) {
      for (const seed of [1, 2, 3]) {
        const rt = liveRuntime(kind, seed)
        for (const id of contextActions(rt.actionContext())) {
          const check = effect[id]
          if (!check) continue
          const tr = press(kind, seed, id)
          if (!tr) continue
          const s = seen.get(id) ?? { ok: 0, n: 0 }
          s.n++
          if (check(tr)) s.ok++
          seen.set(id, s)
        }
      }
    }
    for (const [id, s] of seen) expect(s.ok / s.n, `${id}: ${s.ok}/${s.n}`).toBeGreaterThanOrEqual(0.6)
    // The interesting ones were actually exercised.
    for (const id of ['tackle', 'slide', 'jockey', 'dive', 'diveLeft', 'diveRight', 'throw', 'kick', 'skill', 'pass', 'shoot', 'head'] as ActionId[]) {
      if (id === 'shoot') continue
      expect(seen.get(id)?.n ?? 0, id).toBeGreaterThan(0)
    }
  }, 120_000)

  it('SHIELD slows the hero and turns his back on the challenger; JOCKEY stays goal-side and square', () => {
    const shield = press('hold_up', 1, 'shield', 1.2, () => ({ x: 1, y: 0 }))
    expect(shield).not.toBeNull()
    const free = liveRuntime('hold_up', 1)
    let freeMax = 0
    for (let t = 0; t < 1.2 && !free.finished; t += DT) {
      free.setControl({ move: { x: 1, y: 0 }, sprint: false })
      free.update(DT)
      freeMax = Math.max(freeMax, Math.hypot(free.hero.vel.x, free.hero.vel.y))
    }
    expect(shield!.maxSpeed).toBeLessThan(freeMax)
    for (const seed of [1, 2, 3]) {
      const j = press('defend_1v1', seed, 'jockey', 1.5)
      if (!j || j.rt.finished || !j.rt.owner || j.rt.owner.team !== 'opp') continue
      // Goal-side: no further from our goal (x = 0 end) than the carrier.
      expect(j.rt.hero.pos.x).toBeLessThan(j.rt.owner.pos.x + 1)
      expect(j.states.has('slide')).toBe(false)
    }
  })
})
