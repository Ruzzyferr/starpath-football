/**
 * A noisy, human-like scripted player for balance measurement ("feel" tests).
 *
 * Unlike {@link autopilotStep} (a near-perfect, deterministic bot), this one
 * models an actual thumb on a phone: aim scatter on the goal line, uneven
 * swipe power, late reactions, the occasional wrong-way dive and mistimed
 * tackles/jumps. It drives the runtime only through the public input API
 * (setControl / queueAction) exactly like the UI does.
 *
 * Levels are calibrated against intuition for touch play with aim assist:
 *  - novice: first sessions, big scatter, slow reactions
 *  - average: the "typical player" the match-feel targets are set for
 *  - good: experienced, consistent
 *  - expert: near-optimal human
 */
import { Rng } from '../core/rng'
import { PITCH_LENGTH } from '../sim/match/types'
import { interceptPoint, isBehind, keeperTarget, planSave } from './ai'
import { clamp01, dist, norm, sub, type Agent, type Vec2 } from './model'
import { GOAL_CENTER_Y, POST_Y_HIGH, POST_Y_LOW, predictTrajectory } from './physics'
import { phoneRuntime } from './phoneInput'
import type { HighlightRuntime } from './runtime'

export type BotLevel = 'novice' | 'average' | 'good' | 'expert'
export const BOT_LEVELS: readonly BotLevel[] = ['novice', 'average', 'good', 'expert']

export interface BotSkill {
  /** 1σ aim scatter of the chosen goal-line point (m). */
  aimSd: number
  /** Mean / 1σ of swipe power (0..1.15). */
  powerMean: number
  powerSd: number
  /** Reaction time to a shot / tackle chance (real seconds). */
  reaction: number
  /** Chance a keeper dive goes the wrong way. */
  wrongSide: number
  /** 1σ timing error of jumps / tackles (real seconds). */
  timingSd: number
  /** Distance band (m) at which the bot pulls the trigger in open play. */
  shootFrom: readonly [number, number]
  /** Defending: chance to wait for the carrier's heavy touch before tackling (vs. lunging at any time). */
  read: number
  /** Defending: chance to charge straight at the ball (ball-watching) instead of jockeying goal-side. */
  rush: number
  /** Defending: chance to go to ground with a slide when in range. */
  slide: number
  /** Defending: chance to read passing lanes / the pass when not engaged with the carrier. */
  anticipate: number
}

export const BOT_SKILL: Readonly<Record<BotLevel, BotSkill>> = {
  // Build 9: a genuinely careless player (the owner's "sloppy input"): late, loose aim, mistimed, reads nothing.
  novice: { aimSd: 2.8, powerMean: 0.92, powerSd: 0.2, reaction: 0.7, wrongSide: 0.5, timingSd: 0.38, shootFrom: [17, 26], read: 0.08, rush: 0.85, slide: 0.4, anticipate: 0.05 },
  average: { aimSd: 1.1, powerMean: 0.86, powerSd: 0.1, reaction: 0.32, wrongSide: 0.18, timingSd: 0.15, shootFrom: [12, 20], read: 0.5, rush: 0.22, slide: 0.18, anticipate: 0.45 },
  // (Build 9 all-✅ pass: the good player is the owner's "correct play" — he rarely charges or slides in blind.)
  good: { aimSd: 0.75, powerMean: 0.84, powerSd: 0.07, reaction: 0.25, wrongSide: 0.1, timingSd: 0.1, shootFrom: [11, 18], read: 0.72, rush: 0.04, slide: 0.03, anticipate: 0.7 },
  expert: { aimSd: 0.45, powerMean: 0.84, powerSd: 0.05, reaction: 0.2, wrongSide: 0.05, timingSd: 0.06, shootFrom: [10, 16], read: 0.88, rush: 0.04, slide: 0.04, anticipate: 0.85 },
}

export interface HumanBotState {
  rng: Rng
  skill: BotSkill
  /** Phone input path (game/phoneInput): context buttons, stick and on-screen holds only. */
  phone: boolean
  /** Real time (accumulated by the caller via `step`). */
  real: number
  lastAct: number
  shotSeenReal: number
  dove: boolean
  /** Open-play shooting distance chosen for this moment. */
  shootAt: number
  /** Real time the hero first had the ball (−1 = not on ball). */
  heldSinceReal: number
  /** Game time the hero got the ball (−1 = not on it): patience is judged on the pitch clock, not the slow-motion one. */
  heldSinceGame: number
  /** Intended side of goal (+1 / −1). */
  side: number
  /** Planned tackle distance for this moment. */
  tackleAt: number
  /** Will try a slide rather than wait for a standing tackle. */
  slider: boolean
  /** Keeper: how far toward the middle of his line he drifts off the ideal spot (0 = textbook, drawn once). */
  gkDrift: number
  /** gk_1v1: the distance (m) at which he comes off his line (−1 = never; drawn once). */
  rushAt: number
  /** block: pressed BLOCK for this shot. */
  blocked: boolean
  /** gk_1v1: real time he pressed RUSH (−1 = not yet). */
  rushReal: number
  /** Real-time offset of the jump/press (timing error). */
  jumpErr: number
  /** Real time at which a pending action fires. */
  pendingAt: number
  /** Wide player crosses (else cuts inside and shoots). */
  crosser: boolean
  /** Defending style for this moment: charges at the ball rather than jockeying. */
  rusher: boolean
  /** Waits for the carrier's heavy touch before tackling (this engagement). */
  reader: boolean
  /** Reads lanes when not engaged (this moment). */
  anticipator: boolean
  /** Real time the bot started waiting for a tackle opening (−1 = not waiting). */
  waitSince: number
  /** Id of the opponent carrier the current engagement is against. */
  engaged: string
  /** Real time the current engagement began (the defender sees the new carrier then). */
  engagedAt: number
  /** press_trap: the carrier he last pressed (PRESS again on the next one). */
  pressed: string
  /** Real time the ball last became loose (−1 = someone has it). */
  looseSince: number
  /** block: how far off the shooting line this player ends up (m, drawn once; NaN = not yet). */
  blockErr: number
  /** Real time the set-piece choice will be made (−1 = not yet planned). */
  choiceAt: number
  /** timed_run: the runner's error (m) in timing his call against their line (drawn once). */
  lineErr?: number
  /** timed_run: real time the run starts, and whether the call went in. */
  runAt: number
  called: boolean
  /** gk_claim: real time the cross was seen (−1 = not yet), and whether the keeper committed. */
  crossSeen: number
  claimed: boolean
}

/**
 * @param phone drive the runtime only through what a touch screen sends (game/phoneInput): the balance harness's
 *   default since the build 9 pressing report.
 */
export function createHumanBot(level: BotLevel, seed: number, phone = false): HumanBotState {
  const rng = new Rng(`bot:${level}:${seed}`)
  const skill = BOT_SKILL[level]
  return {
    rng,
    skill,
    phone,
    real: 0,
    lastAct: -10,
    shotSeenReal: -1,
    dove: false,
    shootAt: rng.range(skill.shootFrom[0], skill.shootFrom[1]),
    heldSinceReal: -1,
    heldSinceGame: -1,
    side: rng.chance(0.5) ? 1 : -1,
    tackleAt: Math.max(0.9, rng.normal(1.45, skill.timingSd * 3)),
    slider: rng.chance(skill.slide),
    // Build 9 (sloppy = sloppy): a poor keeper stands off the angle and comes out too early (or not at all).
    gkDrift: clamp01((1 - skill.read) * rng.range(0.6, 1.1)),
    // (A sensible keeper comes out to meet a man through on goal; a careless one goes far too early, or never.)
    rushAt: rng.chance(skill.read >= 0.5 ? 0.95 : 0.6) ? (skill.read >= 0.5 ? 7 : 14) + rng.normal(0, skill.timingSd * 8) : -1,
    blocked: false,
    rushReal: -1,
    jumpErr: rng.normal(0, skill.timingSd),
    pendingAt: -1,
    crosser: rng.chance(0.6),
    rusher: rng.chance(skill.rush),
    reader: rng.chance(skill.read),
    anticipator: rng.chance(skill.anticipate),
    waitSince: -1,
    engaged: '',
    engagedAt: 0,
    pressed: '',
    looseSince: -1,
    blockErr: Number.NaN,
    choiceAt: -1,
    runAt: rng.range(0.5, 2.2),
    called: false,
    crossSeen: -1,
    claimed: false,
  }
}

type Act = (a: Parameters<HighlightRuntime['queueAction']>[0]) => void

/**
 * Defending like a person: a patient defender gets goal-side, jockeys at
 * ~1.8 m and tackles when the carrier pushes the ball away from his feet; a
 * rash one charges at the ball and lunges whenever he gets close (and gets
 * turned or gives away fouls). Away from the ball, a reader steps into the
 * passing lane to the most dangerous runner.
 */
function defendStep(rt: HighlightRuntime, st: HumanBotState, owner: Agent, act: Act, moveTo: (p: Vec2, sprint?: boolean, hold?: 'jockey' | null) => void): void {
  const hero = rt.hero
  const d = dist(hero.pos, owner.pos)
  if (st.engaged !== owner.id) {
    // New carrier: re-roll this engagement's habits.
    st.engaged = owner.id
    st.engagedAt = st.real
    st.reader = st.rng.chance(st.skill.read)
    st.rusher = st.rng.chance(st.skill.rush)
    st.waitSince = -1
    st.pendingAt = -1
  }
  // (A careless defender is late off the mark — he sees who has it a beat after a sensible one, who reads it coming:
  // until then he carries on as he was. Back post: he is ball-watching anyway.)
  if (rt.kind !== 'back_post' && st.real - st.engagedAt < Math.max(0, st.skill.reaction - 0.2)) return
  const ownGoal = { x: 0, y: GOAL_CENTER_Y }
  const toGoal = norm(sub(ownGoal, owner.pos))
  // Back post: a sensible defender picks up the runner at the far post (goal-side, a yard off him, ball side) instead
  // of going to the crosser; a careless one watches the ball.
  if (rt.kind === 'back_post' && st.skill.read >= 0.5) {
    const runner = rt.agents
      .filter((a) => a.team === 'opp' && a !== owner && !a.isKeeper && a.pos.x < 20)
      .sort((p, q) => Math.abs(q.pos.y - owner.pos.y) - Math.abs(p.pos.y - owner.pos.y))[0]
    if (runner) {
      const g = norm(sub(ownGoal, runner.pos))
      const side = norm(sub(owner.pos, runner.pos))
      moveTo({ x: runner.pos.x + g.x * 0.9 + side.x * 0.4, y: runner.pos.y + g.y * 0.9 + side.y * 0.4 }, dist(hero.pos, runner.pos) > 2)
      return
    }
  }

  // Shot block: a composed defender gets his body into the shooting line ~1.7 m off the ball
  // and stays on his feet; how exactly he finds the line depends on skill. A rash one dives in.
  if (rt.kind === 'block' && !st.rusher) {
    if (Number.isNaN(st.blockErr)) st.blockErr = st.rng.normal(0, st.skill.aimSd * 0.45)
    const spot = { x: owner.pos.x + toGoal.x * 1.7 - toGoal.y * st.blockErr, y: owner.pos.y + toGoal.y * 1.7 + toGoal.x * st.blockErr }
    // Sprint to get there, then ease in (never charging at a set shooter).
    moveTo(spot, dist(hero.pos, spot) > 4 && dist(hero.pos, owner.pos) > 5)
    // In the line: spread himself (BLOCK) as the shooter sets — a reader on time, others late or never.
    // (Held while he stays in the line: the spread lasts ~1 s, so he renews it until the shot comes.)
    if (dist(hero.pos, spot) < 1 && st.reader && st.real > st.skill.reaction + 0.5 && st.real - st.lastAct > 0.9) {
      st.blocked = true
      act({ kind: 'btn', id: 'block' })
    }
    return
  }

  // Not engaged yet and a reader: cut the lane to the most dangerous runner.
  // Close to goal there is no time to wait: engage and get in the shooting lane.
  const urgent = dist(owner.pos, ownGoal) < 24
  const interception = rt.kind === 'interception'
  const mateOnHim = interception || rt.agents.some((a) => a.team === 'hero' && !a.isHero && !a.isKeeper && a.state === 'run' && dist(a.pos, owner.pos) < Math.min(d - 1, 4))
  if (d > 7 && (st.anticipator || (interception && st.skill.read >= 0.5)) && mateOnHim && !urgent) {
    const runner = rt.agents
      .filter((a) => a.team === 'opp' && a !== owner && !a.isKeeper)
      .sort((p, q) => p.pos.x - q.pos.x)[0]
    if (runner && runner.pos.x < owner.pos.x + 4) {
      const t = 0.45
      const lane = { x: owner.pos.x + (runner.pos.x - owner.pos.x) * t, y: owner.pos.y + (runner.pos.y - owner.pos.y) * t }
      // Stay goal-side of the lane point.
      moveTo({ x: lane.x - 1, y: lane.y }, true)
      return
    }
  }

  // (Pressing, a sensible one: curve the run so he stands in the line to the passer's nearest option — the cover shadow.)
  if (rt.kind === 'press_trap' && st.skill.read >= 0.5 && d < 14) {
    // PRESS (the moment's button): flat out at him, hurrying his pass — and again on the next man it goes to.
    if (st.pressed !== owner.id) {
      st.pressed = owner.id
      act({ kind: 'btn', id: 'press' })
    }
    const opt = rt.agents
      .filter((a) => a.team === 'opp' && a !== owner && !a.isKeeper)
      .sort((p, q) => dist(p.pos, owner.pos) - dist(q.pos, owner.pos))[0]
    const lane = opt ? norm(sub(opt.pos, owner.pos)) : toGoal
    // (Flat out to close him down, SPRINT let go for the last few metres: he arrives set — a presser who arrives at a
    // sprint is the one the carrier sells.)
    moveTo({ x: owner.pos.x + lane.x * 1.5, y: owner.pos.y + lane.y * 1.5 }, d > 4)
    if (d < 1.8 && owner.touch < 0.35) act({ kind: 'action' })
    return
  }
  // (Recovery run, a sensible one: the fastest line to him, flat out; a clean challenge in reach, never a lunge from behind.)
  // (Shoulder duel lost: the forward who was beaten to it gets straight back at the man — no jockeying a marker who is
  // about to clear it.)
  if ((rt.kind === 'recovery_run' || rt.kind === 'shoulder_duel') && st.skill.read >= 0.5) {
    // Far off: cut across to the line between him and goal (ahead of him), then step in.
    const ahead = d > 4 ? Math.min(6, d * 0.6) : 0.8
    moveTo({ x: owner.pos.x + toGoal.x * ahead, y: owner.pos.y + toGoal.y * ahead }, true)
    if (d < 1.8 && !isBehind(owner, hero)) act({ kind: 'action' })
    return
  }
  if (st.rusher) {
    // (A careless recovery: jogs back and only sprints once he is close.)
    moveTo(owner.pos, rt.kind !== 'recovery_run' || st.skill.read >= 0.5 || d < 4)
  } else {
    // Goal-side jockey: sprint to get there, then shadow at ~1.8 m.
    const stand = d > 4 || urgent ? 1.2 : 1.8
    const spot = { x: owner.pos.x + toGoal.x * stand, y: owner.pos.y + toGoal.y * stand }
    // Match the carrier's pace: anyone sprints when the gap opens.
    // (A sensible defender holds JOCKEY once he is on his man: set, side-on, not sold by a feint.)
    moveTo(spot, d > stand + 0.6 || Math.hypot(owner.vel.x, owner.vel.y) > 5.5, st.skill.read >= 0.5 && d < 3.2 ? 'jockey' : null)
  }

  if (st.slider && d < 4.5 && d > 2) {
    act({ kind: 'swipe', swipe: { dir: norm(sub(owner.pos, hero.pos)), length: 0.5, duration: 0.2, speed: 2.5, power: 0.8, curl: 0, chip: false, isTap: false } })
    st.slider = false
    return
  }
  // A rash defender stabs from too far out (build 9: from ~3.5 m for a novice — the lunge is the sloppy input).
  if (d > (st.rusher ? 1.75 + st.skill.timingSd * 8 : 1.85)) {
    st.waitSince = -1
    return
  }
  if (st.pendingAt < 0) st.pendingAt = st.real + Math.max(0.05, st.skill.reaction * 0.6 + st.rng.normal(0, st.skill.timingSd))
  if (st.real < st.pendingAt) return
  if (st.reader) {
    // Wait (up to ~1.2 s) for the ball to be exposed, and never from behind.
    if (st.waitSince < 0) st.waitSince = st.real
    const moving = Math.hypot(owner.vel.x, owner.vel.y) > 1.2
    const exposed = moving && owner.touch < 0.3
    const behind = isBehind(owner, hero)
    // Contain rather than dive in; only force it when he is about to get a shot away.
    const danger = dist(owner.pos, ownGoal) < 18
    // (Never through the back of him — in the box that is a penalty: a sensible defender gets round first.)
    if (behind && (!danger || st.skill.read >= 0.5)) return
    if (!exposed && (!danger || st.real - st.waitSince < 0.5)) return
  }
  // A patient defender only presses when the man is in reach; a rash one stabs anyway (and slides in).
  if (d > 1.72 && !st.rusher) return
  if (st.rusher && d > 1.75) {
    act({ kind: 'btn', id: 'tackle', dir: norm(sub(owner.pos, hero.pos)) })
    st.pendingAt = -1
    return
  }
  act({ kind: 'action' })
  st.pendingAt = -1
  st.waitSince = -1
}

/** Goal-line target the bot "swipes" at: a corner choice plus human scatter. */
function aimPoint(st: HumanBotState, inside: number): Vec2 {
  const post = st.side > 0 ? POST_Y_HIGH : POST_Y_LOW
  // A careless shooter (no read of the keeper) often just hits it "somewhere in the goal" — at the keeper.
  if (st.rng.chance(0.55 * (1 - st.skill.read) - 0.05)) return { x: PITCH_LENGTH, y: GOAL_CENTER_Y + st.rng.normal(0, 1.2) }
  const y = post - st.side * inside + st.rng.normal(0, st.skill.aimSd)
  return { x: PITCH_LENGTH, y }
}

const power = (st: HumanBotState, bias = 0): number =>
  Math.max(0.45, Math.min(1.12, st.rng.normal(st.skill.powerMean + bias, st.skill.powerSd)))

/**
 * Feeds one frame of input; call before `rt.update(realDt)`.
 * @param realDt the same wall-clock step passed to `rt.update`
 */
export function humanBotStep(rt0: HighlightRuntime, st: HumanBotState, realDt: number): void {
  const rt = st.phone ? phoneRuntime(rt0) : rt0
  st.real += realDt
  if (rt.phase !== 'live') {
    rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
    return
  }
  // Set-piece choices: a person takes a second or two to decide.
  if (rt.pendingChoice) {
    rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
    if (st.choiceAt < 0) st.choiceAt = st.real + st.rng.range(0.8, 2.2)
    if (st.real < st.choiceAt) return
    if (rt.pendingChoice === 'corner') {
      // A sensible taker floats it where his delivery can reach: a good crosser onto the penalty spot curling in, a
      // poorer one to the far post curling away from the keeper (a softer ball for his big men); a careless one picks
      // anything.
      if (st.skill.read >= 0.5) {
        const good = rt.hero.attrs.crossing >= 55
        rt.queueAction({ kind: 'corner', zone: good ? 'spot' : 'far', height: 'floated', curl: good ? 'in' : 'out' })
        return
      }
      const zone = st.rng.weighted(['near', 'far', 'spot', 'short'] as const, (z) => ({ near: 0.3, far: 0.35, spot: 0.25, short: 0.1 })[z])
      rt.queueAction({ kind: 'corner', zone, height: st.rng.chance(0.5) ? 'driven' : 'floated', curl: st.rng.chance(0.6) ? 'in' : 'out' })
    } else {
      // A sensible keeper lines up the textbook wall (four men, five from close in, covering the near post) and takes the
      // far side himself; a careless one guesses — too few men, or the wall pushed off the near post.
      const sp = rt.setPiece
      const close = sp ? Math.hypot(sp.spot.x, GOAL_CENTER_Y - sp.spot.y) < 21 : false
      if (st.skill.read >= 0.5) rt.queueAction({ kind: 'wall', count: close ? 5 : 4, nudge: 0 })
      else rt.queueAction({ kind: 'wall', count: st.rng.pick([2, 3, 3, 4, 5]), nudge: st.rng.pick([-1.5, -1, -0.5, 0, 0.5, 1, 1.5]) })
    }
    return
  }
  const hero = rt.hero
  const canAct = st.real - st.lastAct > 0.35
  const act = (a: Parameters<HighlightRuntime['queueAction']>[0]): void => {
    if (!canAct) return
    rt.queueAction(a)
    st.lastAct = st.real
  }
  const moveTo = (p: Vec2, sprintIn = false, hold: 'jockey' | null = null): void => {
    const d = sub(p, hero.pos)
    const l = Math.hypot(d.x, d.y)
    // A careless player does not work back hard: in a recovery run he jogs until he is right on it.
    // (Nor does he press flat out: he jogs up to the man on the ball.)
    const sprint = sprintIn && !((rt.kind === 'recovery_run' || rt.kind === 'press_trap') && st.skill.read < 0.5 && dist(hero.pos, { x: rt.ball.x, y: rt.ball.y }) > 4)
    rt.setControl({ move: l > 0.3 ? norm(d) : { x: 0, y: 0 }, sprint, ...(hold ? { hold } : {}) })
  }

  // ── Keeper ──
  // Sweeping (2.1#85): a ball over the top: come off the line once it is read.
  if (rt.heroIsKeeper && rt.kind === 'gk_sweep' && !rt.owner && st.real > st.skill.reaction + 0.15) {
    // A reader attacks where it will be; a ball-watcher chases where it is.
    moveTo(st.skill.read >= 0.5 ? interceptPoint(hero, rt.aiWorld(), 2.5).point : { x: rt.ball.x, y: rt.ball.y }, true)
    return
  }
  // Holding the ball in his hands: look up, then roll it out to the freest team-mate (six-second rule).
  if (rt.heroIsKeeper && rt.keeperHoldLeft > 0) {
    if (st.heldSinceReal < 0) st.heldSinceReal = st.real
    if (st.real - st.heldSinceReal > st.skill.reaction + 0.6) {
      const space = (a: Agent) => Math.min(...rt.agents.filter((o) => o.team === 'opp' && !o.isKeeper).map((o) => dist(o.pos, a.pos)), 30)
      // A sensible keeper rolls it to the freest man close by; a careless one, rushed, hoofs it long.
      if (st.skill.read < 0.5 && st.rng.chance(0.7)) {
        act({ kind: 'btn', id: 'kick' })
        return
      }
      const mate = rt.agents
        .filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper && dist(a.pos, hero.pos) < 40)
        .map((a) => ({ a, v: space(a) * 4 - dist(a.pos, hero.pos) * 0.3 + st.rng.normal(0, st.skill.aimSd * 2) }))
        .sort((p, q) => q.v - p.v)[0]?.a
      if (mate) act({ kind: 'pass', target: { x: mate.pos.x + st.rng.normal(0, st.skill.aimSd), y: mate.pos.y + st.rng.normal(0, st.skill.aimSd) } })
      else act({ kind: 'pass', dir: { x: 1, y: st.rng.range(-0.4, 0.4) } })
    }
    return
  }
  // A cross into the box (gk_claim): read it, then come for it (or, now and then, stay on the line).
  if (rt.heroIsKeeper && rt.kind === 'gk_claim' && !rt.owner && rt.ball.z > 0.9 && !st.claimed) {
    if (st.crossSeen < 0) st.crossSeen = st.real
    if (st.real - st.crossSeen > st.skill.reaction) {
      st.claimed = true
      // A sensible keeper only comes for one he can get to (lands in his zone, in time); a careless one comes for
      // anything — and is left stranded by the one he could never reach.
      const pts = predictTrajectory(rt.ball, rt.env, { duration: 2.5, sampleEvery: 2 })
      const land = pts.find((p, i) => i > 0 && p.z < 2.4 && p.z <= pts[i - 1]!.z) ?? pts[pts.length - 1]!
      const reach = land.x < 12 && Math.abs(land.y - GOAL_CENTER_Y) < 10
      if (st.skill.read >= 0.5 ? reach : st.rng.chance(0.3)) act({ kind: 'action' })
    }
  }
  if (rt.heroIsKeeper) {
    const shotIncoming = !rt.owner && Math.hypot(rt.ball.vx, rt.ball.vy) > 9 && rt.ball.vx < 0
    if (!shotIncoming) st.shotSeenReal = -1
    else if (st.shotSeenReal < 0) st.shotSeenReal = st.real
    if (shotIncoming && !st.dove && st.real - st.shotSeenReal > st.skill.reaction && hero.state === 'run') {
      const plan = planSave(hero, rt.aiWorld(), 0)
      if (plan && plan.onTarget) {
        let dy = plan.point.y - hero.pos.y + st.rng.normal(0, st.skill.aimSd * 0.5)
        if (st.rng.chance(st.skill.wrongSide)) dy = -dy
        if (Math.abs(dy) > (st.skill.read >= 0.5 ? 0.8 : 0.5)) act({ kind: 'dive', dir: norm({ x: 0.15, y: dy }) })
        st.dove = true
      }
    }
    // gk_1v1: come off the line to smother at the right moment (a sloppy keeper goes too early, or never).
    const att = rt.owner && rt.owner.team === 'opp' && !rt.owner.isKeeper ? rt.owner : null
    if (rt.kind === 'gk_1v1' && att && !st.blocked && dist(att.pos, hero.pos) < st.rushAt) {
      st.blocked = true
      st.rushReal = st.real
      act({ kind: 'btn', id: 'rush' })
    }
    // Committed to the rush: hands off the stick while it runs (pulling back would call it off).
    if (st.rushReal >= 0 && st.real - st.rushReal < 1.2) {
      rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
      return
    }
    const ideal = keeperTarget(hero, rt.aiWorld()).pos
    // Off the angle: drifts toward the middle of his line.
    const line = { x: 0.6, y: GOAL_CENTER_Y }
    // (Facing a free kick a careless keeper guesses: he cheats a step and a half toward one post before it is struck.)
    const cheat = rt.kind === 'fk_wall' && rt.setPiece && st.skill.read < 0.5 ? st.side * 1.5 : 0
    moveTo({ x: ideal.x + (line.x - ideal.x) * st.gkDrift * 0.7, y: ideal.y + (line.y - ideal.y) * st.gkDrift + cheat })
    return
  }

  // ── On the ball / set-piece taker ──
  if (rt.heroOnBall) {
    if (st.heldSinceReal < 0) st.heldSinceReal = st.real
    if (st.heldSinceGame < 0) st.heldSinceGame = rt.time
    const held = st.real - st.heldSinceReal
    const heldGame = rt.time - st.heldSinceGame
    const sp = rt.setPiece
    const goal = { x: PITCH_LENGTH, y: GOAL_CENTER_Y }
    // Under a tight marker (shoulder duel, long ball brought down): a sensible player SHIELDs it — body
    // between man and ball, easing away (Strength / Balance) — until the team comes; a careless one runs into him.
    if ((rt.kind === 'shoulder_duel' || rt.kind === 'long_ball_control') && st.skill.read >= 0.5) {
      const mk = rt.agents.filter((o) => o.team === 'opp' && !o.isKeeper).sort((p, q) => dist(p.pos, hero.pos) - dist(q.pos, hero.pos))[0]
      if (mk && dist(mk.pos, hero.pos) < 2.5) {
        const away = norm(sub(hero.pos, mk.pos))
        rt.setControl({ move: { x: away.x * 0.4, y: away.y * 0.4 }, sprint: false, hold: 'shield' })
        return
      }
    }
    if (sp && sp.kind === 'penalty') {
      if (held > 0.8) act({ kind: 'shoot', target: aimPoint(st, 0.9), power: power(st, 0.04), curl: 0, chip: false })
      return
    }
    if (sp && sp.kind === 'freekick') {
      // Bend it toward the far side of the wall's shadow.
      if (held > 1.0) act({ kind: 'shoot', target: aimPoint(st, 0.8), power: power(st, -0.02), curl: -st.side * (0.45 + st.rng.range(0, 0.4)), chip: false })
      return
    }
    if (sp) {
      // Other set pieces (corner taken by the hero): whip it to the near post area.
      // (The swipe's scatter is the taker's thumb: a careless one sprays it.)
      const dir = norm(sub({ x: PITCH_LENGTH - 8 + st.rng.normal(0, 1.2 + st.skill.aimSd), y: GOAL_CENTER_Y + st.rng.normal(0, 2 + st.skill.aimSd * 1.4) }, hero.pos))
      if (held > 0.8) act({ kind: 'swipe', swipe: { dir, length: 0.4, duration: 0.2, speed: 2, power: power(st, -0.15), curl: 0.3, chip: false, isTap: false } })
      return
    }
    if (rt.kind === 'cross' && (hero.pos.y > 52 || hero.pos.y < 16)) {
      // Wide: everyone crosses (the moment's intent). A sensible crosser waits for his runners in the box and plays it
      // into the corridor at the penalty spot; a careless one hits it at the box without looking.
      const arrived = rt.agents.filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper && a.pos.x > PITCH_LENGTH - 16 && Math.abs(a.pos.y - GOAL_CENTER_Y) < 12).length
      // (…and picks the moment a runner in the corridor is free of his marker.)
      const space = (a: Agent) => Math.min(...rt.agents.filter((o) => o.team === 'opp' && !o.isKeeper).map((o) => dist(o.pos, a.pos)), 30)
      const free = rt.agents.filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper && a.pos.x > PITCH_LENGTH - 14 && a.pos.x < PITCH_LENGTH - 4 && Math.abs(a.pos.y - GOAL_CENTER_Y) < 8 && space(a) > 2.5).sort((p, q) => space(q) - space(p))[0]
      const freeRunner = !!free
      // (…with a yard of space himself — not with the full-back's leg in the way.)
      const marker = Math.min(...rt.agents.filter((o) => o.team === 'opp' && !o.isKeeper).map((o) => dist(o.pos, hero.pos)), 30)
      if (held > 0.5 && (st.skill.read < 0.5 || (arrived >= 2 && freeRunner && marker > 2.5) || held > 2.4)) {
        const box = rt.agents
          .filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper && a.pos.x > PITCH_LENGTH - 18 && Math.abs(a.pos.y - GOAL_CENTER_Y) < 12)
          .sort((p, q) => Math.abs(p.pos.y - GOAL_CENTER_Y) - Math.abs(q.pos.y - GOAL_CENTER_Y))[0]
        const aim = st.skill.read >= 0.5 ? (free ? { x: free.pos.x + 1.5, y: free.pos.y } : { x: PITCH_LENGTH - 12, y: GOAL_CENTER_Y }) : st.skill.read > 0.3 && box ? box.pos : { x: PITCH_LENGTH - 9, y: GOAL_CENTER_Y }
        // (Across 30 m a careless swipe is metres out: the scatter grows with the carelessness.)
        const sc = st.skill.read >= 0.5 ? 1 : 3
        const tgt = { x: aim.x + st.rng.normal(0, st.skill.aimSd * 1.6 * sc), y: aim.y + st.rng.normal(0, st.skill.aimSd * 2.2 * sc) }
        const dir = norm(sub(tgt, hero.pos))
        // (A careless swipe's weight is all over the place: short of the runners or over everyone.)
        act({ kind: 'swipe', swipe: { dir, length: 0.4, duration: 0.2, speed: 2, power: st.skill.read >= 0.5 ? power(st, -0.11) : Math.max(0.45, Math.min(1.12, st.rng.normal(st.skill.powerMean - 0.15, st.skill.powerSd * sc))), curl: 0, chip: false, isTap: false } })
      }
      moveTo({ x: PITCH_LENGTH - 6, y: hero.pos.y }, true)
      return
    }
    if (rt.kind === 'long_shot') {
      // From range: set it, then strike it hard toward a corner.
      if (held > 0.45 + st.skill.reaction * 0.6) act({ kind: 'shoot', target: aimPoint(st, 1.0), power: power(st, 0.08), curl: -0.2 * st.side * st.rng.range(0, 1), chip: false })
      rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
      return
    }
    if (rt.kind === 'switch_play') {
      // Look up and hit the far side.
      // A good one finds the free man on the far side; a careless one plays it to whoever is near, late.
      const space = (a: Agent) => Math.min(...rt.agents.filter((o) => o.team === 'opp' && !o.isKeeper).map((o) => dist(o.pos, a.pos)), 30)
      const mates = rt.agents.filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper)
      const far = st.skill.read >= 0.5
        ? (() => {
            // The far side first (a real switch, ≥ 18 m across), then the man with the most room around him.
            const v = (a: Agent) => (Math.abs(a.pos.y - hero.pos.y) >= 20 ? 40 : Math.abs(a.pos.y - hero.pos.y)) + Math.min(space(a), 10) * 3
            return mates.sort((p, q) => v(q) - v(p))[0]
          })()
        : mates.sort((p, q) => dist(p.pos, hero.pos) - dist(q.pos, hero.pos))[0]
      const wait = st.skill.read >= 0.5 ? 0.35 + st.skill.reaction : 1.4 + st.skill.reaction
      // A good one first takes a touch away from the man pressing him (a ball lobbed into his face is blocked).
      // (A man within 6 m in the line of the switch blocks the lob at head height: make the angle first.)
      const presser = rt.agents.filter((o) => o.team === 'opp' && !o.isKeeper).sort((p, q) => dist(p.pos, hero.pos) - dist(q.pos, hero.pos))[0]
      const inLine = presser && far ? Math.sign(presser.pos.y - hero.pos.y) === Math.sign(far.pos.y - hero.pos.y) : true
      if (st.skill.read >= 0.5 && presser && dist(presser.pos, hero.pos) < 6 && inLine && held < 1.8) {
        moveTo({ x: hero.pos.x - 2 * Math.sign(presser.pos.x - hero.pos.x || 1), y: hero.pos.y - 3 * Math.sign(presser.pos.y - hero.pos.y || 1) })
        return
      }
      // Aimed a few metres infield of a winger on the line (an overhit switch goes out).
      if (far && held > wait) act({ kind: 'pass', target: { x: far.pos.x + 2 + st.rng.normal(0, st.skill.aimSd), y: Math.max(5, Math.min(63, far.pos.y + (st.skill.read >= 0.5 ? (far.pos.y < 34 ? 2 : -2) : 0) + st.rng.normal(0, st.skill.aimSd))) }, lofted: dist(far.pos, hero.pos) > 22 })
      rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
      return
    }
    if (rt.kind === 'hold_up') {
      // Back to goal: a patient player stands firm (body between marker and ball) and lays it
      // off once support is free; an impatient one tries to turn and run at goal.
      if (!st.reader) {
        moveTo(goal, true)
        if (held > 1.2) act({ kind: 'shoot', target: aimPoint(st, 0.9), power: power(st), curl: 0, chip: false })
        return
      }
      // (Back to goal with the marker on him: SHIELD — body between man and ball, Strength / Balance against his
      // challenge.)
      const mk = rt.agents.filter((o) => o.team === 'opp' && !o.isKeeper).sort((p, q) => dist(p.pos, hero.pos) - dist(q.pos, hero.pos))[0]
      if (mk && dist(mk.pos, hero.pos) < 2.5) rt.setControl({ move: { x: 0, y: 0 }, sprint: false, hold: 'shield' })
      else rt.setControl({ move: { x: 0, y: 0 }, sprint: false })
      const free = (a: Agent) => !rt.agents.some((o) => o.team === 'opp' && !o.isKeeper && dist(o.pos, a.pos) < 3)
      const mate = rt.agents
        .filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper && dist(a.pos, hero.pos) > 5 && dist(a.pos, hero.pos) < 20 && free(a))
        .sort((p, q) => dist(p.pos, hero.pos) - dist(q.pos, hero.pos))[0]
      // (A target man holds it while the support arrives — two seconds on the pitch clock — then lays it off.)
      if (mate && held > 0.9 + st.skill.reaction && heldGame > 2) act({ kind: 'pass', target: { x: mate.pos.x + st.rng.normal(0, st.skill.aimSd), y: mate.pos.y + st.rng.normal(0, st.skill.aimSd) } })
      return
    }
    if (rt.kind === 'long_ball_control' && held > 3) {
      // Shield it, then lay it off to the most advanced free team-mate.
      // The nearest free team-mate in range (a safe lay-off), preferring forward ones.
      const free = (a: Agent) => !rt.agents.some((o) => o.team === 'opp' && !o.isKeeper && dist(o.pos, a.pos) < 2.5)
      const mate = rt.agents
        .filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper && dist(a.pos, hero.pos) > 6 && dist(a.pos, hero.pos) < 24 && free(a))
        .sort((p, q) => dist(p.pos, hero.pos) - (p.pos.x - hero.pos.x) * 0.3 - (dist(q.pos, hero.pos) - (q.pos.x - hero.pos.x) * 0.3))[0]
      if (mate) act({ kind: 'pass', target: { x: mate.pos.x + st.rng.normal(0, st.skill.aimSd), y: mate.pos.y + st.rng.normal(0, st.skill.aimSd) } })
    }
    if (rt.kind === 'counter_2v1') {
      // 2-on-1: drive at the last defender; when he commits to you, square it to the runner.
      const runner = rt.agents.filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper).sort((p, q) => q.pos.x - p.pos.x)[0]
      const def = rt.agents.filter((a) => a.team === 'opp' && !a.isKeeper && a.pos.x > hero.pos.x - 1).sort((p, q) => dist(p.pos, hero.pos) - dist(q.pos, hero.pos))[0]
      const dDef = def ? dist(def.pos, hero.pos) : 99
      // Reading the moment: when the last man blocks the way to goal, square it (good players
      // release at 5–8 m; novices too early or too late, or never look up).
      const release = 7 + st.rng.normal(0, st.skill.timingSd * 10)
      const lane = def ? Math.abs((def.pos.y - hero.pos.y) - ((goal.y - hero.pos.y) * (def.pos.x - hero.pos.x)) / Math.max(1, goal.x - hero.pos.x)) : 99
      if (runner && def && dDef < release && lane < 3 && dist(goal, runner.pos) < dist(goal, hero.pos) + 12 && st.anticipator) {
        act({ kind: 'pass', target: { x: runner.pos.x + 2 + st.rng.normal(0, st.skill.aimSd), y: runner.pos.y + st.rng.normal(0, st.skill.aimSd) } })
        moveTo(goal, true)
        return
      }
    }
    const dGoal = dist(hero.pos, goal)
    // Take-on (2.1#36): a skill move when the defender steps in (edge of the box too: SKILL is on screen to get past
    // the man between him and the shot — bodies are solid since build 9's pressing fix).
    if (rt.kind === 'dribble' || (rt.kind === 'edge_of_box' && st.skill.read >= 0.5)) {
      const man = rt.agents.filter((a) => a.team === 'opp' && !a.isKeeper && a.pos.x > hero.pos.x - 0.5).sort((p, q) => dist(p.pos, hero.pos) - dist(q.pos, hero.pos))[0]
      // A good dribbler goes as the man steps in (1.8–2.6 m); a careless one goes far too early, or runs into him.
      const d = man ? dist(man.pos, hero.pos) : 99
      if (st.skill.read >= 0.5 ? d < 2.6 && d > 1.8 : st.reader && d < 5 && d > 2.6) act({ kind: 'skill' })
    }
    // On a break there is space to run into: no panic shot from distance.
    const patience = rt.kind === 'counter_2v1' || rt.kind === 'counter' ? 7 : 2.4
    // Patience on the pitch clock (build 9): in real seconds the Composure slow-motion window changed the bot's own
    // decision (a composed hero was made to dribble on into the defence).
    if (dGoal < st.shootAt || (heldGame > patience && dGoal < 30)) {
      act({ kind: 'shoot', target: aimPoint(st, 0.9), power: power(st), curl: -0.25 * st.side * st.rng.range(0, 1), chip: false })
    }
    moveTo(goal, true)
    return
  }
  st.heldSinceReal = -1
  st.heldSinceGame = -1

  // ── Defending ──
  const owner = rt.owner
  if (owner && owner.team === 'opp') {
    defendStep(rt, st, owner, act, moveTo)
    return
  }

  // ── Long ball to bring down: get under it, don't jump ──
  // (Reading the flight takes a human reaction time too: a careless player is late off the mark.)
  if (!owner && rt.kind === 'long_ball_control' && rt.ball.z > 0.5) {
    if (st.looseSince < 0) st.looseSince = st.real
    if (st.real - st.looseSince < st.skill.reaction) return
    const pts = predictTrajectory(rt.ball, rt.env, { duration: 2.5, sampleEvery: 2 })
    const drop = (pts.find((p) => p.z < 1.8 && p.t > 0.1 && p.z < (pts[pts.indexOf(p) - 1]?.z ?? 9)) ?? pts[pts.length - 1])!
    // (A careless one watches the ball, not its flight: he runs under where it is and arrives behind it.)
    if (st.skill.read < 0.5) {
      moveTo({ x: rt.ball.x, y: rt.ball.y }, true)
      return
    }
    // A late reader arrives off-line by up to a meter.
    moveTo({ x: drop.x + st.jumpErr * 3, y: drop.y }, dist(hero.pos, drop!) > 0.8)
    return
  }

  // ── Loose / aerial ball ──
  if (owner) st.looseSince = -1
  else if (st.looseSince < 0) st.looseSince = st.real
  // Seeing that the ball is loose takes a human reaction time: keep the old run until then.
  if (!owner && st.real - st.looseSince < st.skill.reaction * 0.8) return
  if (!owner) {
    if (rt.ball.z > 0.8) {
      const pts = predictTrajectory(rt.ball, rt.env, { duration: 2.5, sampleEvery: 2 })
      // (A ball over the top he runs onto where it comes down, not where it passes head height.)
      const ground = rt.kind === 'timed_run' || rt.kind === 'shoulder_duel'
      const drop = (pts.find((p, i) => i > 0 && p.z < (ground ? 0.6 : 2.2) && p.z < pts[i - 1!]!.z) ?? pts[pts.length - 1])!
      // (A careless player watches the ball, not its flight: he runs under where it is and arrives behind it.)
      if (st.skill.read < 0.5) moveTo({ x: rt.ball.x, y: rt.ball.y }, true)
      else moveTo({ x: drop.x, y: drop.y }, true)
      // A ball over the top far from goal: run onto it and bring it down, don't head it.
      if ((rt.kind === 'timed_run' || rt.kind === 'shoulder_duel') && hero.pos.x < PITCH_LENGTH - 16) return
      const eta = dist(hero.pos, { x: rt.ball.x, y: rt.ball.y }) / Math.max(4, Math.hypot(rt.ball.vx, rt.ball.vy))
      // Press when the ball is about to arrive, with human timing error (game time ≈ eta·timeScale real).
      if (eta < 0.3 + st.jumpErr && dist(hero.pos, { x: drop.x, y: drop.y }) < 1.8) {
        act({ kind: 'action' })
        st.jumpErr = st.rng.normal(0, st.skill.timingSd)
      }
      return
    }
    // A ball played into space (timed_run / shoulder_duel): run onto it, where it will be, not where it is.
    if (rt.kind === 'timed_run' || rt.kind === 'shoulder_duel') {
      // (A careless one chases where it is.)
      if (st.skill.read < 0.5) {
        moveTo({ x: rt.ball.x, y: rt.ball.y }, true)
        return
      }
      const t = Math.min(2, dist(hero.pos, { x: rt.ball.x, y: rt.ball.y }) / 8)
      moveTo({ x: rt.ball.x + rt.ball.vx * t * 0.7, y: rt.ball.y + rt.ball.vy * t * 0.7 }, true)
      return
    }
    // Rebound (SHOOT is the off-ball button): an experienced player hits the low loose ball first time as it reaches
    // him, rather than taking a touch with defenders closing (the average player of the feel bands does not, yet).
    if (rt.kind === 'rebound' && st.skill.read >= 0.7 && rt.ball.z < 1 && dist(hero.pos, { x: rt.ball.x, y: rt.ball.y }) < 1.6) act({ kind: 'action' })
    // A sensible player goes where he can meet a moving ball (a pass to cut out, a parry to pounce on), not where it is.
    if ((rt.defending || rt.kind === 'rebound') && st.skill.read >= 0.5 && Math.hypot(rt.ball.vx, rt.ball.vy) > 2) {
      const ip = interceptPoint(hero, rt.aiWorld(), 2.5)
      if (ip.reachable) {
        moveTo(ip.point, true)
        return
      }
    }
    moveTo({ x: rt.ball.x, y: rt.ball.y }, true)
    return
  }
  // timed_run: creep along the line, then go — call for it just after setting off (human timing error).
  if (rt.kind === 'timed_run' && owner.team === 'hero') {
    const xs0 = rt.agents.filter((a) => a.team === 'opp').map((a) => a.pos.x).sort((a, b) => b - a)
    const line0 = xs0[1] ?? PITCH_LENGTH
    if (st.real < st.runAt) {
      // A sensible runner holds 2–3 m behind their line to set off at pace; a careless one drifts up to it.
      moveTo({ x: st.skill.read >= 0.5 ? line0 - 2.5 : hero.pos.x + 1.5, y: hero.pos.y }, false)
      return
    }
    moveTo({ x: PITCH_LENGTH - 8, y: GOAL_CENTER_Y + st.side * 2 }, true)
    // On the move: the sensible call goes as he reaches the line at speed.
    if (st.skill.read >= 0.5 && !st.called && hero.vel.x > 4 && hero.pos.x + hero.vel.x * 0.35 >= line0 - 0.4 + (st.lineErr ?? 0) * 0.3) {
      st.called = true
      rt.queueAction({ kind: 'call', at: { x: hero.pos.x + 10, y: hero.pos.y } })
      return
    }
    if (st.skill.read >= 0.5) return
    // Call it as he reaches their line (build 9: a sensible runner times the call on the line, not on a clock); the
    // timing error is the human's (≈ ±0.8 m good, ±1.8 m novice), so a sloppy one still strays offside.
    const xs = rt.agents.filter((a) => a.team === 'opp').map((a) => a.pos.x).sort((a, b) => b - a)
    const line = xs[1] ?? PITCH_LENGTH
    if (st.lineErr === undefined) st.lineErr = st.rng.normal(0, st.skill.timingSd * 8)
    if (!st.called && st.real > st.runAt && hero.pos.x + hero.vel.x * 0.25 >= line - 2.5 + st.lineErr) {
      st.called = true
      rt.queueAction({ kind: 'call', at: { x: hero.pos.x + 10, y: hero.pos.y } })
    }
    return
  }
  // Team-mate on the ball: attack the box.
  moveTo({ x: Math.min(PITCH_LENGTH - 8, hero.pos.x + 6), y: GOAL_CENTER_Y + st.side * 2 }, false)
}
