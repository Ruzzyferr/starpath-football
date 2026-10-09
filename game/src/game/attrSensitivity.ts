/**
 * Attribute sensitivity of the live moments (owner requirement: every stat must tangibly change the game).
 *
 * For every attribute, the relevant moment is played many times — with the human-like bot or a fixed scripted
 * input — with the hero's attribute low (40) and high (85) and everything else equal (same seeds, same sheet),
 * and a mechanical metric is compared: top speed, time to 5 m, shot speed, aim error, bend, aerial wins,
 * shoulder duels won, clean first touches, interceptions, saves, claims, completed distributions…
 * attrSensitivity.test.ts asserts a meaningful, correctly-signed effect for each and prints the
 * "etki tablosu" (docs/BALANCE.md, Özellik etki tablosu).
 */
import type { AttributeKey, Attributes, Position } from '../core/types'
import { SENS_HIGH, SENS_LOW, evenSheet } from '../sim/match/attrSensitivity'
import type { Highlight, HighlightKind } from '../sim/match/types'
import { PITCH_LENGTH } from '../sim/match/types'
import { generatedHighlight } from './demoHighlights'
import { isSuccess } from './feelHarness'
import { createHumanBot, humanBotStep } from './humanBot'
import { GOAL_CENTER_Y } from './physics'
import { HighlightRuntime, type HeroAction, type RuntimeEvent } from './runtime'

export { SENS_HIGH, SENS_LOW }

const DT = 1 / 60

/** A generated moment of `kind` for a hero sheet (both teams ~65), optionally at another minute / with the armband. */
export function sensHighlight(kind: HighlightKind, seed: number, pos: Position, attrs: Attributes, opts: { minute?: number; captain?: boolean } = {}): Highlight {
  const hl = generatedHighlight(kind, seed, { ovr: 65, heroPos: pos, heroAttrs: attrs })
  if (opts.captain) hl.scenario.heroCaptain = true
  return { ...hl, minute: opts.minute ?? hl.minute }
}

type Script = (rt: HighlightRuntime, t: number) => void

/** Plays a moment to the end with the average bot (or a script); `watch` sees every frame's events. */
function play(hl: Highlight, seed: number, script: Script | null, watch?: (rt: HighlightRuntime, ev: RuntimeEvent[]) => void, maxS = 40): HighlightRuntime {
  const rt = new HighlightRuntime(hl, { aimAssist: 'full', slowMoAim: true, difficulty: 'normal', seed: seed * 7919 + 13 })
  const bot = script ? null : createHumanBot('average', seed)
  let t = 0
  for (let f = 0; f < maxS * 60 && !rt.finished; f++) {
    if (bot) humanBotStep(rt, bot, DT)
    else script!(rt, t)
    rt.update(DT)
    t += DT
    const ev = rt.drainEvents()
    watch?.(rt, ev)
  }
  return rt
}

/** Waits for the live phase, then lets `act` drive the hero. */
const live = (act: Script): Script => (rt, t) => {
  if (rt.phase !== 'live') {
    rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
    return
  }
  act(rt, t)
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const median = (xs: readonly number[]) => {
  if (!xs.length) return 0
  const v = [...xs].sort((a, b) => a - b)
  const m = v.length >> 1
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2
}
const share = (hits: number, of: number) => (of > 0 ? hits / of : 0)

// ───────────────────────── Probes ─────────────────────────

export interface MomentProbe {
  attr: AttributeKey
  kind: HighlightKind
  pos: Position
  /** What is measured (etki tablosu). */
  metric: string
  unit: string
  /** +1: the high value must raise the metric; −1: lower it. */
  sign: 1 | -1
  /** Minimum signed effect (high − low)·sign. */
  min: number
  /** Also required: the effect relative to the low value (error metrics: 0.25 = a quarter less miss). */
  rel?: number
  n: number
  /** Measures the metric for a hero sheet over `n` seeds. */
  run: (attrs: Attributes, n: number) => number
}

/** Bot success rate (feel harness definition) of `kind`. */
const successRate = (kind: HighlightKind, pos: Position, opts: { minute?: number; captain?: boolean } = {}) => (attrs: Attributes, n: number) => {
  let ok = 0
  for (let s = 1; s <= n; s++) {
    const rt = play(sensHighlight(kind, s, pos, attrs, opts), s, null)
    if (rt.result && isSuccess(kind, rt.result.outcome)) ok++
  }
  return ok / n
}

/** Sprints flat out back toward our own goal from the start of `kind`: [distance after `secs`, top speed, time to 5 m, sprint seconds before the tank ran dry]. */
function sprint(kind: HighlightKind, pos: Position, attrs: Attributes, seed: number, secs: number, minute?: number): [number, number, number, number] {
  const hl = sensHighlight(kind, seed, pos, attrs, minute !== undefined ? { minute } : {})
  const rt = new HighlightRuntime(hl, { aimAssist: 'full', slowMoAim: false, difficulty: 'normal', seed })
  let start: { x: number; y: number } | null = null
  let top = 0
  let t5 = -1
  let dry = -1
  let t = 0
  let d = 0
  for (let f = 0; f < (secs + 3) * 60 && !rt.finished; f++) {
    if (rt.phase === 'live') {
      start ??= { ...rt.hero.pos }
      rt.setControl({ move: { x: -1, y: 0 }, sprint: true })
      t += DT
    }
    rt.update(DT)
    rt.drainEvents()
    if (!start) continue
    d = Math.hypot(rt.hero.pos.x - start.x, rt.hero.pos.y - start.y)
    top = Math.max(top, Math.hypot(rt.hero.vel.x, rt.hero.vel.y))
    if (t5 < 0 && d >= 5) t5 = t
    if (dry < 0 && rt.hero.stamina <= 0.05) dry = t
    if (t >= secs) break
  }
  return [d, top, t5, dry < 0 ? t : dry]
}

const sprintMetric = (idx: 0 | 1 | 2 | 3, secs: number, minute?: number) => (attrs: Attributes, n: number) =>
  mean(Array.from({ length: n }, (_, i) => sprint('recovery_run', 'CM', attrs, i + 1, secs, minute)[idx]))

/**
 * A scripted kick: `act` returns the action once the hero is on the ball (and the aim point it means). Returns
 * the kick speed, the lateral miss of the launch line at the aim (m) and the planned bend of the noiseless path.
 */
function scriptedKick(kind: HighlightKind, pos: Position, attrs: Attributes, seed: number, act: (rt: HighlightRuntime) => { action: HeroAction; aim?: { x: number; y: number } } | null, opts: KickOpts = {}): { speed: number; err: number; bend: number } | null {
  const hl = sensHighlight(kind, seed, pos, attrs)
  let aim: { x: number; y: number } | null = null
  let bend = 0
  let out: { speed: number; err: number; bend: number } | null = null
  let fired = false
  play(hl, seed, live((r) => {
    r.setControl({ move: { x: 0, y: 0 }, sprint: false })
    if (fired || !r.heroOnBall || r.time < 0.3) return
    // Carry it in to finishing range first.
    if (opts.approach !== undefined && Math.hypot(PITCH_LENGTH - r.hero.pos.x, GOAL_CENTER_Y - r.hero.pos.y) > opts.approach) {
      const dx = PITCH_LENGTH - r.hero.pos.x
      const dy = GOAL_CENTER_Y - r.hero.pos.y
      const l = Math.hypot(dx, dy)
      r.setControl({ move: { x: dx / l, y: dy / l }, sprint: false })
      return
    }
    // A defender right at his shoulder as he strikes it.
    if (opts.pressure) {
      const o = r.agents.filter((q) => q.team === 'opp' && !q.isKeeper).sort((p, q) => Math.hypot(p.pos.x - r.hero.pos.x, p.pos.y - r.hero.pos.y) - Math.hypot(q.pos.x - r.hero.pos.x, q.pos.y - r.hero.pos.y))[0]
      if (o) o.pos = { x: r.hero.pos.x + 0.6, y: r.hero.pos.y + 0.7 }
    }
    const a = act(r)
    if (!a) return
    // The noiseless plan of the same action: its target, and how far the planned flight bends off the straight line.
    const aimState = a.action.kind === 'shoot' ? { kind: 'target' as const, target: a.action.target, power: a.action.power, curl: a.action.curl, chip: a.action.chip } : a.action.kind === 'swipe' ? { kind: 'swipe' as const, swipe: a.action.swipe } : null
    const pv = aimState ? r.preview(aimState) : null
    aim = a.aim ?? pv?.target ?? null
    if (pv && aim) {
      const from = { x: r.ball.x, y: r.ball.y }
      const ax = aim.x - from.x
      const ay = aim.y - from.y
      const l = Math.hypot(ax, ay) || 1
      for (const q of pv.points) bend = Math.max(bend, Math.abs(((q.x - from.x) * ay - (q.y - from.y) * ax) / l))
    }
    fired = true
    r.queueAction(a.action)
  }), (r, ev) => {
    if (out || !aim) return
    for (const e of ev) {
      if (e.type !== 'kick' || !e.hero) continue
      const vx = r.ball.vx
      const vy = r.ball.vy
      const v = Math.hypot(vx, vy) || 1
      const tx = aim.x - e.x
      const ty = aim.y - e.y
      // Perpendicular miss of the launch line at the aim point.
      out = { speed: e.speed, err: Math.abs((vx * ty - vy * tx) / v), bend }
    }
  }, 8)
  return out
}

interface KickOpts {
  /** Carry the ball to within this distance (m) of goal before the kick. */
  approach?: number
  /** Put the nearest defender at the kicker's shoulder. */
  pressure?: boolean
}

const kickStat = (kind: HighlightKind, pos: Position, field: 'speed' | 'err' | 'bend', act: (rt: HighlightRuntime) => { action: HeroAction; aim?: { x: number; y: number } } | null, agg: 'mean' | 'median' = 'mean', opts: KickOpts = {}) => (attrs: Attributes, n: number) => {
  const xs: number[] = []
  for (let s = 1; s <= n; s++) {
    const r = scriptedKick(kind, pos, attrs, s, act, opts)
    if (r) xs.push(r[field])
  }
  return agg === 'median' ? median(xs) : mean(xs)
}

/** Shoot at a fixed goal-line point (curl 0 unless given): the intended aim is that point. */
const shootAt = (y: number, power: number, curl = 0) => (rt: HighlightRuntime) => {
  void rt
  const target = { x: PITCH_LENGTH + 0.1, y: GOAL_CENTER_Y + y }
  return { action: { kind: 'shoot', target, power, curl, chip: false } as HeroAction, aim: target }
}

/** Pass to the team-mate `pick` chooses (lofted when far): the aim is the planned (noiseless) target. */
const passTo = (pick: (rt: HighlightRuntime) => { x: number; y: number } | null, lofted?: boolean) => (rt: HighlightRuntime) => {
  const p = pick(rt)
  if (!p) return null
  const dx = p.x - rt.ball.x
  const dy = p.y - rt.ball.y
  const l = Math.hypot(dx, dy) || 1
  return { action: { kind: 'swipe', swipe: { dir: { x: dx / l, y: dy / l }, length: 0.4, duration: 0.2, speed: 2, power: 0.7, curl: 0, chip: !!lofted, isTap: false } } as HeroAction }
}

const mates = (rt: HighlightRuntime) => rt.agents.filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper)
const nearMate = (lo: number, hi: number) => (rt: HighlightRuntime) =>
  mates(rt).map((a) => ({ p: a.pos, d: Math.hypot(a.pos.x - rt.hero.pos.x, a.pos.y - rt.hero.pos.y) })).filter((m) => m.d > lo && m.d < hi).sort((p, q) => p.d - q.d)[0]?.p ?? null
const farMate = (rt: HighlightRuntime) => mates(rt).sort((p, q) => Math.abs(q.pos.y - rt.hero.pos.y) - Math.abs(p.pos.y - rt.hero.pos.y))[0]?.pos ?? null

/** Counts hero events across `n` bot-played moments: returns hits / tries for the given classifiers. */
const eventShare = (kind: HighlightKind, pos: Position, hit: (e: RuntimeEvent, rt: HighlightRuntime) => boolean, of: (e: RuntimeEvent, rt: HighlightRuntime) => boolean, opts: { minute?: number; captain?: boolean } = {}) => (attrs: Attributes, n: number) => {
  let h = 0
  let o = 0
  for (let s = 1; s <= n; s++) {
    play(sensHighlight(kind, s, pos, attrs, opts), s, null, (rt, ev) => {
      for (const e of ev) {
        if (of(e, rt)) o++
        if (hit(e, rt)) h++
      }
    })
  }
  return share(h, o)
}

/** Share of bot-played moments in which `pred` holds at the end. */
const momentShare = (kind: HighlightKind, pos: Position, pred: (rt: HighlightRuntime, evs: RuntimeEvent[]) => boolean, opts: { minute?: number; captain?: boolean } = {}) => (attrs: Attributes, n: number) => {
  let k = 0
  for (let s = 1; s <= n; s++) {
    const evs: RuntimeEvent[] = []
    const rt = play(sensHighlight(kind, s, pos, attrs, opts), s, null, (_, ev) => evs.push(...ev))
    if (pred(rt, evs)) k++
  }
  return k / n
}

const heroId = (rt: HighlightRuntime) => rt.hero.id

/** The probe set: one (or two) per attribute, each on the moment that exercises it. */
export const MOMENT_PROBES: readonly MomentProbe[] = [
  // ── Physical ──
  { attr: 'pace', kind: 'recovery_run', pos: 'CM', metric: 'sprint top speed', unit: 'm/s', sign: 1, min: 0.8, n: 12, run: sprintMetric(1, 3) },
  { attr: 'acceleration', kind: 'recovery_run', pos: 'CM', metric: 'time to 5 m from standing', unit: 's', sign: -1, min: 0.08, n: 12, run: sprintMetric(2, 3) },
  { attr: 'stamina', kind: 'recovery_run', pos: 'CM', metric: 'distance in an 8 s sprint at 85\'', unit: 'm', sign: 1, min: 3, n: 12, run: sprintMetric(0, 8, 85) },
  { attr: 'workRate', kind: 'recovery_run', pos: 'CM', metric: 'sprint time before the tank runs dry (70\')', unit: 's', sign: 1, min: 0.6, n: 12, run: sprintMetric(3, 9, 70) },
  {
    attr: 'strength', kind: 'shoulder_duel', pos: 'ST', metric: 'shoulder contacts won', unit: '%', sign: 1, min: 0.15, n: 120,
    run: eventShare('shoulder_duel', 'ST', (e, rt) => e.type === 'shoulder' && e.by === heroId(rt), (e) => e.type === 'shoulder'),
  },
  {
    attr: 'balance', kind: 'shoulder_duel', pos: 'ST', metric: 'knocked off his feet per contact', unit: '%', sign: -1, min: 0.06, n: 120,
    run: eventShare('shoulder_duel', 'ST', (e, rt) => e.type === 'shoulder' && e.on === heroId(rt) && e.down, (e) => e.type === 'shoulder'),
  },
  {
    attr: 'agility', kind: 'dribble', pos: 'LW', metric: 'time to turn and go back with the ball', unit: 's', sign: -1, min: 0.08, n: 20,
    run: (attrs, n) => {
      const ts: number[] = []
      for (let s = 1; s <= n; s++) {
        let turnAt = -1
        let back = -1
        play(sensHighlight('dribble', s, 'LW', attrs), s, live((r, t) => {
          if (turnAt < 0 && r.time > 0.8) turnAt = t
          r.setControl({ move: { x: turnAt < 0 ? 1 : -1, y: 0 }, sprint: false })
          if (turnAt >= 0 && back < 0 && r.hero.vel.x < -3) back = t - turnAt
        }), undefined, 3.5)
        if (back > 0) ts.push(back)
      }
      return mean(ts)
    },
  },
  {
    attr: 'jumping', kind: 'corner', pos: 'CB', metric: 'contested headers won at corners', unit: '%', sign: 1, min: 0.1, n: 300,
    run: eventShare('corner', 'CB', (e) => e.type === 'aerial' && e.heroIn && e.hero, (e) => e.type === 'aerial' && e.heroIn),
  },
  // ── Technical ──
  {
    attr: 'passing', kind: 'build_up', pos: 'CM', metric: 'short-pass miss at the receiver (median)', unit: 'm', sign: -1, min: 0.05, rel: 0.25, n: 80,
    run: kickStat('build_up', 'CM', 'err', passTo(nearMate(9, 22)), 'median'),
  },
  {
    attr: 'longPassing', kind: 'switch_play', pos: 'CM', metric: 'long diagonal miss at the far side (median)', unit: 'm', sign: -1, min: 0.15, rel: 0.3, n: 80,
    run: kickStat('switch_play', 'CM', 'err', passTo(farMate, true), 'median'),
  },
  {
    attr: 'crossing', kind: 'cross', pos: 'LW', metric: 'cross delivery error (median)', unit: 'm', sign: -1, min: 0.25, rel: 0.25, n: 80,
    run: (attrs, n) => {
      const errs: number[] = []
      for (let s = 1; s <= n; s++) {
        let aim: { x: number; y: number } | null = null
        let fired = false
        let landed: { x: number; y: number } | null = null
        play(sensHighlight('cross', s, 'LW', attrs), s, live((r) => {
          if (fired) return
          if (!r.heroOnBall || (r.hero.pos.y > 15 && r.hero.pos.y < 53)) {
            // Wide first: carry it to the touchline side if needed.
            r.setControl({ move: { x: 0.2, y: r.hero.pos.y < 34 ? -1 : 1 }, sprint: false })
            return
          }
          const target = { x: PITCH_LENGTH - 10, y: GOAL_CENTER_Y }
          const dx = target.x - r.ball.x
          const dy = target.y - r.ball.y
          const l = Math.hypot(dx, dy)
          const swipe = { dir: { x: dx / l, y: dy / l }, length: 0.4, duration: 0.2, speed: 2, power: 0.75, curl: 0, chip: false, isTap: false }
          const pv = r.preview({ kind: 'swipe', swipe })
          if (!pv || pv.kind !== 'cross') return
          aim = pv.target
          fired = true
          r.queueAction({ kind: 'swipe', swipe })
        }), (r, ev) => {
          if (!fired || landed || !aim) return
          if (ev.some((e) => e.type === 'kick' && !e.hero)) landed = { x: r.ball.x, y: r.ball.y }
          if (r.ball.z < 1.9 && r.ball.vz < 0 && r.ball.x > PITCH_LENGTH - 25) landed = { x: r.ball.x, y: r.ball.y }
        }, 10)
        if (aim && landed) errs.push(Math.hypot((landed as { x: number }).x - (aim as { x: number }).x, (landed as { y: number }).y - (aim as { y: number }).y))
      }
      return median(errs)
    },
  },
  {
    attr: 'dribbling', kind: 'dribble', pos: 'LW', metric: 'take-on success', unit: '%', sign: 1, min: 0.1, n: 300, run: successRate('dribble', 'LW'),
  },
  {
    attr: 'firstTouch', kind: 'long_ball_control', pos: 'ST', metric: 'first touch killed it (no heavy touch)', unit: '%', sign: 1, min: 0.1, n: 150,
    run: (attrs, n) => {
      let first = 0
      let clean = 0
      for (let s = 1; s <= n; s++) {
        let seen = false
        play(sensHighlight('long_ball_control', s, 'ST', attrs), s, null, (rt, ev) => {
          if (seen) return
          for (const e of ev) if (e.type === 'touch' && e.hero) {
            seen = true
            first++
            if (rt.owner === rt.hero) clean++
            break
          }
        })
      }
      return share(clean, first)
    },
  },
  {
    attr: 'shooting', kind: 'long_shot', pos: 'CM', metric: 'shot speed at full power', unit: 'm/s', sign: 1, min: 1.5, n: 30,
    run: kickStat('long_shot', 'CM', 'speed', shootAt(2.6, 1)),
  },
  {
    attr: 'finishing', kind: 'one_on_one', pos: 'ST', metric: 'close-range finish miss vs aim (median)', unit: 'm', sign: -1, min: 0.08, rel: 0.2, n: 80,
    run: kickStat('one_on_one', 'ST', 'err', shootAt(-2.6, 0.85), 'median', { approach: 11 }),
  },
  {
    attr: 'curve', kind: 'freekick', pos: 'AM', metric: 'bend on a full-curl free kick', unit: 'm', sign: 1, min: 0.5, n: 30,
    run: kickStat('freekick', 'AM', 'bend', shootAt(2.6, 0.85, 1)),
  },
  {
    attr: 'heading', kind: 'header', pos: 'ST', metric: 'headers on target', unit: '%', sign: 1, min: 0.1, n: 300,
    run: (attrs, n) => {
      let all = 0
      let on = 0
      for (let s = 1; s <= n; s++) {
        const rt = play(sensHighlight('header', s, 'ST', attrs), s, null)
        for (const x of rt.result?.shotLog ?? []) {
          if (!x.header) continue
          all++
          if (x.outcome === 'goal' || x.outcome === 'saved' || x.outcome === 'woodwork') on++
        }
      }
      return share(on, all)
    },
  },
  {
    attr: 'tackling', kind: 'defend', pos: 'CB', metric: 'standing tackles won per attempt', unit: '%', sign: 1, min: 0.1, n: 300,
    run: eventShare('defend', 'CB', (e, rt) => e.type === 'tackle' && e.by === heroId(rt) && e.won, (e, rt) => e.type === 'tackle' && e.by === heroId(rt) && !e.slide),
  },
  {
    attr: 'setPieces', kind: 'freekick', pos: 'AM', metric: 'free-kick aim error (median)', unit: 'm', sign: -1, min: 0.1, rel: 0.2, n: 80,
    run: kickStat('freekick', 'AM', 'err', shootAt(-2.6, 0.85), 'median'),
  },
  // ── Mental ──
  {
    attr: 'vision', kind: 'build_up', pos: 'CM', metric: 'highlighted pass options', unit: '#', sign: 1, min: 0.8, n: 40,
    run: (attrs, n) => {
      const counts: number[] = []
      for (let s = 1; s <= n; s++) {
        play(sensHighlight('build_up', s, 'CM', attrs), s, live((r) => {
          r.setControl({ move: { x: 0, y: 0 }, sprint: false })
          if (r.heroOnBall && r.time > 0.6 && r.time < 0.7) counts.push(r.passOptions().length)
        }), undefined, 1.5)
      }
      return mean(counts)
    },
  },
  {
    attr: 'composure', kind: 'edge_of_box', pos: 'AM', metric: 'shot miss with a defender on him (median)', unit: 'm', sign: -1, min: 0.1, rel: 0.15, n: 80,
    run: kickStat('edge_of_box', 'AM', 'err', shootAt(2.6, 0.85), 'median', { pressure: true }),
  },
  {
    attr: 'positioning', kind: 'timed_run', pos: 'ST', metric: 'caught offside', unit: '%', sign: -1, min: 0.06, n: 150,
    run: momentShare('timed_run', 'ST', (rt) => !!rt.result?.offside?.byHero),
  },
  {
    attr: 'anticipation', kind: 'interception', pos: 'CB', metric: 'read the pass and cut it out himself', unit: '%', sign: 1, min: 0.1, n: 200,
    run: momentShare('interception', 'CB', (rt) => (rt as unknown as { stats: { tackles: number } }).stats.tackles > 0),
  },
  {
    attr: 'aggression', kind: 'defend', pos: 'CB', metric: 'tackles won per attempt', unit: '%', sign: 1, min: 0.04, n: 300,
    run: eventShare('defend', 'CB', (e, rt) => e.type === 'tackle' && e.by === heroId(rt) && e.won, (e, rt) => e.type === 'tackle' && e.by === heroId(rt) && !e.slide),
  },
  {
    attr: 'aggression', kind: 'defend', pos: 'CB', metric: 'fouls given away (trade-off)', unit: '%', sign: 1, min: 0.02, n: 300,
    run: momentShare('defend', 'CB', (rt) => rt.result?.outcome === 'foul_committed'),
  },
  {
    attr: 'leadership', kind: 'cross', pos: 'ST', metric: 'calls for the ball answered (captain)', unit: '%', sign: 1, min: 0.1, n: 200,
    run: (attrs, n) => {
      let calls = 0
      let refused = 0
      for (let s = 1; s <= n; s++) {
        let called = false
        play(sensHighlight('cross', s, 'ST', attrs, { captain: true }), s, live((r) => {
          r.setControl({ move: { x: 0, y: 0 }, sprint: false })
          const o = r.owner
          if (!called && o && o.team === 'hero' && !o.isHero && r.time > 0.15) {
            called = true
            calls++
            r.queueAction({ kind: 'call' })
          }
        }), (_r, ev) => {
          for (const e of ev) if (e.type === 'callRefused') refused++
        }, 3)
      }
      return share(calls - refused, calls)
    },
  },
  // ── Goalkeeping ──
  { attr: 'reflexes', kind: 'gk_save', pos: 'GK', metric: 'shots kept out', unit: '%', sign: 1, min: 0.08, n: 150, run: successRate('gk_save', 'GK') },
  {
    attr: 'diving', kind: 'gk_save', pos: 'GK', metric: 'fingertip reach of a full-stretch dive', unit: 'm', sign: 1, min: 0.3, n: 20,
    run: (attrs, n) => {
      const reach: number[] = []
      for (let s = 1; s <= n; s++) {
        let y0 = Number.NaN
        let best = 0
        let dove = false
        play(sensHighlight('gk_save', s, 'GK', attrs), s, live((r) => {
          r.setControl({ move: { x: 0, y: 0 }, sprint: false })
          if (!dove && r.time > 0.3) {
            dove = true
            y0 = r.hero.pos.y
            r.queueAction({ kind: 'dive', dir: { x: 0.1, y: 1 } })
          }
        }), (r) => {
          if (dove && r.hero.state === 'dive') best = Math.max(best, Math.abs(r.hero.pos.y + r.hero.actionDir.y * (0.6 + 0.62 * (r.hero.attrs.diving / 100)) * 0.9 - y0))
        }, 2)
        reach.push(best)
      }
      return mean(reach)
    },
  },
  {
    attr: 'handling', kind: 'gk_save', pos: 'GK', metric: 'saves held (not parried)', unit: '%', sign: 1, min: 0.15, n: 150,
    run: eventShare('gk_save', 'GK', (e, rt) => e.type === 'save' && e.by === heroId(rt) && e.held, (e, rt) => e.type === 'save' && e.by === heroId(rt)),
  },
  {
    attr: 'gkPositioning', kind: 'gk_claim', pos: 'GK', metric: 'crosses claimed or punched', unit: '%', sign: 1, min: 0.1, n: 150,
    run: momentShare('gk_claim', 'GK', (rt, evs) => evs.some((e) => e.type === 'save' && e.by === rt.hero.id)),
  },
  {
    attr: 'gkDistribution', kind: 'gk_distribution', pos: 'GK', metric: 'kick-out miss at the far man (median)', unit: 'm', sign: -1, min: 0.1, rel: 0.25, n: 80,
    run: kickStat('gk_distribution', 'GK', 'err', passTo(farMate, true), 'median'),
  },
]

export interface MomentSensRow {
  probe: MomentProbe
  low: number
  high: number
  /** Signed effect (high − low)·sign. */
  effect: number
}

/** Runs a probe: `n` seeds low, the same seeds high. */
export function runMomentProbe(p: MomentProbe, n = p.n): MomentSensRow {
  const sheet = (v: number): Attributes => ({ ...evenSheet(p.pos), [p.attr]: v })
  const low = p.run(sheet(SENS_LOW), n)
  const high = p.run(sheet(SENS_HIGH), n)
  return { probe: p, low, high, effect: (high - low) * p.sign }
}

const fmtV = (v: number, unit: string) => (unit === '%' ? `${(v * 100).toFixed(1)}%` : `${v.toFixed(2)} ${unit}`)

/** One markdown row of the etki tablosu: attribute | moment | metric | low | high | effect. */
export const probeTableRow = (r: MomentSensRow): string =>
  `| ${r.probe.attr} | ${r.probe.kind} | ${r.probe.metric} | ${fmtV(r.low, r.probe.unit)} | ${fmtV(r.high, r.probe.unit)} | ${r.probe.unit === '%' ? `${(r.effect * 100).toFixed(1)} pp` : `${r.effect.toFixed(2)} ${r.probe.unit}`} |`

/** True when a row clears its probe's bar (absolute, and relative when set). */
export function probePasses(r: MomentSensRow): boolean {
  if (r.effect < r.probe.min) return false
  return r.probe.rel === undefined || r.effect >= r.probe.rel * Math.abs(r.low)
}
