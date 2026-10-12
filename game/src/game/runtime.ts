/**
 * HighlightRuntime — the renderer-independent core loop of an interactive
 * highlight ("An"). Owns agents, ball, AI, rules, outcome resolution, bullet
 * time and the replay buffer. MatchScene only renders its state and feeds it
 * input; headless tests drive it directly.
 *
 * Time: the runtime is advanced with real seconds via {@link HighlightRuntime.update};
 * internally it runs fixed 60 Hz steps of *game* time, scaled by bullet time.
 * {@link HighlightRuntime.alpha} gives the interpolation factor between the
 * previous and current step for smooth rendering in slow motion.
 */
import { stepTimeScale, type ScaleRamp } from './bulletTime'
import { JUMP_APEX, armReach, handsReach, catchHeight, claimHoldChance, keeperBurst, keeperHoldChance, keeperIntercept, parryVelocity, pathEntersGoal } from './keeperPhysics'
import { CHANCE_MOD, eventChance, eventChanceOf, firstTouchChance } from './chanceEvents'
import type { ActionContext, ActionId } from './actionSet'
import { Rng } from '../core/rng'
import { roleAiStyle, type RoleAiStyle } from '../core/roles'
import type { Difficulty } from '../core/types'
import type { Highlight, HighlightKind, HighlightOutcome, HighlightResult, Weather } from '../sim/match/types'
import { GOAL_HEIGHT, GOAL_WIDTH, PITCH_LENGTH, PITCH_WIDTH, SHOT_PRESS_KINDS } from '../sim/match/types'
import {
  DIVE_PEAK,
  DIVE_TIME,
  LOOSE_BALL_GAP,
  arrive,
  attackDir,
  attackGoalX,
  cardForFoul,
  carrierDecision,
  callAcceptChance,
  CALL_LANE_MIN,
  defendTargets,
  diveSpeed,
  heroSupportSpot,
  inField,
  interceptPoint,
  isBehind,
  keeperReaction,
  keeperTarget,
  other,
  ownGoalX,
  planSave,
  pressTarget,
  separation,
  shouldClaimCross,
  supportTarget,
  tackleOdds,
  TACKLE_RANGE,
  type AiWorld,
  type DefendAssignment,
} from './ai'
import {
  applyKick,
  FK_WALL_D,
  crossZones,
  buttonPassTarget,
  intentShotTarget,
  kickSkill,
  interpretSwipe,
  laneOpenness,
  rankPassOptions,
  type CrossZone,
  leadPosition,
  pickPassTarget,
  planKick,
  chipKeeperFactor,
  shotTargetFromDir,
  type AimAssist,
  type KickKind,
  type KickPlan,
  type PassCandidate,
  type SwipeFeatures,
} from './kick'
import {
  BALL_RADIUS,
  GOAL_CENTER_Y,
  GRAVITY,
  PHYSICS_DT,
  createTracker,
  envForWeather,
  predictPlaneCrossing,
  predictTrajectory,
  stepBall,
  type BallState,
  type BallTracker,
  type PhysicsEnv,
  type PhysicsEvent,
  type TrajectoryPoint,
} from './physics'
import { offsideSnapshot } from './offside'
import { ASSIST_REWARD } from '../sim/match/rating'
import { bookHabit, goalZoneOf, refHighlightFoulMult, type GoalZone } from '../sim/match/referee'
import { CONTACT_KINDS, GOAL_KINDS, momentTier } from '../sim/match/tier'
import { evaluateCarrier, passLead, reactionTime, runTarget, shotTarget, goalSideness } from './tactics'
import { SET_PIECE_DISTANCE, arrangeWall, buildCast, isDefendingKind, isKeeperKind, type SetPiece } from './setup'
import { leadershipBoost } from '../sim/match/heroDuels'
import { KEEPER_GETUP, KEEPER_SCENARIO_WEIGHTS, applyKeeperScenario, buildKeeperScenario, momentumDelay, pickScenarioKind, type KeeperScenario, type KeeperScenarioKind } from './keeperScenario'
import {
  CHOICE_TIMEOUT,
  DEFAULT_CORNER,
  DEFAULT_WALL_CHOICE,
  chooseFkShot,
  cornerKick,
  cornerRuns,
  cornerZoneTarget,
  isCornerChoice,
  sanitizeWall,
  type CornerChoice,
  type FkShotLabel,
  type WallChoice,
} from './setPieceChoice'
import {
  jumpHeight,
  a01,
  accel,
  add,
  angleDiff,
  angleOf,
  clamp01,
  clampN,
  conditionAt,
  dist,
  dot,
  fatigueNoise,
  fromAngle,
  heroTurnRate,
  legsFor,
  len,
  norm,
  pointSegment,
  scale,
  sprintDrain,
  sprintRecover,
  sprintTankFor,
  sub,
  topSpeed,
  turnAccelMult,
  type Agent,
  type AgentState,
  type Team,
  type Vec2,
} from './model'
import { momentSkill } from './momentSkill'

// ── Match-feel tuning (measured with feel.test.ts; see docs/BALANCE.md) ──
/** Hero shot accuracy noise on top of attributes/difficulty: swipes are imprecise (was 1, i.e. almost nothing missed the frame). */
export const HERO_SHOT_NOISE = 1.0
/** Extra noise on hero headers (corner headers converted ~45% before). */
export const HERO_HEADER_NOISE = 1.3
/** A challenge lunging in harder than this (0..1, see lunge) is reckless: it can be a foul. */
export const RECKLESS_LUNGE = 0.3
/** A missed standing tackle: back into it after this (s), plus as much again for a defender with no Agility. */
export const MISS_RECOVER = 0.35
/** A standing tackle pressed out of reach and made on the charge loses this much timing (input skill: press when he is in reach). */
export const HERO_LUNGE_TIMING = 0.3
/** Base chance an AI keeper reads a penalty's side (before positioning/difficulty). Was 0.2. */
export const PENALTY_READ_BASE = 0.46
/** A diving keeper's body extends this far (m) behind his centre, opposite the dive (legs/torso): an over-dive no longer lets the ball through the body. */
export const DIVE_BODY_BACK = 0.7
/** Balls within 0.55 m of the keeper below this height are taken standing (was 1.7: keepers flung themselves past head-high shots). */
export const KEEPER_STAND_MAX_Z = 2.2
/**
 * timed_run: how long (s) a back line caught stepping up needs to turn and chase, from the runner's speed edge over
 * the defender (−1..1 on the 0..1 attribute scale): 0.55 s level, up to 0.85 s for a runner 0.2 quicker, never below 0.45 s.
 */
export const inBehindTurn = (edge: number): number => clampN(0.55 + edge * 1.5, 0.45, 0.85)
/** One-two: after a hero pass, a second tap within this many seconds asks the receiver to return it. */
export const ONE_TWO_WINDOW = 1.5
/** Return-pass gate (plan 2.1#59): Passing ≥ 55 returns first time. */
export const ONE_TWO_FIRST_TIME_PASSING = 55
/** A weaker passer's settling touch (s) before the return. */
export const ONE_TWO_SET_TOUCH = 0.45
export const oneTouchReturn = (passing: number): boolean => passing >= ONE_TWO_FIRST_TIME_PASSING
/** An armed one-two the receiver could not play is dropped after this long. */
export const ONE_TWO_ARMED_MAX = 3

/** Hero through ball placement error (m, 1σ at moment skill 0; scales with 1 − skill): along the run and across it. */
export const HERO_THROUGH_SPREAD = { along: 10, side: 6 } as const
/** A cross is easier to block than a pass along the floor (the full-back only has to stick a leg out). */
export const HERO_CROSS_BLOCK = 1.3
/** A pass played with an opponent this close (m) and within ~60° of its line can be charged down. */
export const HERO_CHARGE_DOWN = { range: 2.2, cos: 0.5, chance: 0.75 } as const

/** block: the shooter's set-up time scale (× base + composure × Composure). */
export const BLOCK_WINDUP = { base: 1.4, composure: -0.8 } as const
/** block: chance a set shooter sells the shift to a charging / diving defender (Dribbling vs his Agility). */
export const BLOCK_SHIFT = { base: 0.6, drib: 0.5, agility: 0.45, calm: -0.3, calmDrib: 1.1, read: 0.45 } as const
/** block: a shot passing within base + pos × Positioning (m) of him, close in, was forced (graded partial). */
export const BLOCK_FORCED = { base: 0.3, pos: 0.9 } as const
/** A standing tackle made while closing faster than `from` m/s loses up to `timing` (reached at from + span). */
export const HERO_CHARGE = { from: 4.2, span: 2.0, timing: 0.45 } as const
/** Hero standing tackle, on the logit scale: base (level skill vs carrier, average timing) and the slopes; `lunge` multiplies the final chance. */
export const HERO_TACKLE = { base: 2.4, skill: 4.6, timing: 1.6, timingCap: 0.6, exposed: 0, behind: 1.0, lunge: 0.25, difficulty: 1.2 } as const

/** How well a carrier rides a challenge (0..1): Dribbling, Agility, Balance, Strength. */
export function carrierHold(c: Pick<Agent, 'attrs'>): number {
  const a = c.attrs
  return a01(a.dribbling) * 0.5 + a01(a.agility) * 0.17 + a01(a.balance ?? a.strength) * 0.15 + a01(a.strength) * 0.18
}

/**
 * Hero standing-tackle win chance: a logistic curve in his tackling moment skill
 * (Tackling / Anticipation / Aggression / Positioning) against the carrier —
 * smooth, no floors or ceilings to plateau on — moved by timing (the ball off
 * his feet), never from behind, and a lunge (pressed out of reach and made on
 * the charge) more than halving it at every level.
 */
export function heroTackleWin(skill: number, carrier: number, timing: number, gap: number, behind: boolean, difficulty: number, lunge: boolean | number): number {
  const T = HERO_TACKLE
  // Timing helps up to a well-timed challenge (the ball off his feet); beyond that the tackler's quality decides.
  let z = T.base + (skill - carrier) * T.skill + (Math.min(timing, T.timingCap) - 0.45) * T.timing + (gap > LOOSE_BALL_GAP ? T.exposed : 0) + (1 - difficulty) * T.difficulty
  if (behind) z -= T.behind
  const p = 1 / (1 + Math.exp(-z))
  // A lunge is graded by how far out he pressed (1 = from well out of reach, see LUNGE_SPAN).
  const l = typeof lunge === 'number' ? clamp01(lunge) : lunge ? 1 : 0
  return p * (1 - (1 - T.lunge) * l)
}

/**
 * Bodies (playtester build 9: "I ran straight at the man pressing PRESS and went THROUGH him and the ball"): the hero
 * and an opponent never come closer than this between centres (m). Checked swept over the step, so a fast approach
 * cannot skip the contact frame.
 */
export const BODY_GAP = 0.7
/** The ball at an opponent's feet: the hero's body never closer than this to it (m) — he meets it, never runs over it. */
export const BALL_CONTACT = 0.45
/** A defensive press (TACKLE / PRESS / SLIDE / BLOCK / INTERCEPT, or a tap) this recent turns contact with the carrier or his ball into a challenge (s). */
export const CONTEST_INTENT = 1.2
/** TACKLE pressed out of reach: the lunge penalty grows from nothing at reach to full this many metres further out. */
export const LUNGE_SPAN = 1.5
/** Standing-tackle reach (m). */
export const TACKLE_REACH = 1.8
/**
 * PRESS arrived (playtester build 9: PRESS used to stop at hurrying him, then ran through him): for this long he
 * stays on the carrier and goes in for the ball — the moment it comes off his foot (exposure ≥ PRESS_GO_EXPOSED),
 * after PRESS_GO_AFTER s in reach, or on contact, whichever is first. Hurried, the carrier often lets it go before.
 */
export const PRESS_STICK = 1.0
/** recovery_run: back in the play (partial credit when another stops it) within this many metres of the ball (build 9 floor: 12 → 14). */
export const RECOVERY_DUTY = 14
/** JOCKEY held: he gets goal-side of the carrier from this far (m; 12 before interception offered JOCKEY too). */
export const JOCKEY_RANGE = 30
/** The PRESS run's longest life (s): he keeps going at whoever has the ball until he arrives. */
export const PRESS_RUN = 3.0
export const PRESS_GO_EXPOSED = 0.7
export const PRESS_GO_AFTER = 0.5

/** Difficulty label → opponent sharpness multiplier. */
export const DIFFICULTY_SCALE: Record<Difficulty, number> = { easy: 0.85, normal: 1, hard: 1.15, legend: 1.3 }
/** Advantage: game seconds the referee waits for the fouled team to profit before calling it back. */
export const ADVANTAGE_WINDOW = 2.5
/** Advantage: meters of forward progress in possession that count as a benefit. */
export const ADVANTAGE_GAIN_M = 7
/** Advantage tendency when the highlight carries no referee (demo / tests). */
export const DEFAULT_ADVANTAGE = 0.5
/** Penalty tell-tale: meters an AI keeper cheats toward the hero's habit (× the habit share). */
export const KEEPER_LEAN = 0.7
/** Shoulder contact: seconds between two leans of the same pair (0.3 before bodies were solid). */
export const SHOULDER_EVERY = 0.6
/** shoulder_duel: seconds on the ball after the duel that count as winning it. */
export const SHOULDER_WON_SECONDS = 1.0
/** press_trap: the press is beaten once they carry it into midfield (hero frame x). */
export const PRESS_BEATEN_X = 62
/** Kinds with a running shoulder-to-shoulder duel (Strength / Balance) between the hero and his nearest opponent. */
/**
 * Moments where the two nearest team-mates show for the hero on the ball (playtester build 8: "no pass on left or
 * right"). Not in the through-on-goal kinds (1v1, 2v1: the scenario is the shape) or the crossing ones (the runners
 * belong in the box).
 */
export const SUPPORT_KINDS: ReadonlySet<HighlightKind> = new Set<HighlightKind>(['build_up', 'counter', 'edge_of_box', 'hold_up', 'dribble', 'long_shot', 'switch_play', 'long_ball_control', 'shoulder_duel', 'rebound'])
const SHOULDER_KINDS: ReadonlySet<HighlightKind> = new Set<HighlightKind>(['shoulder_duel', 'long_ball_control', 'recovery_run', 'hold_up', 'counter'])
/** hold_up: seconds of shielding under pressure that count as the job done. */
export const HOLD_UP_SECONDS = 2.6
/** block: the hero's body (and stretched leg when sliding) blocks within this radius (m). */
/**
 * Receiving the hero's pass (playtester build 8: "a clean pass to the man next to me and he can't control it").
 * The man it is meant for reads it early (Anticipation → reaction), stretches for it (First Touch → extra reach)
 * and cushions it (First Touch → higher controllable ball speed). A team-mate it is not meant for lets it run
 * rather than taking a heavy touch.
 */
export const RECEIVE = { react: 0.3, reactSkill: 0.3, reach: -0.05, reachSkill: 0.5, cushion: -2, cushionSkill: 7 } as const
/** The hero's delivery into the corridor in his runner's aerial duel: points per unit of delivery quality over 0.5. */
export const DELIVERY_EDGE = 80
/** Jumping for a header: how much lower than his head (m) he still meets the ball, rising or falling. */
export const HEAD_ADJUST = 0.35
/** gk_sweep: how far (m) off his line the hero keeper goes to sweep a ball over the top (outside the box: his feet). */
export const SWEEP_RANGE = 30
/** A defender this close (m) in front of an AI shooter is in his line: going round him is the shooter's chance event. */
export const BODY_IN_LINE = 6
/** PRESS: run through the cover shadow, PRESS_SHADOW m off the man toward his nearest pass, until PRESS_SHADOW_IN m from him. */
export const PRESS_SHADOW = 1.5
export const PRESS_SHADOW_IN = 3
/** Highest ball (m) a player brings down on his chest (above it he has to head it). */
export const CHEST_TOP = 1.95
/** A marker this much beyond body contact (m) behind a shielding hero still reaches round him for the ball. */
export const REACH_ROUND = 0.6
/** Team-mates helping in the hero's defending moment: points off their interception read (the moment is his). */
export const HELPER_MOD = -40
/** Extra scatter of a long ground pass (15 → 30 m) per unit of missing pass skill. */
export const PASS_RANGE_NOISE = 1.6
/**
 * Team-mates' challenges and interceptions in a defensive moment, relative to build 8 (build 9: the moment is the
 * hero's job — too many were won by a team-mate while the hero watched, which made them easy and stat-blind).
 */
export const DEFEND_HELP = 0.15
/** …and in a keeper's moment (the keeper's job; build 9: team-mates were winning most of them). */
export const KEEPER_MOMENT_HELP = 0.08
/** Pressing reads (see readPressedPass): range (m), base, factor in the pass's line / off it. */
export const PRESS_READ = { range: 11, base: 2.0, shadow: 1.5, open: 0.3, hurried: 3.0 } as const
const PRESS_READ_KINDS: ReadonlySet<HighlightKind> = new Set<HighlightKind>(['press_trap'])
/** An AI shooter's scatter follows his own Finishing (Set Pieces for a free kick): ×1.12 at 47, ×1 at 62, ×0.88 at 77. */
export const aiFinishNoise = (finishing: number): number => clampN(1.5 - 0.8 * a01(finishing), 0.7, 1.3)
/** Take-on timing bonus / penalty (build 9): right as the man steps in, or not. */
export const SKILL_TIMING = 0.4
/** Opposition free-kick taker's spread (build 9: 1.3 → 1.15, a free kick against was kept out 80 % of the time). */
export const FK_AGAINST_NOISE = 1.15
/** AI carrier's share of the hero's carrying pace (build 9: was ×0.80–0.83 of a sprint, the hero ×0.97–0.99). */
export const AI_CARRY_PACE = 0.96
/** A hero shot the keeper saves counts as a partial success when he had to stretch at least this far (0..1 of his dive). */
export const PARTIAL_SAVE_STRETCH = 0.35
/** …or from at least this far out (m): forcing a save from range is the good outcome of a long shot / free kick. */
export const PARTIAL_SAVE_RANGE = 18
/** Moments about striking from range (the range save rule applies there only). */
const RANGE_KINDS: ReadonlySet<HighlightKind> = new Set<HighlightKind>(['long_shot', 'edge_of_box', 'freekick', 'counter_2v1', 'rebound'])
/** Stretch a save from range needs to count (he had to dive for it). */
export const PARTIAL_SAVE_STRETCH_RANGE = 0.45
/** …or placed at least this far (m) from his body (a range shot struck at the keeper does not count). */
export const PARTIAL_SAVE_OFF_BODY = 0.6
/** Hero keeper set on his angle: within this distance (m) of his textbook spot as the shot is struck. */
export const KEEPER_SET_R = 1.2
/** Chance (× the hero's cross moment skill) that the keeper stays on his line for the hero's delivery. */
export const KEEPER_DOUBT = 1.6
/** Extra reach (m) of a team-mate attacking the hero's cross / corner, × the hero's cross moment skill. */
export const CROSS_REACH = 3
/** The corridor a quality cross is put into (m from the goal line; half-width from the centre). */
export const CROSS_CORRIDOR = { near: 5, far: 13, half: 7 } as const
/** A cross landing within this distance (m) of where his run takes him is attacked at once. */
export const CROSS_ON_RUN = 3
/** Aerial duel weight of a team-mate attacking the hero's cross: × base + skill × his cross moment skill. */
export const CROSS_ATTACK = { base: 0.6, skill: 11 } as const
/** Hero shot from a tight angle: the goal mouth seen under this angle (rad) or less gets the keeper up to + save. */
export const TIGHT_ANGLE = 0.42
/** timed_run: extra turn (s) of their back line against a runner off their blind side, × his Positioning. */
export const BLIND_SIDE = 0.35
/** A forward this far (m) past the line at full Positioning (× Positioning) as the pass is played is still level. */
export const RUN_ON_LINE = 0.9
/** timed_run: the ball over the top is aimed no deeper than this far (m) from the goal line (it carries on after it). */
export const TIMED_RUN_DEPTH = 21
/** timed_run: average speed (m/s) of the ball over the top, for weighting it onto the runner. */
export const TIMED_RUN_BALL_SPEED = 15
/** …and he arrives this long (s) after it has come down, onto it in his stride. */
export const TIMED_RUN_SETTLE = 0.4
/** rebound: seconds their defenders stand ball-watching the save (× 1.3 − Anticipation). */
export const REBOUND_WATCH = 0.6
/** A shot aimed (before execution noise) at least this far (m) across from the keeper is a deliberate placement. */
export const PLACED_AIM = 1.4
/** …and from range it must still have this much pace (m/s) when it reaches the keeper (a free kick dips over the wall). */
export const PARTIAL_RANGE_PACE: Partial<Record<HighlightKind, number>> = { long_shot: 24, edge_of_box: 24.5, freekick: 23.5, rebound: 17 }
/** Longest lead (m) of a ground pass to a named team-mate. */
export const PASS_LEAD_MAX = 3
/** How much of the receiving help a pass carries, from its quality (kick.planKick: the passer's execution): ×0.32 at 0.4, ×0.68 at 0.6, ×1.22 at 0.9. */
export const receiveWeight = (quality: number): number => clampN(-0.4 + 1.8 * quality, 0.15, 1.3)
/** A ball into space (through ball) only carries receiving help when it is weighted well: none below quality 0.55, full at 0.9. */
export const throughWeight = (quality: number): number => clamp01((quality - 0.55) / 0.35)
/** Reaction (s) of the intended receiver to the hero's pass: 0.18 at Anticipation 40, 0.04 at 90 (generic AI read: 0.2–0.3). */
export const receiveReact = (anticipation: number): number => clampN(RECEIVE.react - RECEIVE.reactSkill * a01(anticipation), 0.04, RECEIVE.react)
/**
 * Opening grace (playtester build 8: "they close me down and steal it straight away"): when a moment starts with the
 * hero on the ball, nobody may challenge him for this long (game s): Composure — settling it and looking up —
 * 1.02 s at 40, 1.42 s at 90.
 */
export const START_GRACE = { base: 0.7, skill: 0.8 } as const
export const startGrace = (composure: number): number => START_GRACE.base + START_GRACE.skill * a01(composure)
/**
 * Challenge from behind (playtester build 8): the ball is on the far side of the carrier's body. The tackler has to
 * reach the ball itself (not just the man) and wins it far less often; the rest are mostly fouls or nothing.
 */
export const BEHIND_CHALLENGE = { win: 0.6 } as const
/** Running with the ball costs a little pace: ×0.966 at Dribbling 40, ×0.986 at 90 (it was ×0.90 / ×0.95). */
export const dribblePace = (dribbling: number): number => 0.95 + 0.04 * a01(dribbling)
export const HERO_BLOCK_R = 0.62
/** BLOCK held: spread radius scale (× 0.4 + Positioning 0.65 + Aggression 0.4; build 9: 0.66 m at 40 → 1.08 m at 90). */
export const HERO_BLOCK_SPREAD = 0.7
export const HERO_BLOCK_SLIDE_R = 0.9

export interface RuntimeOptions {
  /**
   * Opposition keeper's opening motion (keeperScenario.ts): 'auto' (default) picks a seeded
   * scenario by highlight kind, 'off' keeps him set, or force one kind (tests / demo).
   */
  keeperScenario?: KeeperScenarioKind | 'auto' | 'off'
  aimAssist?: AimAssist
  /** Enable bullet-time aiming windows. */
  slowMoAim?: boolean
  /** Label or numeric multiplier (0.8 … 1.3). */
  difficulty?: Difficulty | number
  weather?: Weather
  /** Overrides the RNG seed (defaults to a hash of the highlight id). */
  seed?: number
  /** Display names by player id. */
  names?: Record<string, string>
  /** 0..1 match importance — raises penalty panic. */
  importance?: number
  /** Accessibility: multiplies timing windows (bullet time, one-two). 1 = off. */
  timingMult?: number
}

/** Continuous hero input, in pitch space. */
export interface HeroControl {
  /** Desired movement, length ≤ 1. */
  move: Vec2
  sprint: boolean
  /** A held context button (jockey / shield; see game/actionSet). Missing = none. */
  hold?: 'jockey' | 'shield' | null
}

/** Discrete hero intents (already converted to pitch space). */
export type HeroAction =
  /** A context button (game/actionSet). `dir` = pitch direction the scene attached (dive side, pass direction). */
  | { kind: 'btn'; id: ActionId; dir?: Vec2 }
  | { kind: 'swipe'; swipe: SwipeFeatures }
  | { kind: 'tapAt'; at: Vec2 }
  | { kind: 'shoot'; target: Vec2; power: number; curl: number; chip: boolean }
  | { kind: 'pass'; target?: Vec2; dir?: Vec2; through?: boolean; lofted?: boolean }
  | { kind: 'skill' }
  | { kind: 'action' }
  | { kind: 'dive'; dir: Vec2 }
  /** Raise the hand: ask the team-mate on the ball to pass (optionally into space at `at`). */
  | { kind: 'call'; at?: Vec2 }
  /** corner_kick: the delivery the hero picked (zone, height, curl). */
  | ({ kind: 'corner' } & CornerChoice)
  /** fk_wall: the wall the hero set (2–5 players, shifted `nudge` m along its line). */
  | ({ kind: 'wall' } & WallChoice)

/** Live aim state (while the player drags / holds) for previews. */
export type AimState =
  | { kind: 'swipe'; swipe: SwipeFeatures }
  | { kind: 'target'; target: Vec2; power: number; curl: number; chip: boolean }

/** Events for renderer / audio / haptics. */
export type RuntimeEvent =
  | { type: 'kick'; by: string; hero: boolean; kick: KickKind; power: number; speed: number; x: number; y: number }
  | { type: 'touch'; by: string; hero: boolean; x: number; y: number }
  | { type: 'dribble'; by: string }
  | { type: 'bounce'; speed: number; x: number; y: number }
  | { type: 'post'; speed: number; x: number; y: number; z: number }
  | { type: 'bar'; speed: number; x: number; y: number; z: number }
  | { type: 'net'; speed: number; end: 'west' | 'east' }
  | { type: 'goal'; team: Team; scorerId: string; end: 'west' | 'east' }
  | { type: 'save'; by: string; held: boolean; x: number; y: number; z: number; punch?: boolean }
  /** Penalty: the keeper has studied the hero and leans toward his favourite side (tell-tale). */
  | { type: 'keeperRead'; by: string; zone: 0 | 1 | 2; x: number; y: number }
  | { type: 'block'; by: string; x: number; y: number }
  | { type: 'tackle'; by: string; won: boolean; slide: boolean; x: number; y: number }
  /** Contested aerial ball (Jumping, Heading): `by` won it against `n` other players. */
  | { type: 'aerial'; by: string; n: number; hero: boolean; heroIn: boolean }
  /** Shoulder-to-shoulder contact (Strength / Balance): `by` came through it, `on` was knocked off his line (`down` = off his feet). */
  | { type: 'shoulder'; by: string; on: string; down: boolean; x: number; y: number }
  | { type: 'foul'; by: string; on: string; card?: 'yellow' | 'red'; advantage?: boolean }
  /** Referee plays advantage ('on'), it paid off ('played') or nothing came of it ('called_back'). */
  | { type: 'advantage'; state: 'on' | 'played' | 'called_back'; x: number; y: number }
  | { type: 'whistle'; long: boolean }
  | { type: 'skill'; by: string; success: boolean }
  | { type: 'jump'; by: string }
  | { type: 'dive'; by: string }
  | { type: 'header'; by: string }
  | { type: 'bullet'; on: boolean }
  | { type: 'out'; x: number; y: number }
  | { type: 'callForBall'; by: string }
  /** The team-mate on the ball ignored the hero's call: poor relationship, or no passing lane. */
  | { type: 'callRefused'; by: string; reason: 'relation' | 'lane' }
  /** One-two armed: `by` (the receiver of the hero's pass) will return it into the hero's run. */
  | { type: 'oneTwo'; by: string }
  /** Assistant referee's flag: `by` touched the ball from an offside position. */
  | { type: 'offside'; by: string; team: Team; x: number; y: number }
  /** The hero committed his set-piece choice (corner delivery / wall). */
  | { type: 'setPieceChoice'; choice: 'corner' | 'wall' }
  | { type: 'end'; result: HighlightResult; reason: string }

export type Phase = 'intro' | 'live' | 'post' | 'done'

/** One recorded replay frame. Agents are packed as [x, y, z, facing, stateCode] × n. */
export interface ReplayFrame {
  t: number
  bx: number
  by: number
  bz: number
  agents: Float32Array
}

export const STATE_CODES: readonly AgentState[] = ['run', 'slide', 'dive', 'jump', 'down', 'celebrate', 'skill', 'wall']

const DT = PHYSICS_DT
const REPLAY_SECONDS = 6
/** Six-second rule: how long a keeper may hold the ball in his hands (2.1#85). */
export const KEEPER_HOLD_SECONDS = 6
/** After the release, how long the distribution has to find a team-mate. */
export const KEEPER_RELEASE_SECONDS = 4.5
/** Keeper moments where a hero keeper who holds the ball gets to distribute it. */
const KEEPER_HOLD_KINDS: ReadonlySet<HighlightKind> = new Set<HighlightKind>(['gk_save', 'gk_1v1', 'gk_sweep'])
/** fk_wall outcomes that all mean "the free kick was kept out". */
const FK_WALL_HELD: ReadonlySet<HighlightOutcome> = new Set<HighlightOutcome>(['timeout', 'shot_conceded', 'saved', 'missed', 'blocked', 'woodwork', 'pass_complete', 'lost_ball'])
const SHOT_KINDS: ReadonlySet<KickKind> = new Set<KickKind>(['shot', 'chip', 'header', 'penalty', 'freekick'])
/** Deliveries that can put a team-mate offside (shots/clearances cannot). */
const PASS_KINDS: ReadonlySet<KickKind> = new Set<KickKind>(['pass', 'lofted', 'through', 'cross'])

interface ShotTrack {
  by: Agent
  kind: KickKind
  t: number
  woodwork: boolean
  blocked: boolean
  parried: boolean
  /** Keeper ids that already failed a save roll on this shot. */
  beaten: Set<string>
  /** Hero passed to the shooter right before (assist candidate). */
  assistBy: string | null
  /** Distance (m) to the goal the shot was struck from. */
  range?: number
  /** Aimed (before noise) away from where the keeper stood as it was struck: a deliberate placement. */
  placedAim?: boolean
  /** The hero keeper was set on his angle as it was struck. */
  keeperSet?: boolean
  /** Angle (rad) of the goal mouth seen from where it was struck. */
  mouth?: number
}

interface KeeperAlert {
  keeper: Agent
  at: number
  /** `habit`: the keeper goes where the book says the hero puts his penalties. */
  penaltyGuess?: { read: boolean; centre: boolean; habit?: GoalZone }
}

/** Goal-line y a keeper dives to for a goal-mouth third. */
const zoneY = (z: GoalZone): number => (z === 1 ? GOAL_CENTER_Y : GOAL_CENTER_Y + (z === 0 ? -2.6 : 2.6))

/**
 * Interactive highlight simulation.
 * @example
 * const rt = new HighlightRuntime(highlight, { aimAssist: 'full', slowMoAim: true })
 * rt.queueAction({ kind: 'shoot', target: { x: 105, y: 32 }, power: 0.8, curl: 0, chip: false })
 * while (!rt.finished) rt.update(1 / 60)
 */
const EMPTY_SET: ReadonlySet<string> = new Set()

/** Header jump height (m) from Jumping (plan 2.1#67): 40 → 0.45 m, 85 → 0.8 m. */
export { jumpHeight }

/** A hero pass is completed when it reaches any outfield team-mate (sekme dahil, plan 2.1#58). */
export function passCompletedBy(receiver: { team: string; isHero: boolean }): boolean {
  return receiver.team === 'hero' && !receiver.isHero
}

/**
 * Penalty panic (plan 2.1#93): Composure under 50 in a critical moment (90th
 * minute or later, scores level) makes the aim point tremble ±0.4 m at 0.5 Hz.
 * Otherwise the aim is steady.
 */
export function penaltyPanic(composure: number, minute: number, score: readonly [number, number], t: number): number {
  if (composure >= 50 || minute < 90 || score[0] !== score[1]) return 0
  return 0.4 * Math.sin(2 * Math.PI * 0.5 * t)
}

/** Penalty run-up: the taker's tell shows this long after the run starts (s); Reflexes ≥ 70 read it 0.15 s earlier (2.1#87). */
export const PENALTY_TELL_DELAY = 0.45
export const penaltyTellDelay = (reflexes: number): number => PENALTY_TELL_DELAY - (reflexes >= 70 ? 0.15 : 0)
/** Chance a taker who sees the keeper go early rolls it down the middle. */
export const EARLY_DIVE_CENTRE = 0.65

/** Ball distance at the carrier's feet (m) between knock-ons. */
export const DRIBBLE_FOOT = 0.42

/** Furthest knock-on (m) from Dribbling (plan 2.1#36): 40 → 1.6 m, 80 → 0.9 m; sprinting +40 %. */
export function dribbleReach(dribbling: number, sprinting: boolean): number {
  const r = clampN(1.6 - (dribbling - 40) * 0.0175, 0.7, 2)
  return sprinting ? r * 1.4 : r
}

/** Pass magnet radius (m) on full assist (plan 2.1#28/#29); half and manual have none. */
export const PASS_MAGNET = 1.5

/** The mate a free-space pass snaps to under full assist, if any is within {@link PASS_MAGNET}. */
export function magnetMate<T extends { pos: Vec2 }>(point: Vec2, mates: readonly T[], assist: AimAssist): T | null {
  if (assist !== 'full') return null
  let best: T | null = null
  let bd = PASS_MAGNET
  for (const m of mates) {
    const d = dist(m.pos, point)
    if (d < bd) {
      best = m
      bd = d
    }
  }
  return best
}

/**
 * Bullet-time aim window in real seconds (plan 2.1#26): 1.2 s + Composure × 0.02 s
 * (2.8 s at 80), halved when a defender is within 2 m of the receiver.
 */
export function bulletWindowFor(composure: number, nearestDefender: number): number {
  const w = 1.2 + clampN(composure, 0, 100) * 0.02
  return nearestDefender < 2 ? w * 0.5 : w
}

export class HighlightRuntime {
  readonly highlight: Highlight
  readonly kind: HighlightKind
  readonly agents: Agent[]
  readonly hero: Agent
  readonly ball: BallState
  readonly prevBall = { x: 0, y: 0, z: 0 }
  readonly env: PhysicsEnv
  readonly assist: AimAssist
  readonly slowMoAim: boolean
  readonly difficulty: number
  readonly defending: boolean
  readonly timeLimit: number
  readonly importance: number
  readonly timingMult: number

  owner: Agent | null = null
  setPiece: SetPiece | null
  phase: Phase = 'intro'
  /** Game seconds since start. */
  time = 0
  /** Real seconds since start. */
  realTime = 0
  /** Current time scale (bullet time eases toward its target). */
  timeScale = 1
  /** Interpolation factor between previous and current step. */
  alpha = 0
  result: HighlightResult | null = null
  endReason = ''
  /** Game time of the goal (for replay). */
  goalTime = -1
  /** Live aim for previews. */
  aim: AimState | null = null

  private readonly rng: Rng
  private readonly tracker: BallTracker
  private readonly control: HeroControl = { move: { x: 0, y: 0 }, sprint: false }
  private readonly actions: HeroAction[] = []
  private readonly events: RuntimeEvent[] = []
  private readonly frames: ReplayFrame[] = []
  /** Per-teammate pass telemetry (pure counting, never read by the simulation). */
  private readonly passNet: Record<string, { to: number; from: number }> = {}
  private readonly stats = { passes: 0, passesCompleted: 0, shots: 0, shotsOnTarget: 0, dribbles: 0, tackles: 0 }
  private card: 'yellow' | 'red' | undefined
  private blockWindUp: number
  /** block: the shooter has already answered a charge (one shift per moment). */
  private blockShifted = false
  /** The hero was in an aerial duel for the ball this moment. */
  private heroContested = false
  /** Penalty: the AI keeper guessed the right way. */
  /** The hero keeper dived the right way for a shot on target. */
  private keeperRightWay = false
  /** rebound: the hero was first to the parried ball. */
  private reboundFirst = false
  /** The carrier the hero's PRESS arrived on (his next pass is hurried). */
  private hurried: { id: string; until: number } | null = null
  private blockWindUpSet = false
  /** block: the hero was in the shooting line when it was struck (null = no shot yet). */
  private blockLine: boolean | null = null
  private redReason: HighlightResult['redReason']
  /** Referee strictness (1..5) / advantage tendency for this moment (WP-14). */
  readonly refStrictness: number | undefined
  readonly refAdvantage: number
  /** Advantage being played: since `t`, from ball x `x0`. */
  private advantage: { t: number; x0: number } | null = null
  private advantageResult: HighlightResult['advantage']
  private injured = false
  private acc = 0
  private introLeft: number
  private postLeft = 0
  private ownerSince = 0
  private lastTouch: Agent | null = null
  private lastPossTeam: Team
  private shot: ShotTrack | null = null
  /** An opponent got a shot away during this moment (a defend moment that runs out after it is a chance conceded). */
  private oppShotTaken = false
  private heroPassTo: { id: string; t: number } | null = null
  /** The hero's last pass was played into space (no named receiver): the runner attacks it (2.1#111). */
  private heroPassIntoSpace = false
  private assistChain: string | null = null
  private keeperAlert: KeeperAlert | null = null
  /** Open-play shot at an AI keeper: he moves from `at` (his reaction to the strike) and tracks the ball's path. */
  private gkReact: { keeper: Agent; at: number } | null = null
  private bulletLeft = 0
  private bulletScale = 0.25
  private lossT = 0
  private oppClearedAt = -1
  /** Hero keeper with the ball in his hands: `until` = six-second limit, `releasedAt` = when he threw / kicked it (-1 while held). */
  private keeperHold: { until: number; releasedAt: number; thrown: boolean } | null = null
  private heroRequest: { at: Vec2 | null; t: number; explicit?: boolean } | null = null
  /** Game time the hero last raised his hand (renderer: arm up), −1 = never. */
  heroCallAt = -1
  private heroHeaderAim: Vec2 | null = null
  private heroTackleResolved = false
  /**
   * Scripted build-up (playtester build 8: "they took it off our man before he passed to me"): the team-mate who
   * starts on the ball in an attacking moment cannot be dispossessed until he has released it (the feed is the
   * script, the moment is the hero's). Null once he has played it or anyone else has the ball.
   */
  private setupCarrier: Agent | null = null
  /**
   * Reading a pressed pass (build 9, press_trap / interception): pressing the passer (≤ 6 m, closing), the hero can
   * get a foot or his body to the ball as it is struck — Anticipation (60 %) and Positioning (40 %), how tight he is,
   * and whether he stands in the pass's line (the cover shadow). Returns true when he did (the ball comes off him).
   */
  private readPressedPass(by: Agent, kind: KickKind, plan: KickPlan): boolean {
    if (!this.defending || by.team !== 'opp' || !PASS_KINDS.has(kind) || !PRESS_READ_KINDS.has(this.kind) || this.phase !== 'live') return false
    const h = this.hero
    if (h.isKeeper || h.state !== 'run') return false
    const d = dist(h.pos, by.pos)
    if (d > PRESS_READ.range) return false
    const toBy = norm(sub(by.pos, h.pos))
    const closing = h.vel.x * toBy.x + h.vel.y * toBy.y
    // Closing him down — or already tight on him (PRESS arrived / in reach: bodies are solid, he cannot close further).
    if (closing < 1 && this.pressOn?.id !== by.id && d > TACKLE_REACH) return false
    // Owner, build 9: his Anticipation vs the passer's Passing (+1 % a point). Further off him up to −30 points, in the
    // cover shadow (the pass's line) +10 / off it −25, a pass he is hurried into (PRESS on, or just arrived) +15.
    const tight = clamp01((PRESS_READ.range - d) / 4)
    const passDir = norm({ x: plan.aim.x - by.pos.x, y: plan.aim.y - by.pos.y })
    const inShadow = dot(norm(sub(h.pos, by.pos)), passDir) > Math.cos(0.5)
    const hurry = this.dash?.why === 'press' || (this.hurried && this.hurried.id === by.id && this.time < this.hurried.until)
    if (!this.rng.chance(eventChance('read', h, by, (tight - 1) * 30 + (inShadow ? 10 : -25) + (hurry ? 15 : 0)))) return false
    // Off him: the ball drops loose at his feet.
    const back = norm(sub(h.pos, by.pos))
    this.ball.vx = back.x * 3 + h.vel.x * 0.3
    this.ball.vy = back.y * 3 + h.vel.y * 0.3
    this.ball.vz = 0.4
    this.lastTouch = h
    this.lastPossTeam = 'hero'
    this.heroStop = true
    this.events.push({ type: 'touch', by: h.id, hero: true, x: h.pos.x, y: h.pos.y })
    return true
  }

  /** block: the hero charging (sprinting in, or sliding) at the shooter from close. */
  private blockCharge(a: Agent): boolean {
    const h = this.hero
    if (dist(h.pos, a.pos) >= 3.2) return false
    return h.state === 'slide' || (this.control.sprint && dot(h.vel, norm(sub(a.pos, h.pos))) > HERO_CHARGE.from)
  }

  /** Where (y) the hero struck his last pass (switch_play: did it cross the pitch). */
  private heroKickY = 0
  /** dribble: the hero got past his man (a skill move that worked, or carried it beyond him). */
  private beatMan = false
  /** gk_1v1: the hero keeper came off his line to meet the man (RUSH). */
  private heroRushed = false
    /** How many went up for the last aerial ball (headerContest). */
  private aerialPool = 0
  /** fk_wall: the hero keeper was set on his angle as the free kick was struck. */
  private fkKeeperSet = false
  /** The hero created a clear chance this moment (graded success, sim/match/tier). */
  private chance = false
  /** Kind of the hero's last kick (a cross / corner met in the box is a chance created). */
  private heroLastKick: KickKind | null = null
  /** The last kick was a long ball (read against Long Passing rather than Passing). */
  private lastKickLong = false
  /** The hero's cross / corner is in flight untouched (danger-zone delivery check). */
  private crossWatch = false
  /** Opening grace: no challenge on the hero's ball until then (game time). */
  private graceUntil = -1
  private ballX0: number
  private defendCache: { t: number; team: Team; map: Map<string, DefendAssignment> } | null = null
  private penaltyPlan: { target: Vec2; z: number; runStart: number; punished?: boolean } | null = null
  private crossBulletArmed = false
  private readonly physEvents: PhysicsEvent[] = []
  private lastTouchBefore: Agent | null = null
  private readonly wallIds: Set<string>
  /** Defensive moment: the opponents got a shot away that the hero did not block or win back. */
  private oppShotFree = false
  /** Game time of the hero's last delivery (pass/cross); −1 once a team-mate took possession otherwise. */
  private heroDeliveryAt = -1
  /** Quality (cross moment skill) of the hero's last ball into the box (0 = not a cross). */
  private heroCrossQ = 0
  /** The opposition keeper stays on his line for the hero's delivery. */
  private keeperStays = false
  /** The hero has had the ball under control this moment. */
  private heroControlled = false
  /** Hero positions sampled twice a second (heat map). */
  private readonly track: Vec2[] = []
  /** Hero shots this moment (shot map). */
  private readonly shotLog: NonNullable<HighlightResult['shotLog']> = []
  /** Team-mates of the last passer who were offside when the ball was played. */
  private offsideSnap: { team: Team; ids: Set<string> } | null = null
  /** One-two: the hero just passed to `id`; `armed` once the hero tapped again (return into his run). */
  private oneTwo: { id: string; t: number; armed: boolean; armedAt: number } | null = null
  /** Last shoulder contact (game time), for the 0.3 s rhythm of a running duel. */
  private shoulderAt = -1
  /** A team-mate played the ball toward the hero: his first step off it (Anticipation) is quicker until then. */
  private readBurstUntil = -1
  /** Anticipation: the hero read an opponent's pass and runs to cut it out (until then). */
  private readCut: { to: Vec2; until: number } | null = null
  /** Keeper coming for a cross (gk_claim): until when he commits to the landing point. */
  private claimUntil = -1
  /** Context button PUNCH: the keeper coming for this cross punches it rather than catching. */
  private punchCross = false
  /** Context button run (tackle/slide close-in, intercept, press, rush, block): flat out to `to()` until `until`. */
  private dash: { to: () => Vec2 | null; until: number; why: 'engage' | 'intercept' | 'press' | 'rush' | 'block' } | null = null
  /** TACKLE / SLIDE pressed out of range: the challenge goes in as soon as he is close enough. */
  private engage: { slide: boolean; until: number; d0: number } | null = null
  /** While a buffered (pressed out of reach) challenge is going in: how much of a lunge it is (0..1, timed worse). */
  private lunge = 0
  /** Game time of his last defensive press (TACKLE / PRESS / SLIDE / BLOCK / INTERCEPT, or a tap on the carrier). */
  private defPressAt = -9
  /** PRESS arrived on this carrier: on him, he goes in for the ball (see {@link PRESS_STICK}). */
  private pressOn: { id: string; since: number; until: number } | null = null
  /** BLOCK: until when the hero is spread in the shot's line (wider body, Positioning / Aggression). */
  private blockUntil = -1
  /** STAY (keeper): set and big, no auto-positioning drift, until then. */
  private stayUntil = -1
  /** Seconds the hero has been jockeying a carrier (a patient defender times his tackle better). */
  private jockeyT = 0
  /** Sold by a dribble / a missed standing tackle: on his feet but stopping and turning until then. */
  private stumbleUntil = -1
  /** Vision pass options cache (ids, best first). */
  private passOpts: { t: number; ids: string[] } = { t: -1, ids: [] }
  /**
   * Set-piece decision still to be made by the hero (corner delivery / wall).
   * The clock is stopped while it is pending.
   */
  pendingChoice: 'corner' | 'wall' | null = null
  /** Game seconds spent waiting for the choice (idle players get the default). */
  private choiceWait = 0
  /** The committed corner delivery and when the hero strikes it. */
  cornerChoice: CornerChoice | null = null
  private cornerKickAt = -1
  /** Corner runs (team-mate id → target) and until when they hold. */
  private runs: Map<string, Vec2> | null = null
  private runsUntil = -1
  /** The committed wall and when the opposition taker strikes. */
  wallChoice: WallChoice | null = null
  private fkKickAt = -1
  /** What the opposition taker went for (fk_wall; diagnostics / commentary). */
  fkShot: FkShotLabel | null = null

  /**
   * Penalty against an AI keeper who has studied the hero (keepers' book, WP-14):
   * the zone he expects and how sure he is; null when the hero mixes it up.
   */
  readonly keeperRead: { zone: GoalZone; share: number } | null

  /** How team-mates look for the hero (his role, core/roles roleAiStyle); null for scenarios without a role. */
  readonly heroStyle: RoleAiStyle | null

  /** Hero's match condition (1 − fatigue) at this moment: Stamina and Work Rate over the minutes played. */
  readonly heroCondition: number
  /**
   * The hero's leadership lift on his AI team-mates (−1..1, ×1.5 as captain): they think quicker, run a touch
   * harder, pass and control cleaner and read the play better (see {@link leadershipBoost}).
   */
  readonly lead: number

  constructor(highlight: Highlight, opts: RuntimeOptions = {}) {
    this.highlight = highlight
    this.kind = highlight.scenario.kind ?? highlight.kind
    this.heroStyle = roleAiStyle(highlight.scenario.heroRole)
    this.rng = new Rng(opts.seed ?? `hl:${highlight.id}`)
    const cast = buildCast(highlight, this.rng.fork('cast'), opts.names)
    this.agents = cast.agents
    this.hero = cast.hero
    this.setPiece = cast.setPiece
    this.wallIds = new Set(cast.setPiece?.wall ?? [])
    this.defending = cast.defending
    this.ball = { x: cast.ball.x, y: cast.ball.y, z: cast.ball.z, vx: cast.ball.vx, vy: cast.ball.vy, vz: 0, spin: { side: 0, top: 0 } }
    Object.assign(this.prevBall, { x: this.ball.x, y: this.ball.y, z: this.ball.z })
    this.owner = cast.ownerId ? this.agents.find((a) => a.id === cast.ownerId) ?? null : null
    this.lastTouch = this.owner
    // Match fatigue: late on, tired legs run slower and the hero's sprint tank starts emptier.
    const cond = new Map(highlight.scenario.players.map((p) => [p.id, p.condition]))
    for (const a of this.agents) {
      const c = cond.get(a.id) ?? conditionAt(highlight.minute, a.attrs.stamina, a.attrs.workRate, a.isKeeper)
      a.legs = legsFor(c)
      // Everyone's sprint tank (own Stamina / Work Rate): an AI chaser tires like the hero does.
      a.stamina = sprintTankFor(c)
    }
    this.heroCondition = cond.get(this.hero.id) ?? conditionAt(highlight.minute, this.hero.attrs.stamina, this.hero.attrs.workRate, this.hero.isKeeper)
    this.lead = leadershipBoost(this.hero.attrs.leadership, !!highlight.scenario.heroCaptain)
    this.lastPossTeam = this.owner ? this.owner.team : this.defending ? 'opp' : 'hero'
    if (this.owner && !this.owner.isHero && this.owner.team === 'hero' && !this.defending) this.setupCarrier = this.owner
    this.ballX0 = this.ball.x
    this.env = envForWeather(opts.weather ?? 'clear', fromAngle(this.rng.range(0, Math.PI * 2)))
    this.tracker = createTracker()
    this.assist = opts.aimAssist ?? 'full'
    this.slowMoAim = opts.slowMoAim ?? true
    const d = opts.difficulty ?? 'normal'
    this.difficulty = typeof d === 'number' ? clampN(d, 0.6, 1.5) : DIFFICULTY_SCALE[d]
    this.timeLimit = Math.max(3, highlight.scenario.timeLimit || 10)
    this.importance = clamp01(opts.importance ?? 0.5)
    this.timingMult = clampN(opts.timingMult ?? 1, 1, 2)
    this.refStrictness = highlight.referee?.strictness
    this.refAdvantage = clamp01(highlight.referee?.advantage ?? DEFAULT_ADVANTAGE)
    const habit = this.kind === 'penalty' ? bookHabit(highlight.keeperBook, true) : null
    this.keeperRead = habit ? { zone: habit.zone, share: habit.share } : null
    this.keeperScn = this.initKeeperScenario(opts)
    this.introLeft = this.setPiece ? 0.7 : 0.35
    this.events.push({ type: 'whistle', long: false })
    // Stagger AI thinking so they don't all decide on the same frame.
    for (const a of this.agents) a.think = this.rng.range(0.05, 0.3)
    // block: how long the shooter shapes before he pulls the trigger.
    this.blockWindUp = this.kind === 'block' ? this.rng.range(0.9, 1.3) : 0
    if (this.kind === 'corner_kick' && this.setPiece?.takerId === this.hero.id) this.pendingChoice = 'corner'
    if (this.kind === 'fk_wall' && this.setPiece && this.setPiece.takerId !== this.hero.id) this.pendingChoice = 'wall'
  }

  // ───────────────────────── Public API ─────────────────────────

  /** True once the moment and its post-roll are over. */
  get finished(): boolean {
    return this.phase === 'done'
  }

  /** Seconds remaining (game time). */
  get timeLeft(): number {
    return Math.max(0, this.timeLimit - this.time)
  }

  /** True while slow motion is (mostly) active. */
  get bulletActive(): boolean {
    return this.bulletLeft > 0
  }

  /** Remaining fraction of the current bullet-time window (0..1). */
  bulletFrac = 0
  /** Timed bullet-time ramp (150 ms in, 120 ms out; 2.2#14, #15). */
  private scaleRamp: ScaleRamp = { from: 1, to: 1, t: 0 }

  /** True when the hero is on the ball (or is the set-piece taker). */
  get heroOnBall(): boolean {
    return this.owner === this.hero || (this.setPiece?.takerId === this.hero.id && this.phase !== 'post' && this.phase !== 'done')
  }

  /** Seconds left before the six-second rule forces the hero keeper to let go (0 when not holding). */
  get keeperHoldLeft(): number {
    const h = this.keeperHold
    return h && h.releasedAt < 0 && this.owner === this.hero ? Math.max(0, h.until - this.time) : 0
  }

  /** True when the hero is the goalkeeper in this moment. */
  get heroIsKeeper(): boolean {
    return this.hero.isKeeper
  }

  /** Sets continuous movement input. */
  setControl(c: HeroControl): void {
    this.control.move = len(c.move) > 1 ? norm(c.move) : { ...c.move }
    this.control.sprint = c.sprint
    this.control.hold = c.hold ?? null
  }

  /** What the context buttons need to know right now (game/actionSet). */
  actionContext(): ActionContext {
    const o = this.owner
    return {
      kind: this.kind,
      heroIsKeeper: this.hero.isKeeper,
      heroOnBall: this.owner === this.hero,
      heroTaker: !!this.setPiece && this.setPiece.takerId === this.hero.id && this.phase !== 'post' && this.phase !== 'done',
      oppInPossession: o ? o.team === 'opp' : this.defending || this.lastPossTeam === 'opp',
    }
  }

  /** A high ball (cross / corner) is dropping into the hero keeper's box: CLAIM / PUNCH are live. */
  get crossIncoming(): boolean {
    return this.hero.isKeeper && this.crossInFlight()
  }

  /** The hero is jockeying a carrier (held JOCKEY, goal-side and close). */
  private jockeying(): boolean {
    const o = this.owner
    return this.control.hold === 'jockey' && this.hero.state === 'run' && !!o && o.team === 'opp' && dist(o.pos, this.hero.pos) < 3.2
  }

  /** The hero is shielding the ball (held SHIELD on the ball). */
  private shielding(): boolean {
    return this.control.hold === 'shield' && this.owner === this.hero
  }

  /** Queues a discrete action (processed on the next step). */
  queueAction(a: HeroAction): void {
    if (this.actions.length < 8) this.actions.push(a)
  }

  /** The short-corner option (team-mate nearest the spot 10 m in from the flag). */
  shortOption(): Agent | null {
    const sp = this.setPiece
    if (!sp || this.kind !== 'corner_kick') return null
    const p = cornerZoneTarget('short', sp.spot)
    let best: Agent | null = null
    for (const a of this.agents) {
      if (a.team !== 'hero' || a.isHero || a.isKeeper) continue
      if (!best || dist(a.pos, p) < dist(best.pos, p)) best = a
    }
    return best
  }

  /** Ground point a corner choice is aimed at (picker preview). */
  cornerTarget(zone: CornerChoice['zone']): Vec2 | null {
    const sp = this.setPiece
    if (!sp || this.kind !== 'corner_kick') return null
    return cornerZoneTarget(zone, sp.spot, this.shortOption()?.pos ?? null)
  }

  /**
   * Live wall preview while the hero is choosing (renderer / picker). Purely
   * positional and deterministic: committing the same choice gives the same wall.
   */
  previewWall(c: WallChoice): void {
    if (this.pendingChoice !== 'wall' || !this.setPiece) return
    const w = sanitizeWall(c)
    this.setPiece.wall = arrangeWall(this.agents, this.setPiece.spot, w.count, w.nudge, this.hero.isKeeper ? null : this.hero)
    this.syncWall()
  }

  private syncWall(): void {
    this.wallIds.clear()
    for (const id of this.setPiece?.wall ?? []) this.wallIds.add(id)
    for (const a of this.agents) {
      a.prev.x = a.pos.x
      a.prev.y = a.pos.y
      a.prev.facing = a.facing
      if (a.state === 'wall') a.vel = { x: 0, y: 0 }
    }
  }

  /** Returns and clears pending events. */
  drainEvents(): RuntimeEvent[] {
    return this.events.splice(0, this.events.length)
  }

  /** Replay frames (oldest first) covering the last {@link REPLAY_SECONDS}. */
  replayFrames(): readonly ReplayFrame[] {
    return this.frames
  }

  /**
   * Panic aim offset (pitch meters at the goal line) for set pieces when the
   * hero's composure is low. Deterministic in time, also used by the renderer
   * to shake the aim reticle.
   */
  panicOffset(): { y: number; z: number } {
    if (!this.setPiece || this.setPiece.takerId !== this.hero.id) return { y: 0, z: 0 }
    if (this.setPiece.kind === 'penalty') {
      const hl = this.highlight
      return { y: penaltyPanic(this.hero.attrs.composure, hl.minute, hl.score, this.realTime), z: 0 }
    }
    const comp = a01(this.hero.attrs.composure)
    const amp = clamp01((0.75 - comp) / 0.75) * (0.6 + this.importance * 0.8) * 0.8
    const t = this.realTime
    return { y: amp * (Math.sin(t * 9.1) + 0.6 * Math.sin(t * 15.7 + 1.3)), z: amp * 0.5 * Math.sin(t * 7.3 + 0.4) }
  }

  /**
   * One-two prompt for the renderer: the team-mate who would return the ball
   * (`armed` once requested). Null when no one-two is available.
   */
  oneTwoHint(): { id: string; armed: boolean } | null {
    const o = this.oneTwo
    if (!o || this.phase !== 'live' || this.owner === this.hero) return null
    if (!o.armed && this.time - o.t > ONE_TWO_WINDOW * this.timingMult) return null
    return { id: o.id, armed: o.armed }
  }

  /**
   * Best pass options the hero "sees" (ids, best first), refreshed every
   * 0.15 s of game time. Count and scan range grow with Vision. Empty when the
   * hero is not on the ball.
   */
  /** Team-mates standing offside right now (pass targets drawn with a red frame, plan 2.1#60). */
  offsideMates(): ReadonlySet<string> {
    if (!this.heroOnBall || this.setPiece?.kind === 'corner') return EMPTY_SET
    return offsideSnapshot(this.agents, this.ball.x, this.hero)
  }

  /**
   * The team-mate the PASS button would play to right now with the stick at `stick` (pitch
   * direction; none = the hero's facing), for the target preview drawn before the press.
   */
  passButtonTarget(stick?: Vec2): string | null {
    if (!this.heroOnBall || this.hero.isKeeper || this.phase !== 'live' || this.setPiece) return null
    const opp = this.agents.filter((a) => a.team === 'opp').map((a) => a.pos)
    return this.passMate({ x: this.ball.x, y: this.ball.y }, stick && len(stick) > 0.2 ? stick : undefined, this.passCandidates(), opp)?.id ?? null
  }

  /** PASS target (intent): the best open man in the stick's cone, else the obvious free one — not a ball into space. */
  private passMate(from: Vec2, stick: Vec2 | undefined, mates: readonly PassCandidate[], opp: readonly Vec2[]): PassCandidate | null {
    const dir = stick && len(stick) > 0.2 ? norm(stick) : fromAngle(this.hero.facing)
    if (stick) return buttonPassTarget(from, dir, mates, opp, this.assist)
    return pickPassTarget(from, dir, mates, opp, this.assist === 'manual' ? 'half' : this.assist) ?? buttonPassTarget(from, dir, mates, opp, this.assist)
  }

  passOptions(): readonly string[] {
    if (!this.heroOnBall || this.hero.isKeeper || this.phase !== 'live' || this.setPiece?.kind === 'penalty') return []
    if (this.passOpts.t >= 0 && this.time - this.passOpts.t < 0.15) return this.passOpts.ids
    const opp = this.agents.filter((a) => a.team === 'opp').map((a) => a.pos)
    const ids = rankPassOptions({ x: this.ball.x, y: this.ball.y }, this.hero.attrs.vision ?? 50, this.passCandidates(), opp)
    this.passOpts = { t: this.time, ids }
    return ids
  }

  /**
   * Predicted trajectory for the current aim (noiseless), for the dotted preview line.
   * Returns null when the hero cannot kick.
   */
  preview(aim: AimState | null = this.aim): { points: TrajectoryPoint[]; kind: KickKind; power: number; target: Vec2 } | null {
    if (!aim || !this.heroOnBall) return null
    const kick = this.resolveHeroKick(aim.kind === 'swipe' ? { kind: 'swipe', swipe: aim.swipe } : { ...aim, kind: 'shoot' }, true)
    if (!kick) return null
    const b: BallState = { x: this.ball.x, y: this.ball.y, z: this.ball.z, vx: kick.plan.vx, vy: kick.plan.vy, vz: kick.plan.vz, spin: { ...kick.plan.spin } }
    const points = predictTrajectory(b, this.env, { duration: SHOT_KINDS.has(kick.kind) ? 1.4 : 2.2, sampleEvery: 3, stopOnEnd: true })
    return { points, kind: kick.kind, power: kick.power, target: kick.plan.aim }
  }

  /**
   * Advances the simulation by `realDt` seconds of wall time.
   * Bullet time scales the game time that elapses.
   */
  update(realDt: number): void {
    if (this.phase === 'done') return
    const rdt = clampN(realDt, 0, 0.1)
    this.realTime += rdt
    if (this.bulletLeft > 0) {
      this.bulletLeft -= rdt
      if (this.bulletLeft <= 0) {
        this.bulletLeft = 0
        this.events.push({ type: 'bullet', on: false })
      }
    }
    const target = this.bulletLeft > 0 ? this.bulletScale : 1
    this.timeScale = stepTimeScale(this.scaleRamp, this.timeScale, target, rdt)
    this.bulletFrac = this.bulletLeft > 0 ? this.bulletLeft / this.bulletWindow : 0
    this.acc += rdt * this.timeScale
    let n = 0
    while (this.acc >= DT && n < 8) {
      this.step()
      this.acc -= DT
      n++
      if ((this.phase as Phase) === 'done') break
    }
    if (n === 8) this.acc = 0
    this.alpha = clamp01(this.acc / DT)
  }

  /** Runs one fixed step regardless of time scale (tests). */
  stepOnce(): void {
    this.step()
  }

  /** Builds the HighlightResult for an outcome with current micro-stats. */
  buildResult(outcome: HighlightOutcome, extra: Partial<HighlightResult> = {}): HighlightResult {
    const r: HighlightResult = { outcome, ...this.stats, ...extra }
    if (GOAL_KINDS.has(this.kind) || CONTACT_KINDS.has(this.kind)) r.chance = this.chance
    if (Object.keys(this.passNet).length) r.passNet = Object.fromEntries(Object.entries(this.passNet).map(([k, v]) => [k, { ...v }]))
    r.assistMult = ASSIST_REWARD[this.assist]
    if (this.track.length) r.track = this.track.map((p) => ({ ...p }))
    if (this.shotLog.length) {
      const last = this.shotLog[this.shotLog.length - 1]!
      if (outcome === 'goal' || outcome === 'saved' || outcome === 'missed' || outcome === 'blocked' || outcome === 'woodwork') last.outcome = outcome
      r.shotLog = this.shotLog.map((x) => ({ ...x, outcome: x.outcome ?? 'missed' }))
    }
    if (this.card) r.card = this.card
    if (this.card === 'red' && this.redReason) r.redReason = this.redReason
    if (this.advantageResult) r.advantage = this.advantageResult
    if (this.injured) r.injured = true
    if (this.kind === 'dribble') r.beat = this.beatMan
    if (this.defending) {
      this.noteHeroStops()
      r.heroStop = this.heroStop
      r.duty = this.dutySnap ?? this.onDuty()
      // In the line when it was struck — he forced the shot (it got past him but not cleanly in).
      if (SHOT_PRESS_KINDS.has(this.kind) && (outcome === 'shot_conceded' || this.blockLine === true)) r.duty = this.blockLine === true || (outcome !== 'shot_conceded' && r.duty)
    }
    r.tier = momentTier(this.kind, r)
    return r
  }

  // ───────────────────────── Core step ─────────────────────────

  private bulletWindow = 1

  private step(): void {
    if (this.pendingChoice && this.phase === 'live') {
      this.waitChoice()
      return
    }
    this.stepEv0 = this.events.length
    this.stepInner()
    this.noteHeroStops()
  }

  /** Events index at the start of the current step. */
  private stepEv0 = 0

  /** Graded defending (build 9): did the hero himself stop it (won it, blocked, saved, claimed, got a touch)? */
  private noteHeroStops(): void {
    const id = this.hero.id
    // dribble: carried it past his man (the nearest defender who was in front of him) with the ball.
    if (this.kind === 'dribble' && this.owner === this.hero && !this.beatMan) {
      const h = this.hero
      const man = this.agents.filter((a) => a.team === 'opp' && !a.isKeeper && dist(a.pos, h.pos) < 4).sort((p, q) => dist(p.pos, h.pos) - dist(q.pos, h.pos))[0]
      if (man && man.pos.x < h.pos.x - 1.2) this.beatMan = true
    }
    for (let i = Math.min(this.stepEv0, this.events.length); i < this.events.length; i++) {
      const e = this.events[i]!
      if (!('by' in e) || e.by !== id) continue
      if (e.type === 'block' || e.type === 'save' || e.type === 'touch' || e.type === 'header' || (e.type === 'tackle' && e.won) || (e.type === 'aerial' && e.hero)) this.heroStop = true
    }
  }

  /** The hero's duty when his side first won the ball back (null = not yet). */
  private dutySnap: boolean | null = null
  /** The hero himself stopped the attack this moment (graded defending). */
  private heroStop = false

  private stepInner(): void {
    this.time += DT
    for (const a of this.agents) {
      a.prev.x = a.pos.x
      a.prev.y = a.pos.y
      a.prev.z = a.z
      a.prev.facing = a.facing
    }
    this.prevBall.x = this.ball.x
    this.prevBall.y = this.ball.y
    this.prevBall.z = this.ball.z

    if (this.phase === 'intro') {
      this.introLeft -= DT
      if (this.introLeft <= 0) this.goLive()
    }

    if (this.oneTwo && (this.oneTwo.armed ? this.time - this.oneTwo.armedAt > ONE_TWO_ARMED_MAX : this.time - this.oneTwo.t > ONE_TWO_WINDOW * this.timingMult)) this.oneTwo = null
    if (this.phase === 'live') {
      while (this.actions.length) this.handleAction(this.actions.shift()!)
      this.setPieceAI()
    } else if (this.phase === 'intro') {
      // A swipe made during the short intro is kept for the first live step (owner feedback:
      // an early swipe on the ball was silently dropped); everything else is discarded.
      const keep = this.actions.filter((a) => a.kind === 'swipe' || a.kind === 'shoot').slice(-1)
      this.actions.length = 0
      this.actions.push(...keep)
    } else {
      this.actions.length = 0
    }

    this.moveHero()
    for (const a of this.agents) if (!a.isHero) this.thinkAndSteer(a)
    for (const a of this.agents) this.integrateAgent(a)
    // The referee's 9.15 m: until the set piece is taken nobody but the taker's side stands closer to the ball.
    const sp = this.setPiece
    if (sp) {
      const taker = this.agents.find((q) => q.id === sp.takerId)
      for (const a of this.agents) {
        if (a.isKeeper || !taker || a.team === taker.team) continue
        const d = dist(a.pos, sp.spot)
        if (d < SET_PIECE_DISTANCE && d > 1e-3) a.pos = add(sp.spot, scale(sub(a.pos, sp.spot), SET_PIECE_DISTANCE / d))
      }
    }
    if (this.phase === 'live' || this.phase === 'post') this.heroBodyContact()

    this.updateBall()
    // A delivery that reaches the danger zone (six-yard box to the spot, between the posts' width + 2 m, at a playable
    // height) before anyone touches it: a good ball in — a chance created (graded success, the crosser's skill).
    if (this.crossWatch) {
      if (this.owner || this.lastTouch !== this.hero) this.crossWatch = false
      else if (this.ball.x > PITCH_LENGTH - 12 && Math.abs(this.ball.y - GOAL_CENTER_Y) < 6 && this.ball.z < 2.6) {
        this.chance = true
        this.crossWatch = false
      }
    }
    if (this.phase === 'live') {
      if (!this.owner && !this.tracker.inGoal && !this.tracker.out) this.contacts()
      if (SHOULDER_KINDS.has(this.kind)) this.shoulderContact()
      this.duels()
      this.keeperLogic()
      this.checkAdvantage()
      this.checkEnd()
    }
    this.record()
    if (this.phase === 'live' && Math.round(this.time / DT) % 30 === 0) this.track.push({ x: Math.round(this.hero.pos.x * 10) / 10, y: Math.round(this.hero.pos.y * 10) / 10 })

    if (this.phase === 'post') {
      this.postLeft -= DT
      if (this.postLeft <= 0) this.phase = 'done'
    }
  }

  /** Clock stopped: only the set-piece choice is accepted (default after {@link CHOICE_TIMEOUT}). */
  private waitChoice(): void {
    for (const a of this.agents) {
      a.vel = { x: 0, y: 0 }
      a.prev.x = a.pos.x
      a.prev.y = a.pos.y
      a.prev.z = a.z
      a.prev.facing = a.facing
    }
    this.choiceWait += DT
    let picked = false
    while (this.actions.length && !picked) {
      const act = this.actions.shift()!
      if (this.pendingChoice === 'corner' && act.kind === 'corner' && isCornerChoice(act)) {
        this.commitCorner({ zone: act.zone, height: act.height, curl: act.curl })
        picked = true
      } else if (this.pendingChoice === 'wall' && act.kind === 'wall') {
        this.commitWall({ count: act.count, nudge: act.nudge })
        picked = true
      }
    }
    this.actions.length = 0
    if (!picked && this.choiceWait >= CHOICE_TIMEOUT) {
      if (this.pendingChoice === 'corner') this.commitCorner({ ...DEFAULT_CORNER })
      else this.commitWall({ ...DEFAULT_WALL_CHOICE })
    }
  }

  private commitCorner(c: CornerChoice): void {
    const sp = this.setPiece
    this.pendingChoice = null
    this.cornerChoice = c
    this.cornerKickAt = this.time + 0.55
    this.events.push({ type: 'setPieceChoice', choice: 'corner' })
    if (!sp) return
    const runners = this.agents
      .filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper)
      .map((a) => ({ id: a.id, pos: a.pos, heading: a.attrs.heading + a.attrs.jumping * 0.5 }))
    this.runs = cornerRuns(c, sp.spot, runners)
    this.runsUntil = this.cornerKickAt + 2.2
  }

  private commitWall(c: WallChoice): void {
    const w = sanitizeWall(c)
    this.pendingChoice = null
    this.wallChoice = w
    if (this.setPiece) {
      this.setPiece.wall = arrangeWall(this.agents, this.setPiece.spot, w.count, w.nudge, this.hero.isKeeper ? null : this.hero)
      this.syncWall()
    }
    this.fkKickAt = this.time + 0.9
    this.events.push({ type: 'setPieceChoice', choice: 'wall' })
  }

  /** Opposition keeper's opening motion (null = set keeper / not applicable). */
  private keeperScn: { keeper: Agent; sc: KeeperScenario; until: number } | null = null

  /** The opening keeper scenario of this highlight ('set' when none). */
  get keeperScenarioKind(): KeeperScenarioKind {
    return this.keeperScn?.sc.kind ?? 'set'
  }

  /**
   * Seeded keeper scenario (separate stream: the main rng, and with it every
   * other outcome of the highlight, is untouched).
   */
  private initKeeperScenario(opts: RuntimeOptions): { keeper: Agent; sc: KeeperScenario; until: number } | null {
    const mode = opts.keeperScenario ?? 'auto'
    const weights = KEEPER_SCENARIO_WEIGHTS[this.kind]
    if (mode === 'off' || (mode === 'auto' && !weights) || this.setPiece || this.defending) return null
    const gk = this.agents.find((a) => a.team === 'opp' && a.isKeeper && !a.isHero)
    if (!gk) return null
    const rng = new Rng(`${String(opts.seed ?? `hl:${this.highlight.id}`)}:gk-scenario`)
    const kind = mode === 'auto' ? pickScenarioKind(rng, weights!) : mode
    if (kind === 'set') return null
    const home = keeperTarget(gk, this.aiWorld()).pos
    const sc = buildKeeperScenario(kind, rng, gk, { goalX: ownGoalX('opp'), inward: attackDir('opp'), home, ball: { x: this.ball.x, y: this.ball.y }, difficulty: this.difficulty })
    if (sc.kind === 'set') return null
    applyKeeperScenario(gk, sc)
    gk.intent = { kind: 'run', to: sc.to, until: sc.hold + 1 }
    return { keeper: gk, sc, until: this.introLeft + sc.hold }
  }

  /** The keeper is still playing out his opening scenario (no shot yet, the attack still on). */
  private keeperScnActive(a: Agent): boolean {
    const k = this.keeperScn
    if (!k || k.keeper !== a) return false
    if (this.time >= k.until || this.shot || !this.owner || this.owner.team === a.team || a.state === 'dive') {
      this.keeperScn = { ...k, until: -1 }
      return false
    }
    return true
  }

  private goLive(): void {
    this.phase = 'live'
    if (this.keeperRead) {
      const k = this.agents.find((a) => a.team === 'opp' && a.isKeeper)
      if (k) this.events.push({ type: 'keeperRead', by: k.id, zone: this.keeperRead.zone, x: k.pos.x, y: k.pos.y })
    }
    if (this.owner === this.hero) {
      this.startBullet(0.25, this.possessionWindow())
      // (hold_up: the marker is on his back as it starts — holding him off is the moment, no free first look.)
      this.graceUntil = this.kind === 'hold_up' ? this.time : this.time + startGrace(this.hero.attrs.composure)
    }
    if (this.kind === 'rebound') {
      this.startBullet(0.45, 0.45 + a01(this.hero.attrs.composure) * 0.3)
      // First to it: a reader (Anticipation) is off the mark before the defenders.
      this.readBurstUntil = this.time + 0.3 + 1.2 * a01(this.hero.attrs.anticipation ?? 50)
      // ...while their defenders are ball-watching the save (their own Anticipation gets them going).
      for (const o of this.agents) if (o.team === 'opp' && !o.isKeeper) o.think = Math.max(o.think, REBOUND_WATCH * (1.3 - a01(o.attrs.anticipation ?? 50)))
    }
    if (this.kind === 'long_ball_control') this.longBall()
    // gk_sweep: a keeper who reads the ball over the top (GK Positioning) is off the mark first.
    if (this.kind === 'gk_sweep' && this.hero.isKeeper) this.readBurstUntil = this.time + 2.0
    if (this.kind === 'shoulder_duel') this.channelBall()
    if (this.kind === 'gk_distribution' && this.owner === this.hero && !this.keeperHold) {
      this.keeperHold = { until: this.time + KEEPER_HOLD_SECONDS, releasedAt: -1, thrown: false }
    }
  }

  /** shoulder_duel: the deep team-mate plays it into the channel ahead of the hero and his marker. */
  private channelBall(): void {
    const by = this.owner
    if (!by || by.isHero || by.team !== 'hero') return
    const from = { x: this.ball.x, y: this.ball.y }
    // Into the space ahead of the pair, curling toward the touchline side of the channel.
    const target = inField({ x: this.hero.pos.x + this.rng.range(7, 9), y: this.hero.pos.y + (this.hero.pos.y < GOAL_CENTER_Y ? -1 : 1) * this.rng.range(0, 1.5) }, 3)
    // A driven ball over that distance (a ground through ball would die short of the channel).
    const kind: KickKind = dist(from, target) > 24 ? 'lofted' : 'through'
    const plan = planKick({ kind, from, target, ...(kind === 'lofted' ? { targetZ: 0.3 } : {}), power: 0.75, curl: 0, attrs: by.attrs, pressure: 0, assist: 'manual', env: this.env, noiseScale: 0.8 }, this.rng)
    this.kickBall(by, plan, kind, 0.75, null)
  }

  /** long_ball_control: the deep team-mate hits a long diagonal toward the hero's feet/chest. */
  private longBall(): void {
    const by = this.owner
    if (!by || by.isHero || by.team !== 'hero') return
    const heroC = { id: this.hero.id, pos: this.hero.pos, vel: this.hero.vel }
    // Played into the space in front of him (away from the marker on his back), dropping to his chest/feet.
    const from = { x: this.ball.x, y: this.ball.y }
    const lead = leadPosition(from, heroC, 16, 2)
    const back = norm(sub(from, lead))
    const target = add(lead, scale(back, 1.6))
    const plan = planKick({ kind: 'lofted', from, target, targetZ: 0.7, power: 0.75, curl: 0, attrs: by.attrs, pressure: 0, assist: 'manual', env: this.env, noiseScale: 0.9 * this.mateNoise(), fromHands: by.isKeeper }, this.rng)
    this.kickBall(by, plan, 'lofted', 0.75, this.hero.id)
  }

  // ───────────────────────── Bullet time ─────────────────────────

  private possessionWindow(): number {
    let near = Infinity
    for (const o of this.agents) if (o.team !== this.hero.team && !o.isKeeper) near = Math.min(near, dist(o.pos, this.hero.pos))
    return bulletWindowFor(this.hero.attrs.composure, near)
  }

  private startBullet(scale: number, seconds: number): void {
    if (!this.slowMoAim) return
    seconds *= this.timingMult
    this.bulletScale = scale
    this.bulletLeft = seconds
    this.bulletWindow = seconds
    this.events.push({ type: 'bullet', on: true })
  }

  private stopBullet(): void {
    if (this.bulletLeft > 0) {
      this.bulletLeft = 0
      this.events.push({ type: 'bullet', on: false })
    }
  }

  // ───────────────────────── Hero input ─────────────────────────

  private heroBusy(): boolean {
    const s = this.hero.state
    return s === 'slide' || s === 'dive' || s === 'down' || this.time < this.stumbleUntil
  }

  private handleAction(act: HeroAction): void {
    const hero = this.hero
    if (act.kind === 'call') return this.callForBall(act.at ?? null)
    // Set-piece choices are only taken while the clock is stopped; the corner itself is struck by script.
    if (act.kind === 'corner' || act.kind === 'wall') return
    if (this.kind === 'corner_kick' && this.setPiece?.takerId === hero.id) return
    if (this.heroBusy()) return
    if (act.kind === 'btn') return this.buttonAction(act)
    if (hero.isKeeper && this.owner !== hero) {
      this.keeperAction(act)
      return
    }
    if (this.heroOnBall) {
      if (act.kind === 'skill') return this.skillMove()
      const k = this.resolveHeroKick(act, false)
      if (k) {
        this.kickBall(hero, k.plan, k.kind, k.power, k.passTo)
        // Keeper distribution: a rolled / thrown pass or a lofted kick out of the hands.
        if (this.keeperHold && this.keeperHold.releasedAt < 0) this.keeperHold = { ...this.keeperHold, releasedAt: this.time, thrown: k.kind === 'pass' || k.kind === 'through' }
      }
      return
    }
    this.offBallAction(act)
  }

  /** Converts a hero action into a concrete kick (or null if not a kick). */
  private resolveHeroKick(
    act: HeroAction,
    preview: boolean,
  ): { plan: KickPlan; kind: KickKind; power: number; passTo: string | null } | null {
    const hero = this.hero
    const from = { x: this.ball.x, y: this.ball.y }
    const mates = this.passCandidates()
    const opp = this.agents.filter((a) => a.team === 'opp').map((a) => a.pos)
    const pressure = this.pressureOn(hero)
    const sp = this.setPiece && this.setPiece.takerId === hero.id ? this.setPiece : null
    const rng = preview ? undefined : this.rng
    // Out of the hands (GK hold): the release leans on Distribution (GK).
    const fromHands = !!(hero.isKeeper && this.keeperHold && this.keeperHold.releasedAt < 0)
    const base = { from, fromZ: this.ball.z, attrs: hero.attrs, pressure, assist: this.assist, env: this.env, assistPull: this.assistPull(), fromHands }

    const shot = (target: Vec2, power: number, curl: number, chip: boolean, placed = false) => {
      const kind: KickKind = chip ? 'chip' : sp?.kind === 'penalty' ? 'penalty' : sp?.kind === 'freekick' ? 'freekick' : 'shot'
      let t = { ...target }
      let tz: number | undefined
      if (sp) {
        // Low composure: the aim trembles (also visible on the reticle).
        const p = this.panicOffset()
        t = { x: t.x, y: t.y + p.y }
      }
      if (kind === 'chip') {
        tz = 1.5
        t = { x: PITCH_LENGTH + 0.3, y: t.y }
      }
      // Chip vs keeper (2.1#47): easy over a keeper off his line, hard against one on it.
      const gk = kind === 'chip' ? this.agents.find((a) => a.isKeeper && a.team === 'opp') : undefined
      const chipF = gk ? chipKeeperFactor(PITCH_LENGTH - gk.pos.x) : 1
      const plan = planKick({ ...base, kind, target: t, targetZ: tz, power, curl, placed, noiseScale: this.noiseScale() * HERO_SHOT_NOISE * chipF, skill: sp ? undefined : momentSkill('shot', hero.attrs) }, rng)
      return { plan, kind, power, passTo: null }
    }
    /** A ground ball played with a man right on him, into his body: charged down (the release was left too late). */
    const chargedDown = (dir: Vec2, skill: number, mult = 1): Vec2 | null => {
      if (!rng || fromHands) return null
      const presser = this.agents
        .filter((a) => a.team === 'opp' && !a.isKeeper && dist(a.pos, from) < HERO_CHARGE_DOWN.range && dot(norm(sub(a.pos, from)), dir) > HERO_CHARGE_DOWN.cos)
        .sort((p, q) => dist(p.pos, from) - dist(q.pos, from))[0]
      if (!presser) return null
      const close = clamp01((HERO_CHARGE_DOWN.range - dist(presser.pos, from)) / HERO_CHARGE_DOWN.range)
      // Owner, build 9: his Tackling vs the passer's Passing (+1 % a point); further off up to −30, a cross (a leg out
      // is enough) +10, the difficulty sharpens him.
      void skill
      return rng.chance(eventChanceOf(presser.attrs.tackling, hero.attrs.passing, (close - 1) * 30 + (mult > 1 ? 10 : 0) + (this.difficulty - 1) * 20)) ? presser.pos : null
    }
    const pass = (to: PassCandidate, lofted: boolean, powerIn: number) => {
      // Out of the hands (build 9): a good distributor gets it there firmer and quicker (×0.82 at 40, ×1.22 at 90).
      const power = fromHands ? powerIn * (0.504 + 0.8 * a01(hero.attrs.gkDistribution ?? hero.attrs.passing)) : powerIn
      // To feet, a step ahead of a man on the move (build 8: a 9 m lead turned a short pass into a through ball).
      let target = leadPosition(from, to, lofted ? 17 : 13, lofted ? 9 : PASS_LEAD_MAX)
      const kind: KickKind = lofted ? 'lofted' : 'pass'
      // A lofted switch is Long Passing / Vision (kick.kickSkill), a pass along the floor the pass moment skill.
      const sk = fromHands ? undefined : lofted ? kickSkill('lofted', hero.attrs, dist(from, target)) : momentSkill('pass', hero.attrs)
      if (!lofted && sk !== undefined) target = chargedDown(norm(sub(target, from)), sk) ?? target
      // Range (build 8): beyond 15 m a ground pass is a passer's ball — scatter grows with distance for a weak one.
      const range = !lofted && sk !== undefined ? 1 + PASS_RANGE_NOISE * (1 - sk) * clamp01((dist(from, target) - 15) / 15) : 1
      const plan = planKick({ ...base, kind, target, power, curl: 0, noiseScale: this.noiseScale() * range, skill: sk }, rng)
      return { plan, kind, power, passTo: to.id }
    }
    const through = (point: Vec2, lofted: boolean, power: number) => {
      // Full assist (2.1#28/#29): a ball played within PASS_MAGNET of a mate becomes a pass to him;
      // whether he controls it is then down to his First Touch and the ball's speed.
      const near = magnetMate(point, mates, this.assist)
      if (near) return pass(near, lofted, power)
      const kind: KickKind = lofted ? 'lofted' : 'through'
      const sk = fromHands ? undefined : momentSkill('through', hero.attrs)
      let target = inField(point, 1)
      if (sk !== undefined && rng) {
        // Weight and line of the ball into space: Vision / Passing set how true it is.
        const ax = norm(sub(target, from))
        const along = rng.normal(0, HERO_THROUGH_SPREAD.along * (1 - sk))
        const side = rng.normal(0, HERO_THROUGH_SPREAD.side * (1 - sk))
        target = inField({ x: target.x + ax.x * along - ax.y * side, y: target.y + ax.y * along + ax.x * side }, 1)
      }
      if (!lofted && sk !== undefined) target = chargedDown(norm(sub(target, from)), sk) ?? target
      const plan = planKick({ ...base, kind, target, power, curl: 0, noiseScale: this.noiseScale(), skill: sk }, rng)
      return { plan, kind, power, passTo: null }
    }

    switch (act.kind) {
      case 'shoot':
        return shot(act.target, act.power, act.curl, act.chip)
      case 'swipe': {
        const sw = act.swipe
        if (sw.isTap) return null
        if (sp && sp.kind === 'penalty') return shot(shotTargetFromDir(from, sw.dir), sw.power, sw.curl * 0.6, sw.chip)
        const m = interpretSwipe(sw, from, mates, opp, this.assist)
        switch (m.kind) {
          case 'shot':
            // Intent magnet: a swipe at a corner (or just past the post) finishes in that corner.
            return shot(intentShotTarget(shotTargetFromDir(from, sw.dir), this.assist), sw.power, sw.curl, m.chip)
          case 'pass':
            return pass(m.to, m.lofted, sw.power)
          case 'through':
            return through(m.point, m.lofted, sw.power)
          case 'cross': {
            if (m.zone?.ground) {
              // Cut-back: a firm pass along the floor to the edge of the box.
              const plan = planKick({ ...base, kind: 'through', target: m.point, power: 0.7, curl: 0, noiseScale: this.noiseScale() }, rng)
              return { plan, kind: 'through' as KickKind, power: 0.7, passTo: null }
            }
            const plan = planKick({ ...base, kind: 'cross', target: m.point, targetZ: m.zone?.z ?? 1.8, power: sw.power, curl: sw.curl * 0.7, noiseScale: this.noiseScale(), skill: momentSkill('cross', hero.attrs) }, rng)
            return { plan, kind: 'cross' as KickKind, power: sw.power, passTo: null }
          }
        }
        return null
      }
      case 'tapAt': {
        const mate = mates.filter((m) => dist(m.pos, act.at) < 3.2).sort((p, q) => dist(p.pos, act.at) - dist(q.pos, act.at))[0]
        if (mate) return pass(mate, dist(from, mate.pos) > 30, 0.6)
        // Tap inside the goal mouth area → placed shot.
        if (act.at.x > PITCH_LENGTH - 3 && Math.abs(act.at.y - GOAL_CENTER_Y) < 6) return shot({ x: PITCH_LENGTH, y: act.at.y }, 0.75, 0, false, true)
        return through(act.at, dist(from, act.at) > 28, 0.6)
      }
      case 'pass': {
        if (act.target) {
          const mate = mates.filter((m) => dist(m.pos, act.target!) < 3.5).sort((p, q) => dist(p.pos, act.target!) - dist(q.pos, act.target!))[0]
          if (mate && !act.through) return pass(mate, act.lofted ?? dist(from, mate.pos) > 30, 0.6)
          return through(act.target, act.lofted ?? false, 0.65)
        }
        const dir = act.dir && len(act.dir) > 0.2 ? norm(act.dir) : fromAngle(hero.facing)
        if (act.through) {
          // The runner the stick is sending (closest to it in angle, measured to where he is running to).
          const offStick = (m: PassCandidate) => Math.abs(angleDiff(angleOf(sub(leadPosition(from, m, 14), from)), angleOf(dir)))
          const ahead = mates.filter((m) => dot(norm(sub(m.pos, from)), dir) > 0.5 && m.pos.x > from.x - 2).sort((p, q) => offStick(p) - offStick(q))[0]
          const point = ahead ? add(leadPosition(from, ahead, 14), scale(dir, 5)) : add(from, scale(dir, 18))
          return through(point, act.lofted ?? false, 0.7)
        }
        const mate = this.passMate(from, act.dir, mates, opp)
        if (mate) return pass(mate, act.lofted ?? dist(from, mate.pos) > 30, 0.6)
        return through(add(from, scale(dir, 14)), act.lofted ?? false, 0.6)
      }
      case 'btn': {
        const dir = act.dir && len(act.dir) > 0.2 ? norm(act.dir) : undefined
        switch (act.id) {
          case 'pass':
            return this.resolveHeroKick({ kind: 'pass', dir }, preview)
          case 'through':
            return this.resolveHeroKick({ kind: 'pass', dir, through: true }, preview)
          case 'shoot': {
            // Placed toward the far side of the keeper; Shooting / Composure decide how true it flies.
            const aim = this.autoGoalAim()
            return shot({ x: PITCH_LENGTH, y: aim.y }, 0.85, 0, false)
          }
          case 'lofted': {
            // Long Passing / Vision: the switch to the freest team-mate at least 20 m away.
            const far = mates
              .map((m) => ({ m, d: dist(from, m.pos), open: laneOpenness(from, m.pos, opp) }))
              .filter((c) => c.d > 20)
              .sort((p, q) => q.open * 0.6 + q.d / 60 - (p.open * 0.6 + p.d / 60))[0]
            if (far) return pass(far.m, true, 0.75)
            return through(add(from, scale(dir ?? fromAngle(hero.facing), 30)), true, 0.75)
          }
          case 'cross': {
            // Crossing: whip it toward the runner in the box (or the penalty spot area).
            const sideY = from.y < GOAL_CENTER_Y ? 1 : -1
            const runner = mates.filter((m) => m.pos.x > PITCH_LENGTH - 18 && Math.abs(m.pos.y - GOAL_CENTER_Y) < 12).sort((p, q) => dist(p.pos, { x: PITCH_LENGTH - 9, y: GOAL_CENTER_Y }) - dist(q.pos, { x: PITCH_LENGTH - 9, y: GOAL_CENTER_Y }))[0]
            const sk = momentSkill('cross', hero.attrs)
            const aimed = inField(runner ? leadPosition(from, runner, 18, 3) : { x: PITCH_LENGTH - 8, y: GOAL_CENTER_Y + sideY * 2 }, 2)
            // Left too late, with the full-back on him: blocked.
            const target = chargedDown(norm(sub(aimed, from)), sk, HERO_CROSS_BLOCK) ?? aimed
            const plan = planKick({ ...base, kind: 'cross', target, targetZ: 1.8, power: 0.7, curl: 0.4 * sideY, noiseScale: this.noiseScale(), skill: sk }, rng)
            return { plan, kind: 'cross' as KickKind, power: 0.7, passTo: null }
          }
          case 'throw': {
            // Out of the hands to the nearest team-mate with a clear lane (GK Distribution).
            const near = mates
              .map((m) => ({ m, d: dist(from, m.pos), open: laneOpenness(from, m.pos, opp) }))
              .filter((c) => c.d < 32)
              .sort((p, q) => q.open - q.d / 60 - (p.open - p.d / 60))[0]
            if (near) return pass(near.m, false, 0.55)
            return this.resolveHeroKick({ kind: 'pass', dir }, preview)
          }
          case 'kick': {
            // A long kick upfield to the furthest free team-mate.
            const far = mates
              .map((m) => ({ m, open: laneOpenness(from, m.pos, opp) }))
              .sort((p, q) => q.m.pos.x * attackDir(hero.team) + q.open * 20 - (p.m.pos.x * attackDir(hero.team) + p.open * 20))[0]
            if (far) return pass(far.m, true, 0.85)
            return through(add(from, { x: attackDir(hero.team) * 40, y: 0 }), true, 0.85)
          }
          default:
            return null
        }
      }
      case 'action': {
        // Quick contextual play: shoot if facing goal in range, else pass forward.
        const toGoal = sub({ x: PITCH_LENGTH, y: GOAL_CENTER_Y }, from)
        // (The corner the keeper leaves open — the same read as the SHOOT button, not a coin.)
        if (len(toGoal) < 22) return shot({ x: PITCH_LENGTH, y: this.autoGoalAim().y }, 0.8, 0, false)
        const mate = pickPassTarget(from, fromAngle(hero.facing), mates, opp, 'full')
        if (mate) return pass(mate, false, 0.6)
        return null
      }
      default:
        return null
    }
  }

  /** Easy mode keeps aim assist generous (pulls most of a miss back toward the frame). */
  private assistPull(): number | undefined {
    if (this.assist === 'manual') return undefined
    return this.difficulty < 0.9 ? (this.assist === 'full' ? 0.85 : 0.55) : undefined
  }

  private noiseScale(): number {
    // Hero is slightly penalised on harder difficulty; tired legs late on cost accuracy (Stamina).
    return (0.85 + (this.difficulty - 1) * 0.6) * fatigueNoise(this.heroCondition)
  }

  /** Kick-noise multiplier of the hero's AI team-mates: a leader's team plays cleaner (−15 % at full lift). */
  private mateNoise(): number {
    return 1 - 0.15 * this.lead
  }

  private passCandidates(): PassCandidate[] {
    return this.agents.filter((a) => a.team === 'hero' && !a.isHero && !a.isKeeper).map((a) => ({ id: a.id, pos: a.pos, vel: a.vel }))
  }

  private pressureOn(a: Agent): number {
    let m = Infinity
    for (const o of this.agents) if (o.team !== a.team && !o.isKeeper) m = Math.min(m, dist(o.pos, a.pos))
    return clamp01((3.5 - m) / 3.5)
  }

  /** Keeper-hero input: dives. */
  private keeperAction(act: HeroAction): void {
    const hero = this.hero
    // A cross in the air (not a shot): come and claim it (gk_claim, or any high ball into the box).
    if ((act.kind === 'action' || act.kind === 'tapAt' || act.kind === 'skill') && this.crossInFlight()) {
      this.claimUntil = this.time + 2.6
      return
    }
    let dir: Vec2 | null = null
    if (act.kind === 'swipe') dir = act.swipe.isTap ? null : act.swipe.dir
    else if (act.kind === 'dive') dir = act.dir
    else if (act.kind === 'tapAt') dir = dist(act.at, hero.pos) > 0.8 ? norm(sub(act.at, hero.pos)) : null
    else if (act.kind === 'action' || act.kind === 'skill') {
      const plan = planSave(hero, this.aiWorld(), 0)
      dir = plan && Math.abs(plan.point.y - hero.pos.y) > 0.4 ? norm(sub(plan.point, hero.pos)) : null
      if (!dir) {
        // Set & claim: short step toward the ball.
        hero.cd = 0.3
        return
      }
    }
    if (!dir || len(dir) < 0.1) return
    // Assist bends the dive toward the actual crossing point if roughly the same side.
    if (this.assist !== 'manual') {
      const plan = planSave(hero, this.aiWorld(), 0)
      if (plan && plan.onTarget) {
        const ideal = norm(sub(plan.point, hero.pos))
        if (dot(ideal, dir) > 0.2) dir = norm(add(scale(dir, this.assist === 'full' ? 0.25 : 0.6), scale(ideal, this.assist === 'full' ? 0.75 : 0.4)))
      }
    }
    // Graded keeping: he went the right way for a shot on target (doing his job, even if beaten or it was kept out
    // by someone else).
    const sv = this.defending ? planSave(hero, this.aiWorld(), 0) : null
    const rightWay = !!sv?.onTarget && (Math.abs(sv.point.y - hero.pos.y) < 0.5 || Math.sign(sv.point.y - hero.pos.y) === Math.sign(dir.y))
    if (rightWay) this.keeperRightWay = true
    // (Diving the right way at a ball he has read: to it, not past it — with the aim assist; manual dives go full length.)
    const at = this.assist !== 'manual' && rightWay && sv ? sv.point : undefined
    this.startDive(hero, dir, at)
  }

  /** A high ball (cross / corner, not a shot) is dropping into our box. */
  private crossInFlight(): boolean {
    if (this.owner || this.ball.z < 0.9 || (this.shot && this.shot.by.team !== this.hero.team)) return false
    const land = this.crossLanding()
    return !!land && this.inOwnBox(this.hero, land.p)
  }

  /** Where a high ball comes down to head / hand height (looks further ahead than {@link landingPoint}). */
  private crossLanding(): { p: Vec2; t: number } | null {
    const b = this.ball
    const h = b.z - 2.4
    const disc = b.vz * b.vz + 2 * GRAVITY * h
    if (disc < 0) return null
    // Ballistic time to hand height, with a little air drag on the carry.
    const t = (b.vz + Math.sqrt(disc)) / GRAVITY
    if (t < 0 || t > 4) return null
    const k = 1 - Math.min(0.35, t * 0.12)
    return { p: { x: b.x + b.vx * t * k, y: b.y + b.vy * t * k }, t }
  }

  /** @param to the point he dives at (his hand meets the ball there): the body travels only as far as it needs. */
  private startDive(k: Agent, dir: Vec2, to?: Vec2): void {
    // Dives are mostly lateral; clamp forward component.
    const inward = attackDir(k.team)
    let d = norm(dir)
    if (d.x * inward < -0.2) d = norm({ x: -0.2 * inward, y: d.y })
    k.state = 'dive'
    k.stateT = 0
    k.actionDir = d
    k.diveLeft = to ? Math.max(0, dot(sub(to, k.pos), d) - armReach(k) * 0.6) : undefined
    k.facing = Math.atan2(d.y, d.x)
    this.events.push({ type: 'dive', by: k.id })
  }

  /** Hero without the ball: headers, volleys, tackles, calling for the ball. */
  private offBallAction(act: HeroAction): void {
    const hero = this.hero
    const ballP = { x: this.ball.x, y: this.ball.y }
    const carrier = this.owner
    // Defending: tackles.
    if (carrier && carrier.team === 'opp') {
      const d = dist(hero.pos, carrier.pos)
      this.defPressAt = this.time
      if (act.kind === 'swipe' && !act.swipe.isTap) return this.startSlide(act.swipe.dir)
      if (act.kind === 'action' || act.kind === 'skill' || act.kind === 'tapAt' || act.kind === 'pass') {
        if (d < 1.8) return this.standingTackle(carrier)
        if (d < 5.5) return this.startSlide(norm(sub(add(ballP, scale(carrier.vel, 0.25)), hero.pos)))
      }
      return
    }
    // One-two: a second tap shortly after passing asks the receiver to return it into the run.
    if (this.tryArmOneTwo(act)) return
    // Loose/aerial ball near: header or volley.
    const incoming = this.ballIncomingToHero()
    if (act.kind === 'swipe' && !act.swipe.isTap) this.heroHeaderAim = this.headerAimFromDir(act.swipe.dir)
    if (incoming || act.kind === 'action' || act.kind === 'tapAt' || act.kind === 'swipe') {
      if (incoming && this.ball.z < 1.0 && dist(hero.pos, ballP) < 1.6) {
        // First-time volley / shot.
        const aim = this.heroHeaderAim ?? this.autoGoalAim()
        const plan = planKick({ kind: 'shot', from: ballP, fromZ: this.ball.z, target: aim, power: 0.85, curl: 0, attrs: hero.attrs, pressure: this.pressureOn(hero), assist: this.assist, assistPull: this.assistPull(), env: this.env, noiseScale: this.noiseScale() * 1.3 * HERO_SHOT_NOISE, skill: momentSkill('shot', hero.attrs) }, this.rng)
        this.kickBall(hero, plan, 'shot', 0.85, null)
        return
      }
      if (incoming || this.ball.z > 0.8 || !carrier) {
        if (hero.cd <= 0 && hero.state !== 'jump') {
          hero.state = 'jump'
          hero.stateT = 0
          hero.cd = 0.75
          if (!this.heroHeaderAim) this.heroHeaderAim = this.autoGoalAim()
          this.events.push({ type: 'jump', by: hero.id })
        }
        return
      }
    }
    // Team-mate on the ball: call for it (optionally pointing to space).
    if (carrier && carrier.team === 'hero') {
      const at = act.kind === 'tapAt' ? act.at : act.kind === 'swipe' && !act.swipe.isTap ? add(hero.pos, scale(act.swipe.dir, 10)) : null
      this.heroRequest = { at, t: this.time }
      this.events.push({ type: 'callForBall', by: hero.id })
    }
  }

  /**
   * Pass-to-me call (WP-14): the hero raises his hand; the team-mate on the
   * ball reacts at once and passes if relationship / vision / the lane allow
   * (see {@link callAcceptChance}), otherwise ignores him ("won't pass").
   */
  private callForBall(at: Vec2 | null): void {
    if (this.heroOnBall || this.hero.isKeeper || this.phase !== 'live') return
    this.heroCallAt = this.time
    this.events.push({ type: 'callForBall', by: this.hero.id })
    const carrier = this.owner
    if (!carrier || carrier.team !== 'hero' || carrier.isHero) return
    this.heroRequest = { at, t: this.time, explicit: true }
    carrier.think = Math.min(carrier.think, 0.05)
  }

  /** Arms the one-two if the action is a tap/press within the window. */
  private tryArmOneTwo(act: HeroAction): boolean {
    const o = this.oneTwo
    if (!o || o.armed || this.time - o.t > ONE_TWO_WINDOW * this.timingMult) return false
    // A tap, or (plan 2.1#59) a swipe into space: run and ask for it back.
    const trigger = act.kind === 'action' || act.kind === 'tapAt' || act.kind === 'pass' || act.kind === 'skill' || act.kind === 'swipe'
    if (!trigger) return false
    const mate = this.agents.find((a) => a.id === o.id)
    if (!mate) return false
    // The ball must be with the receiver or still on its way to him.
    if (this.owner && this.owner !== mate) return false
    if (!this.owner) {
      // Still travelling from the hero's boot toward the receiver (moving away from the hero).
      const away = this.ball.vx * (this.ball.x - this.hero.pos.x) + this.ball.vy * (this.ball.y - this.hero.pos.y) > 0
      if (this.lastTouch !== this.hero || !away) return false
    }
    o.armed = true
    o.armedAt = this.time
    mate.think = Math.min(mate.think, 0.05)
    this.events.push({ type: 'oneTwo', by: mate.id })
    return true
  }

  /** A crosser delivers an aerial ball to `to`'s run (header / back_post moments). */
  private crossFor(a: Agent, to: Agent, z: number): void {
    const from = { x: this.ball.x, y: this.ball.y }
    const lead = leadPosition(from, { id: to.id, pos: to.pos, vel: to.vel }, 18, 3)
    const goalX = attackDir(a.team) > 0 ? PITCH_LENGTH : 0
    const near = goalX - attackDir(a.team) * 4
    const far = goalX - attackDir(a.team) * 16
    const target = { x: clampN(lead.x, Math.min(near, far), Math.max(near, far)), y: clampN(lead.y, GOAL_CENTER_Y - 12, GOAL_CENTER_Y + 12) }
    // The scripted feed of a header moment is the setup, the header is the moment (build 9): a truer ball to him
    // (half the scatter, still the crosser's Crossing), unhurried.
    const feed = this.kind === 'header' && to.isHero
    const noiseScale = a.team === 'opp' ? 1.1 / this.difficulty : 1.25 * this.mateNoise() * (feed ? 0.5 : 1)
    const plan = planKick({ kind: 'cross', from, target, targetZ: z, power: 0.7, curl: 0.4 * Math.sign(GOAL_CENTER_Y - a.pos.y), attrs: a.attrs, pressure: feed ? 0 : this.pressureOn(a), assist: 'manual', env: this.env, noiseScale }, this.rng)
    this.kickBall(a, plan, 'cross', 0.7, null)
  }

  /** timed_run: the ball over the top into the space ahead of the hero's run (in behind the line). */
  private runInBehind(): Vec2 {
    const hero = this.hero
    const line = this.offsideLineX() ?? hero.pos.x
    // Over the line into the space before the keeper's box, weighted for the runner: as far ahead of him as he gets
    // to before the keeper can come off his line for it (his Pace / Acceleration decide how far that is).
    const y = hero.pos.y + (GOAL_CENTER_Y - hero.pos.y) * 0.4
    const gk = this.agents.find((q) => q.isKeeper && q.team === 'opp')
    const heroV = topSpeed({ ...hero, sprint: true })
    // (Where he meets it as it comes down — his sprint against the ball's flight — and never where the keeper is first.)
    const from = { x: this.ball.x, y: this.ball.y }
    let best = line + 2
    let bestScore = Infinity
    for (let x = line + 2; x <= PITCH_LENGTH - TIMED_RUN_DEPTH; x += 0.5) {
      const p = { x, y }
      const tHero = dist(hero.pos, p) / heroV
      const tBall = dist(from, p) / TIMED_RUN_BALL_SPEED
      const tGk = gk ? dist(gk.pos, p) / topSpeed({ ...gk, sprint: true }) + 0.45 : 99
      if (tHero + 0.35 >= tGk) break
      const score = Math.abs(tHero - (tBall + TIMED_RUN_SETTLE))
      if (score < bestScore) {
        bestScore = score
        best = x
      }
    }
    return inField({ x: best, y }, 2)
  }

  /** timed_run: the ball over the top of the line into the runner's path. */
  private playInBehind(a: Agent): void {
    const from = { x: this.ball.x, y: this.ball.y }
    // The scripted feed (build 9): played round the man pressing him, not into his face.
    for (const o of this.agents) if (o.team === 'opp' && !o.isKeeper && dist(o.pos, a.pos) < 3) o.noTouch = Math.max(o.noTouch, 0.45)
    const target = this.runInBehind()
    // Over the top: it has to clear the line's heads and drop for the runner.
    const plan = planKick({ kind: 'lofted', from, target, targetZ: 1.1, power: 0.5, curl: 0, attrs: a.attrs, pressure: this.pressureOn(a), assist: 'manual', env: this.env, noiseScale: this.mateNoise() }, this.rng)
    this.kickBall(a, plan, 'lofted', 0.5, null)
    // Their back line was stepping up: caught going the wrong way, they have to stop and turn before they chase.
    // A quicker runner than his marker (Pace + Acceleration) is gone before the turn is done (role balance Tur 4).
    const quick = (a: Agent): number => a01(a.attrs.pace) * 0.5 + a01(a.attrs.acceleration ?? a.attrs.pace) * 0.5
    for (const o of this.agents) {
      if (o.team !== 'opp' || o.isKeeper || o.pos.x < this.hero.pos.x - 8) continue
      // (…and one who ran off their blind side — Positioning — makes them look for him first.)
      const turn = inBehindTurn(quick(this.hero) - quick(o)) + BLIND_SIDE * a01(this.hero.attrs.positioning)
      o.think = Math.max(o.think, turn)
      o.vel = { x: -1.5, y: o.vel.y * 0.3 }
      o.intent = { kind: 'run', to: { x: o.pos.x - 0.5, y: o.pos.y }, until: this.time + turn }
    }
  }

  /** The receiver plays the return pass first time into the hero's run. */
  private playOneTwo(a: Agent): void {
    this.oneTwo = null
    const heroC = { id: this.hero.id, pos: this.hero.pos, vel: this.hero.vel }
    const from = { x: this.ball.x, y: this.ball.y }
    const target = inField(add(leadPosition(from, heroC, 15, 10), { x: attackDir('hero') * 1.5, y: 0 }), 1)
    const opp = this.agents.filter((q) => q.team === 'opp').map((q) => q.pos)
    const lofted = dist(from, target) > 26 || laneOpenness(from, target, opp) < 0.1
    const kind: KickKind = lofted ? 'lofted' : 'pass'
    const noiseScale = clampN(1.15 - a01(a.attrs.vision) * 0.5, 0.6, 1.15)
    const plan = planKick({ kind, from, target, power: 0.65, curl: 0, attrs: a.attrs, pressure: this.pressureOn(a), assist: 'manual', env: this.env, noiseScale }, this.rng)
    this.kickBall(a, plan, kind, 0.65, this.hero.id)
  }

  private headerAimFromDir(dir: Vec2): Vec2 {
    return shotTargetFromDir({ x: this.hero.pos.x, y: this.hero.pos.y }, dir)
  }

  /** Corner of the goal away from the keeper. */
  private autoGoalAim(): Vec2 {
    // The corner the keeper leaves open: the side of the ball → goal line he is not covering.
    const gk = this.agents.find((a) => a.team === 'opp' && a.isKeeper)
    const b = this.ball
    let side = 1
    if (gk) {
      const lineY = b.y + ((GOAL_CENTER_Y - b.y) * (gk.pos.x - b.x)) / Math.max(1, PITCH_LENGTH - b.x)
      const off = gk.pos.y - lineY
      side = Math.abs(off) > 0.25 ? -Math.sign(off) : b.y > GOAL_CENTER_Y ? -1 : 1
    }
    return { x: PITCH_LENGTH + 0.2, y: GOAL_CENTER_Y + side * 2.35 }
  }

  /** True if a loose ball will come within reach of the hero soon. */
  private ballIncomingToHero(): boolean {
    if (this.owner) return false
    const pts = predictTrajectory(this.ball, this.env, { duration: 1.2, sampleEvery: 3 })
    return pts.some((p) => Math.hypot(p.x - this.hero.pos.x, p.y - this.hero.pos.y) < 2.2 && p.z < 3)
  }

  private skillMove(): void {
    const hero = this.hero
    if (hero.cd > 0 || this.owner !== hero || this.setPiece) return
    hero.cd = 1.0
    const fwd = fromAngle(hero.facing)
    const def = this.agents
      .filter((a) => a.team === 'opp' && !a.isKeeper && a.state !== 'down')
      .filter((a) => dist(a.pos, hero.pos) < 3.6 && dot(norm(sub(a.pos, hero.pos)), fwd) > 0.2)
      .sort((p, q) => dist(p.pos, hero.pos) - dist(q.pos, hero.pos))[0]
    // Timing (build 9): going as the man steps in (1.6–2.8 m) is the take-on; too early or too late he reads it.
    const dd = def ? dist(def.pos, hero.pos) : 99
    // Owner, build 9: his Dribbling vs the man's Tackling (+1 % a point); the timing ±15 points; nobody there: no roll.
    // (The same rule as the AI's take-on: a man rushing in is sold more easily — up to +20 — one goal-side of him is
    // harder to get past — up to −15.)
    const timing = dd >= 1.6 && dd <= 2.8 ? CHANCE_MOD.timing : -CHANCE_MOD.timing
    let mod = timing - (this.difficulty - 1) * 20
    if (def) {
      const toH = norm(sub(hero.pos, def.pos))
      mod += clamp01((def.vel.x * toH.x + def.vel.y * toH.y - 1) / 4) * 20 - goalSideness(def, hero) * 15
    }
    const success = !def || this.rng.chance(eventChance('takeOn', hero, def, mod))
    if (success && def) this.beatMan = true
    if (success || !def) {
      const side = def ? (angleDiff(Math.atan2(def.pos.y - hero.pos.y, def.pos.x - hero.pos.x), hero.facing) > 0 ? -1 : 1) : 0
      hero.state = 'skill'
      hero.stateT = 0
      hero.actionDir = fromAngle(hero.facing + side * 0.45)
      if (def) {
        def.noTouch = 1.0
        def.state = 'down'
        def.stateT = 0
        this.stats.dribbles++
      }
      this.events.push({ type: 'skill', by: hero.id, success: true })
    } else {
      // Ball knocked loose toward the defender.
      this.owner = null
      const d = norm(sub(def.pos, hero.pos))
      this.ball.vx = d.x * 5
      this.ball.vy = d.y * 5
      hero.noTouch = 0.6
      this.lastTouch = def
      this.events.push({ type: 'skill', by: hero.id, success: false })
    }
  }

  private standingTackle(carrier: Agent): void {
    const hero = this.hero
    if (hero.cd > 0) return
    hero.cd = 0.9
    // Anticipation: reading the carrier's touch times the challenge better.
    // A patient jockey (JOCKEY held first) waits for the touch: better timed, more so with Anticipation.
    // (Tight on him after a PRESS counts the same: he arrived, got set and waited for the touch.)
    const setT = Math.max(this.jockeyT, this.pressOn?.id === carrier.id ? (this.time - this.pressOn.since) * 2 : 0)
    const patience = Math.min(0.18, setT * 0.12) * (0.5 + a01(hero.attrs.anticipation ?? 50))
    // Charging in flat out (build 9): a set carrier sells him the shift — the faster he arrives, the worse his timing
    // (Agility: stopping and adjusting at pace).
    const closing = dot(hero.vel, norm(sub(carrier.pos, hero.pos)))
    const charge = clamp01((closing - HERO_CHARGE.from) / HERO_CHARGE.span) * HERO_CHARGE.timing * (1.2 - a01(hero.attrs.agility) * 0.6)
    const timing = clamp01(this.exposure(carrier) + (a01(hero.attrs.anticipation ?? 50) - 0.65) * 0.9 + patience - HERO_LUNGE_TIMING * this.lunge - charge)
    const behind = isBehind(carrier, hero)
    const gap = this.ballGap(carrier)
    // Owner, build 9: Tackling vs his Dribbling, +1 % a point (statChance); the timing above moves it ±15 points,
    // from behind −20, a lunge up to −30, the difficulty sharpens him. A miss stays clean on Tackling, else a foul.
    const mod = this.tackleMod(timing, behind, this.lunge)
    const st = { win: eventChance('tackle', hero, carrier, mod), early: gap <= LOOSE_BALL_GAP }
    if (this.rng.chance(st.win)) {
      this.winBall(hero, carrier, false)
    } else if ((behind || this.lunge > RECKLESS_LUNGE) && !this.rng.chance(this.cleanChance(hero, false, behind, this.lunge))) {
      // (A standing challenge from the front that misses is a miss; a reckless one — from behind, lunging in — can be a
      // foul: clean on his Tackling.)
      this.heroFoul(carrier, false, behind)
    } else {
      // Diving in at his feet (early) gets you beaten: he accelerates past. He stays on his feet (a missed standing
      // tackle is not a fall): his footwork back into it is Agility (0.35 s + up to 0.35 s, +0.3 s diving in early).
      this.stumbleUntil = this.time + MISS_RECOVER + MISS_RECOVER * (1 - a01(hero.attrs.agility)) + (st.early ? 0.3 : 0)
      hero.vel = scale(hero.vel, 0.3)
      if (st.early) carrier.vel = scale(carrier.vel, 1.15)
      hero.noTouch = this.stumbleUntil - this.time
      this.events.push({ type: 'tackle', by: hero.id, won: false, slide: false, x: hero.pos.x, y: hero.pos.y })
    }
  }

  /** Input points on a challenge (CHANCE_MOD): timing 0..1 (0.45 average) → ±15, from behind, a lunge, difficulty. */
  private tackleMod(timing: number, behind: boolean, lunge: number, slide = false): number {
    return clampN((timing - 0.45) / 0.45, -1, 1) * CHANCE_MOD.timing + (behind ? CHANCE_MOD.behind : 0) + CHANCE_MOD.lunge * clamp01(lunge) + (slide ? CHANCE_MOD.slide : 0) - (this.difficulty - 1) * 20
  }

  /** A challenge that missed stays clean (Tackling; a slide, from behind, a lunge less so) — else a foul (referee). */
  private cleanChance(tackler: Agent, slide: boolean, behind: boolean, lunge = 0): number {
    const clean = eventChance('clean', tackler, undefined, (slide ? CHANCE_MOD.cleanSlide : CHANCE_MOD.cleanStanding) + (behind ? CHANCE_MOD.behind : 0) + CHANCE_MOD.lunge * clamp01(lunge))
    return 1 - (1 - clean) * refHighlightFoulMult(this.refStrictness)
  }

  private startSlide(dir: Vec2): void {
    const hero = this.hero
    if (hero.cd > 0 || len(dir) < 0.1) return
    hero.cd = 1.4
    hero.state = 'slide'
    hero.stateT = 0
    hero.actionDir = norm(dir)
    hero.vel = scale(hero.actionDir, Math.max(len(hero.vel), topSpeed({ ...hero, sprint: true })) + 1.2)
    this.heroTackleResolved = false
    // block: diving in at the set shooter is what the shift sells (BLOCK_SHIFT, his Dribbling vs the hero's Agility) —
    // rolled as he goes to ground (a slide from range resolved before the shooter's next look, so it never was).
    const o = this.owner
    if (this.kind === 'block' && o && o.team === 'opp' && !this.blockShifted && dist(hero.pos, o.pos) < 5.5) {
      this.blockShifted = true
      // His Dribbling vs the hero's Agility (+1 % a point), a man going to ground sold +20, the difficulty sharpens him.
      if (this.rng.chance(eventChance('shift', o, hero, 20 + (this.difficulty - 1) * 20))) {
        const side = o.pos.y >= hero.pos.y ? 1 : -1
        o.intent = { kind: 'run', to: inField(add(o.pos, { x: -0.4, y: side * 1.8 }), 1), until: this.time + 0.35 }
        // Sold: he goes past the ball.
        this.heroTackleResolved = true
      }
    }
    this.events.push({ type: 'tackle', by: hero.id, won: false, slide: true, x: hero.pos.x, y: hero.pos.y })
  }

  // ───────────────────────── Context buttons (game/actionSet) ─────────────────────────

  /** One context button press. Holds (SPRINT / JOCKEY / SHIELD) are read from the control every step instead. */
  private buttonAction(act: Extract<HeroAction, { kind: 'btn' }>): void {
    const hero = this.hero
    switch (act.id) {
      case 'sprint':
      case 'jockey':
      case 'shield':
        return
      case 'call':
        return this.callForBall(null)
      case 'skill':
        if (this.owner === hero) this.skillMove()
        return
      case 'pass':
      case 'through':
      case 'lofted':
      case 'cross':
      case 'throw':
      case 'kick':
      case 'shoot': {
        if (this.owner !== hero) {
          // Off the ball SHOOT is the first-time finish of a ball dropping to him (rebound, cut-back).
          if (act.id === 'shoot' && !hero.isKeeper) this.offBallAction({ kind: 'action' })
          return
        }
        const k = this.resolveHeroKick(act, false)
        if (!k) return
        this.kickBall(hero, k.plan, k.kind, k.power, k.passTo)
        if (this.keeperHold && this.keeperHold.releasedAt < 0) this.keeperHold = { ...this.keeperHold, releasedAt: this.time, thrown: k.kind === 'pass' || k.kind === 'through' }
        return
      }
      case 'head':
      case 'jump':
        return this.heroJump()
      case 'tackle':
      case 'slide':
        this.defPressAt = this.time
        if (!this.tryEngage(act.id === 'slide')) {
          const c = this.owner
          this.engage = { slide: act.id === 'slide', until: this.time + 1.1, d0: c && c.team === 'opp' ? dist(hero.pos, c.pos) : TACKLE_REACH }
        }
        return
      case 'block':
        this.defPressAt = this.time
        return this.startBlock()
      case 'intercept':
        this.defPressAt = this.time
        return this.startIntercept()
      case 'press':
        this.defPressAt = this.time
        return this.startPress()
      case 'dive':
        return this.keeperDive(null)
      case 'diveLeft':
      case 'diveRight':
        return this.keeperDive(act.dir ?? { x: 0, y: act.id === 'diveLeft' ? -1 : 1 })
      case 'stay':
        // Set and big: no early dive, no drifting (a centre penalty or a 1v1 chip meets a body).
        hero.vel = scale(hero.vel, 0.3)
        this.stayUntil = this.time + 0.9
        this.dash = null
        return
      case 'rush':
        return this.startRush()
      case 'claim':
      case 'punch':
        if (this.crossInFlight()) {
          this.claimUntil = this.time + 2.6
          this.punchCross = act.id === 'punch'
        } else if (act.id === 'claim') this.startRush()
        return
    }
  }

  /** HEAD / JUMP: up for the ball (Jumping sets the height, Heading the reach), aimed at goal or cleared. */
  private heroJump(): void {
    const hero = this.hero
    if (hero.cd > 0 || (hero.state !== 'run' && hero.state !== 'wall')) return
    hero.state = 'jump'
    hero.stateT = 0
    hero.cd = 0.75
    if (!this.heroHeaderAim) this.heroHeaderAim = this.autoGoalAim()
    this.events.push({ type: 'jump', by: hero.id })
  }

  /**
   * TACKLE / SLIDE: goes in now if in range (standing: 1.8 m, slide: 5.5 m — Tackling / Aggression /
   * timing decide it, with the foul and card risk of {@link tackleOdds}); returns false when out of range.
   */
  private tryEngage(slide: boolean): boolean {
    const hero = this.hero
    if (hero.cd > 0 || hero.state !== 'run') return false
    const c = this.owner
    const ballP = { x: this.ball.x, y: this.ball.y }
    if (c && c.team === 'opp') {
      const d = dist(hero.pos, c.pos)
      if (!slide && d < 1.8) {
        this.standingTackle(c)
        return true
      }
      if (slide && d < 5.5) {
        this.startSlide(norm(sub(add(ballP, scale(c.vel, 0.25)), hero.pos)))
        return true
      }
      return false
    }
    // A loose ball: slide onto it (or step in and take it).
    if (!c && this.ball.z < 0.7) {
      const d = dist(hero.pos, ballP)
      if (slide && d < 5.5 && d > 0.6) {
        this.startSlide(norm(sub(add(ballP, { x: this.ball.vx * 0.2, y: this.ball.vy * 0.2 }), hero.pos)))
        return true
      }
    }
    return false
  }

  /** BLOCK: into the line between the ball and goal, body spread (Positioning finds the line, Aggression commits). */
  private startBlock(): void {
    const hero = this.hero
    this.blockUntil = this.time + 1.1
    if (hero.state === 'wall') return
    const err = (1 - a01(hero.attrs.positioning)) * 0.8
    const off = this.rng.range(-err, err)
    this.dash = {
      why: 'block',
      until: this.time + 1.1,
      to: () => {
        const b = { x: this.ball.x, y: this.ball.y }
        const goal = { x: ownGoalX(hero.team), y: GOAL_CENTER_Y }
        const dir = norm(sub(goal, b))
        const p = add(b, scale(dir, Math.min(2.2, dist(b, goal) * 0.5)))
        return { x: p.x - dir.y * off, y: p.y + dir.x * off }
      },
    }
  }

  /** INTERCEPT: reads the pass (Anticipation) and attacks the lane / the ball's path. */
  private startIntercept(): void {
    const hero = this.hero
    const read = a01(hero.attrs.anticipation ?? hero.attrs.positioning)
    if (read > 0.5) this.readBurstUntil = this.time + 0.4 * read
    this.dash = {
      why: 'intercept',
      until: this.time + 1.2,
      to: () => {
        const o = this.owner
        if (!o) return interceptPoint(hero, this.aiWorld(), 1.5).point
        if (o.team !== 'opp') return null
        // On the ball: step into the lane to his likeliest pass (a better reader picks the right one).
        const mates = this.agents.filter((a) => a.team === 'opp' && a !== o && !a.isKeeper).sort((p, q) => dist(p.pos, hero.pos) - dist(q.pos, hero.pos))
        const m = mates[read > 0.55 || mates.length < 2 ? 0 : 1]
        if (!m) return o.pos
        return add(o.pos, scale(sub(m.pos, o.pos), 0.45))
      },
    }
  }

  /** PRESS: flat out at the carrier (Work Rate); arriving hurries his decision (Aggression). */
  private startPress(): void {
    this.dash = {
      why: 'press',
      // Until he gets there (build 9 playtester: a 1.3 s run fizzled out short of a man pressed from 10+ m away).
      until: this.time + PRESS_RUN,
      to: () => {
        const o = this.owner
        if (o && o.team === 'opp') {
          // (He curves his run through the cover shadow — the line to the man's nearest pass — and only goes straight at
          // him for the last few metres: pressing cuts a pass off as it closes the man down.)
          const opt = this.agents.filter((a) => a.team === 'opp' && a !== o && !a.isKeeper).sort((p, q) => dist(p.pos, o.pos) - dist(q.pos, o.pos))[0]
          if (!opt || dist(this.hero.pos, o.pos) < PRESS_SHADOW_IN) return o.pos
          return add(o.pos, scale(norm(sub(opt.pos, o.pos)), PRESS_SHADOW))
        }
        return o ? null : interceptPoint(this.hero, this.aiWorld(), 1.5).point
      },
    }
  }

  /** RUSH (keeper): off the line at the ball / the man on it to smother or sweep. */
  private startRush(): void {
    this.stayUntil = -1
    // (Timed: the man within 10 m as he goes — charging out from further is the gamble, not the job.)
    const oc = this.owner
    if (oc && oc.team !== this.hero.team && dist(oc.pos, this.hero.pos) < 10) this.heroRushed = true
    this.dash = {
      why: 'rush',
      until: this.time + 1.2,
      to: () => {
        const o = this.owner
        if (o === this.hero) return null
        const b = { x: this.ball.x + this.ball.vx * 0.25, y: this.ball.y + this.ball.vy * 0.25 }
        return o ? add(o.pos, scale(norm(sub({ x: ownGoalX(this.hero.team), y: GOAL_CENTER_Y }, o.pos)), 0.6)) : b
      },
    }
  }

  /** DIVE: toward the shot's crossing point (Diving / Reflexes carry him), or a chosen side. */
  private keeperDive(side: Vec2 | null): void {
    const hero = this.hero
    if (!hero.isKeeper || this.owner === hero) return
    let dir = side
    if (!dir) {
      const plan = planSave(hero, this.aiWorld(), 0)
      const p = plan ? plan.point : { x: this.ball.x, y: this.ball.y }
      dir = Math.abs(p.y - hero.pos.y) > 0.3 ? norm(sub(p, hero.pos)) : { x: 0, y: this.ball.y >= hero.pos.y ? 1 : -1 }
    }
    this.stayUntil = -1
    this.keeperAction({ kind: 'dive', dir })
  }

  /** A context-button run in progress: where to go (null = done). */
  private dashMove(): Vec2 | null {
    const d = this.dash
    if (!d) return null
    if (this.time > d.until) {
      this.dash = null
      return null
    }
    const to = d.to()
    if (!to) {
      this.dash = null
      return null
    }
    const v = sub(to, this.hero.pos)
    const l = len(v)
    // Block / rush arrive and hold; the others run through.
    if (l < 0.25) return { x: 0, y: 0 }
    return scale(norm(v), d.why === 'block' || d.why === 'rush' ? Math.min(1, l / 1.2) : 1)
  }

  private winBall(tackler: Agent, from: Agent, slide: boolean): void {
    this.owner = null
    from.noTouch = 0.8
    if (slide) {
      const d = tackler.actionDir
      this.ball.vx = d.x * 8 + from.vel.x * 0.3
      this.ball.vy = d.y * 8 + from.vel.y * 0.3
      this.lastTouch = tackler
    } else {
      this.setOwner(tackler)
    }
    if (tackler.isHero) this.stats.tackles++
    this.events.push({ type: 'tackle', by: tackler.id, won: true, slide, x: tackler.pos.x, y: tackler.pos.y })
  }

  private heroFoul(on: Agent, slide: boolean, behind: boolean): void {
    const lastMan = !this.agents.some((a) => a.team === 'hero' && !a.isHero && !a.isKeeper && a.pos.x < on.pos.x)
    this.card = cardForFoul(this.rng, slide, behind, lastMan, this.refStrictness)
    // Ban length: denying an obvious chance as last man is one match, a reckless lunge from behind more.
    if (this.card === 'red') this.redReason = lastMan ? 'dogso' : 'serious'
    this.events.push({ type: 'foul', by: this.hero.id, on: on.id, card: this.card })
    this.finish('foul_committed', 'hero foul')
  }

  // ───────────────────────── Kicks & possession ─────────────────────────

  private kickBall(by: Agent, plan: KickPlan, kind: KickKind, power: number, passTo: string | null): void {
    if (this.owner && this.owner !== by) return
    // A first-time touch (volley, header, flick) is the receiver's first involvement.
    if (this.owner !== by && this.offsideCheck(by)) return
    // A long ball (lofted, crossed, cleared, or aimed beyond 25 m) is read against the passer's Long Passing.
    this.lastKickLong = kind === 'lofted' || kind === 'cross' || kind === 'clear' || Math.hypot(plan.aim.x - this.ball.x, plan.aim.y - this.ball.y) > 25
    // First-time finish/flick by a team-mate straight from the hero's delivery completes the pass.
    if (!by.isHero && by.team === 'hero' && this.owner !== by && this.lastTouch?.isHero && this.heroPassTo) {
      this.stats.passesCompleted++
      this.assistChain = by.id
      this.heroPassTo = null
    }
    // Pass telemetry: team-mate -> hero feeds (from) and hero -> team-mate deliveries (to).
    if (!by.isHero && by.team === 'hero' && passTo === this.hero.id) (this.passNet[by.id] ??= { to: 0, from: 0 }).from++
    // A team-mate's shot (or header) straight off the hero's delivery: a chance he created.
    if (SHOT_KINDS.has(kind) && !by.isHero && by.team === 'hero' && (this.lastTouch?.isHero || this.assistChain === by.id)) this.chance = true
    applyKick(this.ball, plan)
    this.setupCarrier = null
    if (this.ball.z < 0.01 && plan.vz > 0) this.ball.z = 0.02
    // Nobody reads a pass instantly: AI players keep their current plan for their reaction time.
    for (const a of this.agents) if (!a.isHero && a !== by && !a.isKeeper) a.think = Math.max(a.think, reactionTime(a, this.difficulty) * this.rng.range(0.85, 1.2))
    this.owner = null
    by.noTouch = 0.3
    by.touch = 0
    this.lastTouch = by
    this.lastPossTeam = by.team
    const spd = Math.hypot(plan.vx, plan.vy, plan.vz)
    this.events.push({ type: 'kick', by: by.id, hero: by.isHero, kick: kind, power, speed: spd, x: this.ball.x, y: this.ball.y })
    if (this.readPressedPass(by, kind, plan)) return
    // recovery_run / back_post: his job is judged when they get the shot (or header) away — back in the play, on his man.
    if ((this.kind === 'recovery_run' || this.kind === 'back_post') && by.team === 'opp' && SHOT_KINDS.has(kind) && this.dutySnap === null) this.dutySnap = this.onDuty()
    // Graded defending: was he in the shooting line, on his feet and close, as it was struck?
    if (SHOT_PRESS_KINDS.has(this.kind) && by.team === 'opp' && kind === 'shot' && this.blockLine === null) {
      // Close to the strike's path (he narrowed it: Positioning) — a shot that went wide of him clean is not forced.
      const h = this.hero
      const dir = norm(sub(plan.aim, by.pos))
      const rel = sub(h.pos, by.pos)
      const along = dot(rel, dir)
      const lateral = Math.abs(rel.x * dir.y - rel.y * dir.x)
      this.blockLine = h.state !== 'down' && this.time >= this.stumbleUntil && along > 0.3 && along < 4 && lateral < BLOCK_FORCED.base + BLOCK_FORCED.pos * a01(h.attrs.positioning)
    }
    if (kind === 'header') this.events.push({ type: 'header', by: by.id })

    const wasSetPiece = this.setPiece
    if (this.setPiece) {
      // Wall jumps, everyone is released.
      for (const id of this.setPiece.wall) {
        const w = this.agents.find((a) => a.id === id)
        if (w) {
          w.state = 'jump'
          w.stateT = 0
        }
      }
      this.setPiece = null
    }

    // A header he won and directed at goal: he beat his man in the air — a chance created.
    if (by.isHero && kind === 'header') this.chance = true
    if (by.isHero) {
      this.stopBullet()
      this.aim = null
      if (SHOT_KINDS.has(kind)) this.stats.shots++
      else this.stats.passes++
      this.heroPassTo = passTo ? { id: passTo, t: this.time } : SHOT_KINDS.has(kind) ? null : { id: '*', t: this.time }
      // Ball into space (2.1#111): the best-placed team-mate reads it at once and runs onto it.
      this.heroPassIntoSpace = this.heroPassTo?.id === '*'
      if (this.heroPassIntoSpace) {
        const runner = this.spaceRunner()
        if (runner) {
          this.heroPassTo = { id: runner.agent.id, t: this.time }
          // A ball into the box onto his run is attacked at once; one he has to check back or turn for (≥ 3 m off
          // where his run takes him) costs him a reaction — the delivery's accuracy (build 9, cross).
          const r = runner.agent
          const onRun = (kind !== 'cross' && kind !== 'lofted') || dist(plan.aim, add(r.pos, scale(r.vel, 0.6))) < CROSS_ON_RUN
          if (onRun) {
            r.think = 0
            r.intent = { kind: 'run', to: runner.point, until: this.time + 0.6, chase: true }
          } else r.think = Math.max(r.think, reactionTime(r, 1))
        }
      }
      if (this.heroPassTo && this.heroPassTo.id !== '*' && !SHOT_KINDS.has(kind)) (this.passNet[this.heroPassTo.id] ??= { to: 0, from: 0 }).to++
      this.oneTwo = passTo && (kind === 'pass' || kind === 'lofted') ? { id: passTo, t: this.time, armed: false, armedAt: -1 } : null
      this.heroDeliveryAt = SHOT_KINDS.has(kind) ? -1 : this.time
      // A ball into the box from the hero (cross / lofted / corner): its quality is his Crossing / Curve.
      // (The delivery as struck — his Crossing / Curve and how true he hit it: plan.quality carries the execution error.)
      this.heroCrossQ = kind === 'cross' || kind === 'lofted' ? clamp01(plan.quality) : 0
      // A quality ball away from the keeper makes him think twice about coming for it (his Crossing / Curve).
      // (A corner: an out-swinger curls away from him — he stays; an in-swinger curls onto him — he comes. Open play: a
      // ball to the penalty spot is no keeper's ball; one into the six-yard box is.)
      const swing = wasSetPiece?.kind === 'corner' && this.cornerChoice ? (this.cornerChoice.curl === 'out' ? (this.cornerChoice.zone === 'far' ? 1 : 0.4) : 0) : Math.abs(plan.aim.x - attackGoalX('hero')) >= 10.5 ? 1 : 0.2
      // His delivery (cross quality ×100) vs the keeper's GK Positioning, +1 % a point; a ball curling away / to the spot
      // up to 40 points more, one into his six-yard box less.
      const gkOpp = this.agents.find((q) => q.isKeeper && q.team !== by.team)
      this.keeperStays = this.heroCrossQ > 0 && this.rng.chance(eventChanceOf(this.heroCrossQ * 100, gkOpp?.attrs.gkPositioning ?? 62, (swing - 1) * 40 + 20))
      this.heroPassQuality = plan.quality
      this.heroLastKick = kind
      // Open play only: a corner is aimed at the zone from the flag, it needs a team-mate to win it.
      // (Build 9 owner: a cross counts when it reaches a team-mate — header won, touch in the box, a shot — not the zone alone.)
      this.crossWatch = false
      this.heroPassNamed = !!passTo
      this.heroKickY = this.ball.y
      this.heroHeaderAim = null
    }

    // The man the hero's pass is for expects it: he reacts on his own Anticipation, not the generic read.
    if (by.isHero && passTo && PASS_KINDS.has(kind)) {
      const r = this.agents.find((q) => q.id === passTo)
      // (A cross he has to check back or turn for — ≥ 3 m off where his run takes him — costs him a full reaction.)
      const offRun = r && (kind === 'cross' || kind === 'lofted') && dist(plan.aim, add(r.pos, scale(r.vel, 0.6))) >= CROSS_ON_RUN
      if (r && !r.isHero) r.think = offRun ? Math.max(r.think, reactionTime(r, 1)) : receiveReact(r.attrs.anticipation ?? r.attrs.positioning)
    }
    // Anticipation: a team-mate's ball toward the hero — he reads it and is away first.
    if (!by.isHero && by.team === 'hero' && PASS_KINDS.has(kind) && !this.hero.isKeeper) {
      const aim = { x: plan.aim.x, y: plan.aim.y }
      // (timed_run: a runner who timed his run on the line — Positioning — is in full stride as it is played.)
      if (dist(aim, this.hero.pos) < 14 || this.kind === 'timed_run') this.readBurstUntil = this.time + (this.kind === 'timed_run' ? 0.2 + 1.2 * a01(this.hero.attrs.positioning) : 0.7)
    }
    // ...and an opponent's pass he can cut out: the moment slows for a reader (bullet time scales with Anticipation).
    if (by.team === 'opp' && this.defending && PASS_KINDS.has(kind) && !this.hero.isKeeper && this.phase === 'live') {
      const from = { x: this.ball.x, y: this.ball.y }
      const to = { x: plan.aim.x, y: plan.aim.y }
      const lane = pointSegment(this.hero.pos, from, to)
      const antic = a01(this.hero.attrs.anticipation)
      if (lane.d < 4.5 && lane.t > 0.05) this.startBullet(0.45, 0.1 + 0.5 * antic)
      // He saw it coming: already moving into the lane as the ball is played (range and burst grow with Anticipation).
      if (lane.d < 0.5 + 3.5 * antic && lane.t > 0.1 && lane.t < 0.9 && this.hero.state === 'run') {
        const cut = { x: from.x + (to.x - from.x) * lane.t, y: from.y + (to.y - from.y) * lane.t }
        this.readCut = { to: cut, until: this.time + 0.25 + 0.6 * antic }
      }
    }
    // Offside positions are judged at the moment the ball is played (no offside from a corner).
    this.offsideSnap = null
    if (PASS_KINDS.has(kind) && wasSetPiece?.kind !== 'corner' && (by.team === 'hero' || this.defending)) {
      const ids = offsideSnapshot(this.agents, this.ball.x, by)
      // A forward timing his run on the line (Positioning) is level as it is played: within his read of it he is
      // given onside (the clever runner bends his run along the line).
      const line = by.team === 'hero' ? this.offsideLineX() : null
      if (line !== null && ids.has(this.hero.id) && this.hero.pos.x - line < RUN_ON_LINE * a01(this.hero.attrs.positioning)) ids.delete(this.hero.id)
      if (ids.size) this.offsideSnap = { team: by.team, ids }
    }

    if (SHOT_KINDS.has(kind) && by.team === 'opp' && this.defending && !isKeeperKind(this.kind)) this.oppShotFree = true
    // GK Positioning: a keeper who has read the striker is already stepping across as the shot is struck.
    if (SHOT_KINDS.has(kind) && by.team === 'opp' && this.hero.isKeeper && this.hero.state === 'run' && kind !== 'penalty') {
      const dir = Math.sign(plan.aim.y - this.hero.pos.y)
      const gap = Math.abs(plan.aim.y - this.hero.pos.y)
      if (gap > 0.3) this.hero.vel = { x: this.hero.vel.x, y: dir * Math.min(gap * 2, 1 + 5 * a01(this.hero.attrs.gkPositioning)) }
    }
    if (SHOT_KINDS.has(kind) && by.isHero) {
      // Settle the previous shot of the moment, then log this one.
      const prev = this.shotLog[this.shotLog.length - 1]
      if (prev && !prev.outcome && this.shot?.by.isHero) prev.outcome = this.shot.parried ? 'saved' : this.shot.blocked ? 'blocked' : this.shot.woodwork ? 'woodwork' : 'missed'
      const e: NonNullable<HighlightResult['shotLog']>[number] = { x: Math.round(this.ball.x * 10) / 10, y: Math.round(this.ball.y * 10) / 10 }
      if (kind === 'header') e.header = true
      // Keepers' book: which third of the goal the hero went for (from his aim).
      e.zone = goalZoneOf(plan.aim.y, GOAL_CENTER_Y)
      if (wasSetPiece?.kind === 'penalty') e.pen = true
      this.shotLog.push(e)
    }
    if (SHOT_KINDS.has(kind)) {
      if (by.team === 'opp') this.oppShotTaken = true
      this.shot = { by, kind, t: this.time, woodwork: false, blocked: false, parried: false, beaten: new Set(), assistBy: !by.isHero && this.assistChain === by.id ? this.hero.id : null, range: Math.hypot(attackGoalX(by.team) - this.ball.x, GOAL_CENTER_Y - this.ball.y) }
      {
        const gx = attackGoalX(by.team)
        const a1 = Math.atan2(GOAL_CENTER_Y - GOAL_WIDTH / 2 - this.ball.y, gx - this.ball.x)
        const a2 = Math.atan2(GOAL_CENTER_Y + GOAL_WIDTH / 2 - this.ball.y, gx - this.ball.x)
        this.shot.mouth = Math.abs(angleDiff(a1, a2))
      }
      const gk = this.agents.find((q) => q.isKeeper && q.team !== by.team)
      if (gk) this.shot.placedAim = Math.abs(plan.aim.y - gk.pos.y) >= PLACED_AIM
      // The hero in goal: set on his angle as it was struck (his textbook spot), or caught off it.
      if (gk?.isHero) this.shot.keeperSet = dist(gk.pos, keeperTarget(gk, this.aiWorld()).pos) < KEEPER_SET_R
      if (gk?.isHero && wasSetPiece?.kind === 'freekick') this.fkKeeperSet = !!this.shot.keeperSet
      const defTeam = other(by.team)
      const keeper = this.agents.find((a) => a.team === defTeam && a.isKeeper)
      if (keeper) {
        if (keeper.isHero) {
          // Reflex window for the hero keeper (penalties are a pure read — no slow motion).
          // A bigger wall screens the keeper: he sees the ball later (fk_wall).
          const screen = wasSetPiece?.kind === 'freekick' && by.team === 'opp' ? (wasSetPiece.wall.length - 3) * 0.1 : 0
          if (wasSetPiece?.kind !== 'penalty') this.startBullet(0.3, Math.max(0.2, 0.3 + a01(keeper.attrs.reflexes) * 0.55 - screen))
        } else {
          const isPen = wasSetPiece?.kind === 'penalty'
          let reaction = isPen ? 0.06 : keeperReaction(keeper, this.difficulty)
          // From a tight angle there is only so much goal to cover: he is set for it and quicker to it.
          if (!isPen && this.shot?.mouth !== undefined && this.shot.mouth < TIGHT_ANGLE) reaction *= 0.3 + 0.7 * (this.shot.mouth / TIGHT_ANGLE)
          // Moving the wrong way (shuffling across, still backpedalling): he has to stop first.
          if (!isPen) reaction += momentumDelay(keeper, plan.aim.y)
          // A free kick over the wall: he picks the ball up only as it clears the heads — the time it takes to get there
          // (FK_WALL_D at its pace), the more of it the bigger the wall.
          if (wasSetPiece?.kind === 'freekick' && wasSetPiece.wall.length >= 2) reaction += (FK_WALL_D / Math.max(10, Math.hypot(plan.vx, plan.vy))) * clamp01((wasSetPiece.wall.length - 1) / 4)
          // A keeper who knows the hero's favourite corner is quicker to it (open play).
          const shotHabit = by.isHero && !isPen ? bookHabit(this.highlight.keeperBook, false) : null
          if (shotHabit && goalZoneOf(plan.aim.y, GOAL_CENTER_Y) === shotHabit.zone) reaction *= 0.8
          let penaltyGuess: KeeperAlert['penaltyGuess']
          if (isPen) {
            // His GK Positioning vs the taker's Composure (+1 % a point); a blasted one (power > 0.9) 8 points harder to read.
            const pRead = eventChance('penaltyRead', keeper, by, (power > 0.9 ? -8 : 0) + (this.difficulty - 1) * 20)
            penaltyGuess = { read: this.rng.chance(pRead), centre: this.rng.chance(0.1) }
            // Did his homework: commits to the hero's habit (the surer the book, the likelier).
            const read = by.isHero ? this.keeperRead : null
            if (read && this.rng.chance(clampN(read.share * 0.85, 0, 0.9))) penaltyGuess.habit = read.zone
          }
          // Committed to the book: he goes as the ball is struck (no reaction delay).
          if (penaltyGuess?.habit !== undefined) reaction = 0
          // A penalty is one read and one dive; in open play he tracks the ball's real path once he has reacted.
          if (isPen) this.keeperAlert = { keeper, at: this.time + reaction, penaltyGuess }
          else this.gkReact = { keeper, at: this.time + reaction }
        }
      }
    } else {
      this.shot = null
    }

    if (kind === 'cross' || kind === 'lofted') this.planAttackingRuns(by)
    // Corner/cross toward the hero → header slow-mo armed.
    if ((kind === 'cross' || kind === 'lofted') && !by.isHero && by.team === 'hero') this.crossBulletArmed = true
    if (by.team === 'opp' && this.lastPossTeam === 'opp' && !this.defending) this.oppClearedAt = this.time
  }

  private setOwner(a: Agent): void {
    const prevOwner = this.owner
    // Graded defending: was the hero doing his job when his side won it back (judged then, not at the whistle)?
    if (this.defending && a.team === 'hero' && !a.isHero && this.lastTouch?.team === 'opp' && this.dutySnap === null) this.dutySnap = this.onDuty()
    if (a !== this.setupCarrier) this.setupCarrier = null
    this.lastTouchBefore = this.lastTouch
    this.owner = a
    this.ownerSince = this.time
    a.touch = 0.6
    this.lastTouch = a
    this.lastPossTeam = a.team
    this.ball.z = 0
    this.ball.vz = 0
    this.ball.spin.side = 0
    this.ball.spin.top = 0
    this.events.push({ type: 'touch', by: a.id, hero: a.isHero, x: a.pos.x, y: a.pos.y })
    if (a.isHero) this.heroControlled = true

    // Pass completion bookkeeping: a team-mate receiving the hero's pass may score → assist.
    // Plan 2.1#58: any team-mate receiving it counts (deflections included), not only the target.
    // His cross / corner / ball into the box met by a team-mate there, or a timed run received onside: a clear chance.
    if (this.heroPassTo && passCompletedBy(a) && (this.heroLastKick === 'cross' || this.heroLastKick === 'lofted') && a.pos.x > PITCH_LENGTH - 16.5 && Math.abs(a.pos.y - GOAL_CENTER_Y) < 20.2) this.chance = true
    if (a.isHero && this.kind === 'timed_run' && this.phase === 'live' && prevOwner === null && this.lastTouchBefore?.team === 'hero' && !this.lastTouchBefore.isHero) this.chance = true
    // (The hero's cross / corner controlled by a team-mate in the box — feetContact covers the loose touches.)
    if (!a.isHero && a.team === 'hero' && prevOwner === null && this.lastTouchBefore?.isHero && this.heroCrossQ > 0 && a.pos.x > PITCH_LENGTH - 16.5 && Math.abs(a.pos.y - GOAL_CENTER_Y) < 20.2) this.chance = true
    if (this.heroPassTo && passCompletedBy(a)) {
      this.stats.passesCompleted++
      this.assistChain = a.id
      // hold_up: the lay-off found a team-mate: job done.
      if (this.kind === 'hold_up' && this.phase === 'live') this.finish('pass_complete', 'laid off')
      // switch_play: the ball found a team-mate on the far side (build 9: a short ball to the nearest man is not a switch).
      if (this.kind === 'switch_play' && this.phase === 'live' && Math.abs(a.pos.y - this.heroKickY) >= 18) this.finish('pass_complete', 'switched')
    } else if (a.id !== this.assistChain) {
      this.assistChain = null
      if (a.team === 'hero' && !a.isHero && !a.isKeeper) this.heroDeliveryAt = -1
    }
    // Interceptions by the hero while defending count as successful defensive actions.
    if (a.isHero && this.defending && !a.isKeeper && prevOwner === null && this.lastTouchBefore?.team === 'opp') this.stats.tackles++
    this.heroPassTo = null
    if (a.team !== 'hero') this.heroRequest = null
    if (this.oneTwo && a.id !== this.oneTwo.id) this.oneTwo = null
    else if (this.oneTwo?.armed) a.think = Math.min(a.think, 0.02)

    // Shot ends when someone controls the ball (unless keeper hold handled elsewhere).
    if (!a.isKeeper) this.shot = null

    // Bullet time each time the hero gains possession.
    if (a.isHero && prevOwner !== a && !a.isKeeper && !this.setPiece && this.phase === 'live') this.startBullet(0.25, this.possessionWindow())
  }

  /** The outfield team-mate who gets to a ball played into space first, and where. */
  private spaceRunner(): { agent: Agent; point: Vec2 } | null {
    const w = this.aiWorld()
    let best: { agent: Agent; point: Vec2 } | null = null
    let bestT = Infinity
    for (const m of this.agents) {
      if (m.team !== 'hero' || m.isHero || m.isKeeper) continue
      const ip = interceptPoint(m, w, 3)
      const t = ip.reachable ? ip.t : 9 + dist(m.pos, ip.point) / 7
      if (t < bestT) {
        bestT = t
        best = { agent: m, point: ip.point }
      }
    }
    return best
  }

  /** The team-mate the hero's last pass is meant for (null once someone has it, or for a shot). */
  get passTargetId(): string | null {
    return this.heroPassTo && this.heroPassTo.id !== '*' ? this.heroPassTo.id : null
  }

  /** The loose ball is the hero's pass meant for `a` (a named team-mate). */
  /** Quality (0..1) of the hero's last pass (kick.planKick): how well weighted and placed it is for the receiver. */
  private heroPassQuality = 0.6
  /** The hero's last pass was played to a named man (not into space: a through ball is the runner's to attack). */
  private heroPassNamed = false

  private passMeantFor(a: Agent): boolean {
    return !a.isHero && a.team === 'hero' && !!this.heroPassTo && this.heroPassTo.id === a.id && !!this.lastTouch?.isHero
  }

  /** Receiving help the hero's last pass carries (see {@link RECEIVE}). */
  private receiveHelp(): number {
    return this.heroPassNamed ? receiveWeight(this.heroPassQuality) : throughWeight(this.heroPassQuality)
  }

  /**
   * Doing his job without the ball (graded defending): an outfielder goal-side of the ball within 8 m of it, a keeper
   * within 2 m of his textbook spot.
   */
  private onDuty(): boolean {
    const h = this.hero
    const b = { x: this.ball.x, y: this.ball.y }
    // A keeper did his job if he held his textbook spot or went for the ball (sweeping, coming for it).
    // (gk_sweep: the job is coming off the line for it — staying home is not doing it.)
    if (h.isKeeper && this.kind === 'gk_sweep') return dist(h.pos, b) < 6 || Math.abs(h.pos.x - ownGoalX(h.team)) > 9
    // (gk_1v1: the man comes at him whatever he does — being near the ball is not the job; coming out to meet him,
    // holding his angle or going the right way is.)
    if (h.isKeeper && this.kind === 'gk_1v1') return this.keeperRightWay || this.heroRushed || dist(h.pos, keeperTarget(h, this.aiWorld()).pos) < 1.5
    // (fk_wall: set on his angle as it was struck, or the right way — the ball dropping near him is not his doing.)
    if (h.isKeeper && this.kind === 'fk_wall') return this.keeperRightWay || this.fkKeeperSet
    if (h.isKeeper) return this.keeperRightWay || dist(h.pos, keeperTarget(h, this.aiWorld()).pos) < 1.5 || dist(h.pos, b) < 6
    const goal = { x: ownGoalX(h.team), y: GOAL_CENTER_Y }
    // (back_post: the job is his man at the far post — tight on him, or up contesting the header.)
    if (this.kind === 'back_post') return this.heroContested || this.agents.some((o) => o.team === 'opp' && !o.isKeeper && dist(o.pos, h.pos) < 2.5 && dist(o.pos, b) < 10)
    // (recovery_run: getting back into the play is the job — within RECOVERY_DUTY m and level or goal-side.)
    if (this.kind === 'recovery_run') return dist(h.pos, b) < RECOVERY_DUTY && dist(h.pos, goal) < dist(b, goal) + 4
    return dist(h.pos, b) < 8 && dist(h.pos, goal) < dist(b, goal) + 0.5
  }

  /** Team-mates' share of the defending in this moment (DEFEND_HELP, KEEPER_MOMENT_HELP). */
  private defendHelp(): number {
    return this.hero.isKeeper ? KEEPER_MOMENT_HELP : DEFEND_HELP
  }

  /** Distance (m) between the carrier and the ball at his feet. */
  private ballGap(o: Agent): number {
    return this.owner === o ? Math.hypot(this.ball.x - o.pos.x, this.ball.y - o.pos.y) : 0
  }

  /** 0..1 how exposed the carrier's ball is (1 = just after a touch, far from feet). */
  private exposure(o: Agent): number {
    const moving = len(o.vel) > 1.2
    return moving ? clamp01(1 - o.touch) * 0.8 + 0.2 : 0.3
  }

  // ───────────────────────── Movement ─────────────────────────

  private moveHero(): void {
    const hero = this.hero
    if (this.phase === 'intro' || this.phase === 'done') {
      hero.vel = scale(hero.vel, 0.85)
      return
    }
    if (hero.state === 'slide' || hero.state === 'dive' || hero.state === 'down' || hero.state === 'celebrate') return
    if (this.time < this.stumbleUntil) {
      hero.vel = scale(hero.vel, 0.85)
      return
    }
    const locked = (this.setPiece !== null && this.setPiece.takerId === hero.id) || hero.state === 'wall'
    if (locked || this.phase === 'post') {
      hero.vel = scale(hero.vel, 0.8)
      if (this.phase === 'post' && this.result?.outcome === 'goal') this.celebrate(hero)
      return
    }
    hero.sprint = this.control.sprint
    let mv = this.control.move
    // Assisted keeper auto-positioning when idle.
    if (hero.isKeeper && len(mv) < 0.1 && this.assist !== 'manual' && hero.state === 'run' && this.time >= this.stayUntil) {
      const tgt = keeperTarget(hero, this.aiWorld()).pos
      const v = arrive(hero, tgt, topSpeed(hero) * (this.assist === 'full' ? 0.7 : 0.4) * (0.6 + 0.8 * a01(hero.attrs.gkPositioning)), 1.5)
      mv = scale(v, 1 / Math.max(1, topSpeed(hero)))
    }
    // Coming for a cross: the keeper attacks the landing point (GK Positioning: how well he reads it) and goes up for it.
    if (hero.isKeeper && this.time < this.claimUntil && hero.state === 'run') {
      const land = this.crossLanding()
      if (land) {
        const v = arrive(hero, land.p, topSpeed({ ...hero, sprint: true }) * (0.7 + a01(hero.attrs.gkPositioning) * 0.6), 2.2)
        mv = scale(v, 1 / Math.max(1, topSpeed(hero)))
        hero.sprint = true
      }
      // Goes up as the ball arrives (where it will be a fifth of a second from now).
      const dz = this.ball.z + this.ball.vz * 0.2
      const ahead = { x: this.ball.x + this.ball.vx * 0.2, y: this.ball.y + this.ball.vy * 0.2 }
      if (dist(ahead, hero.pos) < 1.5 && dz > 1.3 && dz < 3.2 && hero.cd <= 0) {
        hero.state = 'jump'
        hero.stateT = 0
        hero.cd = 0.8
        this.claimUntil = -1
        this.events.push({ type: 'jump', by: hero.id })
        return
      }
    }
    // Anticipation: he read the pass — straight into the lane, flat out, while the ball is on its way.
    if (this.readCut && this.time < this.readCut.until && !this.owner && !hero.isKeeper) {
      const d = sub(this.readCut.to, hero.pos)
      if (len(d) > 0.3) {
        mv = norm(d)
        hero.sprint = true
      }
    } else this.readCut = null
    // Context buttons (game/actionSet): a challenge closing in, a run to a point, jockeying.
    if (this.engage) {
      const o = this.owner
      if (this.time > this.engage.until || hero.state !== 'run') this.engage = null
      else {
        // Pressed out of reach: he charges in and lunges on arrival (the further out he pressed, the worse it is timed).
        this.lunge = clamp01((this.engage.d0 - TACKLE_REACH) / LUNGE_SPAN)
        const went = this.tryEngage(this.engage.slide)
        this.lunge = 0
        if (went) {
          this.engage = null
          return
        }
        if (o && o.team !== 'opp') this.engage = null
        else {
          const to = o ? add(o.pos, scale(o.vel, 0.2)) : { x: this.ball.x, y: this.ball.y }
          mv = norm(sub(to, hero.pos))
          hero.sprint = true
        }
      }
    }
    if (!this.engage) {
      const dm = this.dashMove()
      // Pulling the stick the other way calls the run off.
      if (dm && len(this.control.move) > 0.4 && len(dm) > 0.1 && dot(norm(this.control.move), norm(dm)) < 0) this.dash = null
      else if (dm) {
        mv = dm
        hero.sprint = len(dm) > 0.6
        const o = this.owner
        // PRESS: flat out to him, but the last few metres only at a sprint while SPRINT is held — easing off arrives
        // under control (the charge in standingTackle times a flat-out arrival worse).
        if (this.dash?.why === 'press' && o && o.team === 'opp' && !this.control.sprint && dist(o.pos, hero.pos) < 3.5) hero.sprint = false
        // PRESS arriving: the carrier is hurried into his next decision (Aggression closes him down harder) and the
        // presser goes in for the ball (playtester build 9: PRESS used to stop at hurrying him, then ran through him).
        // Arriving flat out is the reckless part: the charge in standingTackle times it worse, an agile one less so.
        if (this.dash?.why === 'press' && o && o.team === 'opp' && dist(o.pos, hero.pos) < TACKLE_REACH) {
          o.think = Math.min(o.think, 0.04 + (1 - a01(hero.attrs.aggression ?? 50)) * 0.12)
          this.hurried = { id: o.id, until: this.time + 1.0 }
          this.dash = null
          this.pressOn = { id: o.id, since: this.time, until: this.time + PRESS_STICK }
        }
      }
    }
    // PRESS on him: stick tight and go in at the right moment (the ball off his foot), or after a beat.
    const po = this.pressOn
    if (po) {
      const c = this.owner
      if (this.time > po.until || !c || c.id !== po.id) this.pressOn = null
      else if (hero.state === 'run' && hero.cd <= 0 && hero.noTouch <= 0 && this.time >= this.stumbleUntil) {
        const d = dist(c.pos, hero.pos)
        if (d < TACKLE_REACH && (this.exposure(c) >= PRESS_GO_EXPOSED || this.time - po.since >= PRESS_GO_AFTER)) {
          this.pressOn = null
          this.standingTackle(c)
          return
        }
        // Tight on him, at his pace (the stick still steers; no stick = stay on him).
        if (len(this.control.move) < 0.2) mv = norm(sub(add(c.pos, scale(c.vel, 0.15)), hero.pos))
      }
    }
    const jo = this.owner
    if (this.control.hold === 'jockey' && jo && jo.team === 'opp' && hero.state === 'run' && dist(jo.pos, hero.pos) < JOCKEY_RANGE) {
      // Jockey: goal-side of the carrier at arm's length, feet quick, no lunging (Positioning).
      const spot = add(jo.pos, scale(norm(sub({ x: ownGoalX(hero.team), y: GOAL_CENTER_Y }, jo.pos)), 1.7))
      const v = sub(spot, hero.pos)
      mv = len(v) < 0.15 ? { x: 0, y: 0 } : scale(norm(v), Math.min(1, len(v) / 0.8))
      hero.sprint = dist(jo.pos, hero.pos) > 5 && this.control.sprint
      this.engage = null
      this.dash = null
    }
    if (this.jockeying()) this.jockeyT += DT
    else this.jockeyT = Math.max(0, this.jockeyT - DT * 2)
    // Shielding: slow, body between ball and man (Strength / Balance hold him off, see duels).
    if (this.shielding()) hero.sprint = false
    let max = topSpeed(hero)
    if (this.owner === hero) max *= dribblePace(hero.attrs.dribbling)
    if (this.jockeying()) max *= 0.86 + a01(hero.attrs.positioning) * 0.18
    if (this.control.hold === 'jockey' && jo && jo.team === 'opp') {
      // Backing off at his pace: a good positional defender keeps the distance (drains the tank if he must sprint).
      const need = len(jo.vel) * (0.92 + 0.12 * a01(hero.attrs.positioning))
      if (need > max) {
        hero.sprint = hero.stamina > 0.05
        max = Math.min(topSpeed(hero), need)
      }
    }
    if (this.shielding()) max *= 0.55
    // Positioning: with a team-mate on the ball, a clever forward holds the offside line instead of drifting past it.
    mv = this.holdTheLine(mv)
    if (hero.state === 'skill') {
      hero.vel = scale(hero.actionDir, topSpeed({ ...hero, sprint: true }) + 1.5)
      return
    }
    const desired = scale(len(mv) > 1 ? norm(mv) : mv, max)
    const dv = sub(desired, hero.vel)
    // Anticipation: when a team-mate releases the ball toward him, he is off the mark first.
    // (A keeper reads a ball over the top with his GK Positioning.)
    const burst = this.time < this.readBurstUntil ? 1 + 0.6 * a01(hero.isKeeper ? hero.attrs.gkPositioning : hero.attrs.anticipation) : 1
    const a = accel(hero) * burst * turnAccelMult(hero, desired) * (len(desired) < len(hero.vel) ? 1.6 : 1) * DT
    hero.vel = len(dv) <= a ? desired : add(hero.vel, scale(norm(dv), a))
    if (hero.sprint && len(mv) > 0.3) hero.stamina = Math.max(0, hero.stamina - DT * sprintDrain(hero.attrs.stamina, hero.attrs.workRate))
    else hero.stamina = Math.min(1, hero.stamina + DT * sprintRecover(hero.attrs.stamina, hero.attrs.workRate))
    if (hero.isKeeper) {
      // Stay in the box (sweeping a ball over the top he goes out to meet it, on his feet — no hands out there).
      const gx = ownGoalX(hero.team)
      const inward = attackDir(hero.team)
      const nx = hero.pos.x + hero.vel.x * DT
      const limit = this.kind === 'gk_sweep' ? SWEEP_RANGE : 16.5
      if ((nx - gx) * inward > limit || (nx - gx) * inward < -0.2) hero.vel.x = 0
    }
  }

  /**
   * Positioning (owner: off-ball run timing): while a team-mate has the ball, the hero's run toward goal is held
   * back at the offside line — fully at Positioning 100, not at all at 0 — so a clever forward stays level.
   */
  private holdTheLine(mv: Vec2): Vec2 {
    const hero = this.hero
    const o = this.owner
    // (Build 9: a sprinted run is his own timing — the aid holds a drifting forward, it does not brake a timed run.)
    if (!o || o.team !== 'hero' || o.isHero || this.defending || hero.isKeeper || this.control.sprint) return mv
    const line = this.offsideLineX()
    if (line === null) return mv
    // How far past the line he drifts before he checks his run: about 2 m at Positioning 0, level from 70 up.
    const pos = a01(hero.attrs.positioning)
    const limit = line - 0.25 + Math.max(0, 0.7 - pos) * 3
    // Caught upfield as the line steps up: a clever forward drops back onside.
    if (hero.pos.x > limit + 0.15) return { x: Math.min(mv.x, -0.9 * pos), y: mv.y }
    // Checks his run early enough to stop on the line (his momentum carries him on otherwise).
    return hero.pos.x + Math.max(0, hero.vel.x) * 0.3 >= limit && mv.x > 0 ? { x: 0, y: mv.y } : mv
  }

  /** x of the second-last opponent (the offside line for the hero's team), null in our own half. */
  private offsideLineX(): number | null {
    const xs = this.agents.filter((a) => a.team === 'opp').map((a) => a.pos.x).sort((a, b) => b - a)
    const line = xs.length >= 2 ? xs[1]! : xs[0]
    if (line === undefined) return null
    return Math.max(line, this.ball.x, PITCH_LENGTH / 2)
  }

  private celebrate(a: Agent): void {
    if (a.state !== 'celebrate') {
      a.state = 'celebrate'
      a.stateT = 0
    }
    const flag = { x: PITCH_LENGTH - 1, y: a.pos.y < GOAL_CENTER_Y ? 1 : PITCH_WIDTH - 1 }
    a.vel = arrive(a, flag, 6.5, 3)
  }

  /** AI decision + steering for non-hero agents. */
  private thinkAndSteer(a: Agent): void {
    if (a.state === 'slide' || a.state === 'dive' || a.state === 'down' || a.state === 'jump' || a.state === 'skill') return
    if (a.state === 'wall') {
      a.vel = { x: 0, y: 0 }
      return
    }
    if (this.phase === 'intro') {
      // Everyone settles during the intro, except a keeper already on the move (opening scenario).
      if (this.keeperScn?.keeper !== a) a.vel = scale(a.vel, 0.85)
      return
    }
    if (this.phase === 'post') {
      if (this.result && this.goalTime > 0) {
        const scorerTeam: Team = this.ball.x > PITCH_LENGTH / 2 ? 'hero' : 'opp'
        if (a.team === scorerTeam && !a.isKeeper && dist(a.pos, this.ball) < 30) {
          const lead = this.agents.find((q) => q.id === this.result?.scorerId) ?? this.hero
          a.vel = a === lead ? arrive(a, { x: PITCH_LENGTH - 1, y: a.pos.y < GOAL_CENTER_Y ? 1 : PITCH_WIDTH - 1 }, 6.5, 3) : arrive(a, lead.pos, 5.5, 2)
          if (a === lead && a.state !== 'celebrate') a.state = 'celebrate'
          return
        }
      }
      a.vel = scale(a.vel, 0.94)
      return
    }
    // Scripted set-piece takers are driven by setPieceAI().
    if (this.setPiece && this.setPiece.takerId === a.id) return

    // block: a set shooter sees a charge coming and answers it at once (the shift, decide()).
    if (this.kind === 'block' && this.owner === a && a.team === 'opp' && !this.blockShifted && this.blockCharge(a)) a.think = 0
    a.think -= DT
    if (a.think <= 0) {
      const vis = a01(a.attrs.vision)
      a.think = (a.isKeeper && this.owner && this.owner.team !== a.team ? 0.1 : clampN(0.34 - vis * 0.16, 0.12, 0.36)) * (a.team === 'opp' ? 1 / this.difficulty : 1 - 0.12 * this.lead)
      this.decide(a)
    }

    let target: Vec2 | null = null
    let speed = topSpeed(a) * 0.72
    const intent = a.intent
    if (intent?.kind === 'run') {
      target = intent.to
      if (dist(a.pos, target) > 7) speed = topSpeed({ ...a, sprint: true })
      // A keeper coming off his line to narrow the angle does it at full speed (and so does one going for a shot).
      if (a.isKeeper && this.owner && this.owner.team !== a.team && dist(a.pos, target) > 1.2) speed = topSpeed({ ...a, sprint: true })
      // (Going for a ball he has read: his shuffle across / back — keeperPhysics.keeperBurst, what his plan assumed.)
      if (a.isKeeper && this.gkReact?.keeper === a) speed = keeperBurst(a)
      if (a.isKeeper && this.keeperScnActive(a)) speed = this.keeperScn!.sc.speed
      // Showing for the hero: Work Rate is how hard he gets there (a jog at 40, a sprint at 90).
      if (intent.support) speed = topSpeed({ ...a, sprint: dist(a.pos, target) > 4 }) * (0.72 + 0.28 * a01(a.attrs.workRate ?? 50))
    } else if (intent?.kind === 'press') {
      target = pressTarget(a, this.aiWorld())
      a.sprint = true
      speed = topSpeed(a)
      a.sprint = false
    }
    // Bodies are solid (build 9 pressing fix): an opponent chasing the hero's ball does not run through him — when
    // his line to it crosses the hero's body he comes round on his own side, at the hero's shoulder.
    const hb = this.hero
    if (target && this.owner === hb && a.team !== hb.team && !a.isKeeper && dist(a.pos, hb.pos) < 3) {
      const seg = sub(target, a.pos)
      const l2 = dot(seg, seg)
      const t = l2 > 1e-6 ? clamp01(dot(sub(hb.pos, a.pos), seg) / l2) : 0
      const near = add(a.pos, scale(seg, t))
      if (t > 0 && t < 1 && dist(near, hb.pos) < BODY_GAP) {
        // (Same target, moved a body width to his side: arrive() keeps its lead on the ball.)
        const f = fromAngle(hb.facing)
        const side = (a.pos.x - hb.pos.x) * -f.y + (a.pos.y - hb.pos.y) * f.x >= 0 ? 1 : -1
        target = { x: target.x - f.y * side * BODY_GAP * 1.2, y: target.y + f.x * side * BODY_GAP * 1.2 }
      }
    }
    if (this.owner === a) {
      // A carrier running at a retreating defence attacks the space at pace.
      const chased = this.agents.some((o) => o.team !== a.team && !o.isKeeper && dist(o.pos, a.pos) < 6)
      // Same rule as the hero's (build 9): running with it costs a little pace (Dribbling), not a fifth of it —
      // a carrier the hero had missed used to be caught again at once.
      speed = chased || a.team === 'opp' ? topSpeed({ ...a, sprint: true }) * dribblePace(a.attrs.dribbling) * AI_CARRY_PACE : speed * 0.92
      // recovery_run: breaking alone, he looks up for support at cruising pace until the hero is on him (then he goes).
      if (this.kind === 'recovery_run' && a.team === 'opp' && dist(this.hero.pos, a.pos) > 4) speed = Math.min(speed, topSpeed({ ...a, sprint: false }) * dribblePace(a.attrs.dribbling))
      // Jockeyed (JOCKEY button): a set defender goal-side checks his run (the hero's Positioning).
      if (a.team === 'opp' && this.jockeying()) speed *= 0.84 - 0.12 * a01(this.hero.attrs.positioning)
    }
    // corner_kick: team-mates attack the zones the hero picked.
    const run = this.runs && this.time < this.runsUntil ? this.runs.get(a.id) : undefined
    if (run && this.owner === null && a.team === 'hero') {
      target = run
      speed = topSpeed({ ...a, sprint: this.time > this.cornerKickAt - 0.3 })
    }
    // Respect set-piece distance.
    if (this.setPiece && !a.isKeeper && target && dist(target, this.setPiece.spot) < 9.15 && a.id !== this.setPiece.takerId) {
      target = add(this.setPiece.spot, scale(norm(sub(target, this.setPiece.spot)), 9.3))
    }
    // The hero's pass receiver runs onto the ball at his own pace and attacks it (2.1#111).
    const chasing = intent?.kind === 'run' && intent.chase && !this.owner && a.team === 'hero' && this.heroPassIntoSpace && !!this.heroPassTo
    if (chasing) {
      speed = Math.max(speed, topSpeed(a))
      if (dist(a.pos, this.ball) < 2) target = { x: this.ball.x + this.ball.vx * 0.2, y: this.ball.y + this.ball.vy * 0.2 }
    }
    // The man the hero's pass is for meets it (playtester build 8): in its last few metres he attacks the ball
    // instead of easing up beside its line (he used to hover a metre in front of it, backing off at its pace).
    const meeting = !chasing && intent?.kind === 'run' && !this.owner && a.team === 'hero' && !!this.heroPassTo && this.heroPassTo.id === a.id && this.ball.z < 1.2
    if (meeting && dist(a.pos, this.ball) < 4.5) {
      // Across to the ball's line: the nearest point of its path still ahead of it (a step in front of the ball).
      const bv = norm({ x: this.ball.vx, y: this.ball.vy })
      const ahead = Math.max(0.3, (a.pos.x - this.ball.x) * bv.x + (a.pos.y - this.ball.y) * bv.y)
      target = { x: this.ball.x + bv.x * ahead, y: this.ball.y + bv.y * ahead }
    }
    // gk_sweep (2.1#85): their forward races the keeper for the ball over the top.
    if (this.kind === 'gk_sweep' && a.team === 'opp' && !a.isKeeper && !this.owner && intent?.kind === 'run') speed = topSpeed({ ...a, sprint: true })
    if (a.team === 'hero' && !a.isKeeper) speed *= 1 + 0.03 * this.lead
    // (A keeper going for a shot gets there set — he slows in time, he does not run through his spot.)
    let desired = target ? arrive(a, target, speed, chasing || meeting ? 0.4 : a.isKeeper ? (this.gkReact?.keeper === a ? 2.5 : 1.2) : 2.2) : { x: 0, y: 0 }
    desired = add(desired, scale(separation(a, this.agents), 2.2))
    const dv = sub(desired, a.vel)
    const acc = accel(a) * turnAccelMult(a, desired) * DT * (a.team === 'opp' ? this.difficulty : 1)
    a.vel = len(dv) <= acc ? desired : add(a.vel, scale(norm(dv), acc))
    // Sprint tank (Stamina / Work Rate, as the hero's): running above cruising pace drains it, easing off refills it.
    if (len(a.vel) > topSpeed({ ...a, sprint: false }) + 0.15) a.stamina = Math.max(0, a.stamina - DT * sprintDrain(a.attrs.stamina, a.attrs.workRate))
    else a.stamina = Math.min(1, a.stamina + DT * sprintRecover(a.attrs.stamina, a.attrs.workRate))
  }

  /** One AI think-tick for agent `a`. */
  private decide(a: Agent): void {
    const w = this.aiWorld()
    const ballP = { x: this.ball.x, y: this.ball.y }
    if (a.isKeeper) {
      if (this.owner === a) {
        a.intent = { kind: 'hold' }
        return
      }
      // Tracking a shot (keeperLogic): his reaction first, then the ball's path — not his positional spot.
      if (this.gkReact?.keeper === a) return
      // Opening scenario (rushing back, shuffling across, coming out, getting up): carry on until he reads it.
      if (this.keeperScnActive(a)) {
        a.intent = { kind: 'run', to: this.keeperScn!.sc.to, until: this.time + 1 }
        return
      }
      // Claim crosses.
      if (!this.owner && this.ball.z > 1 && this.ball.vz < 2) {
        const land = this.landingPoint()
        // (An in-swinging corner curls onto him: he comes for anything he can get to.)
        const inswing = this.kind === 'corner_kick' && this.cornerChoice?.curl === 'in' && a.team === 'opp' && this.lastTouch?.isHero
        if (land && (shouldClaimCross(a, land.p, land.t) || (inswing && dist(a.pos, land.p) < 10)) && !(this.keeperStays && a.team === 'opp' && this.lastTouch?.isHero)) {
          a.intent = { kind: 'run', to: land.p, until: this.time + 1 }
          return
        }
      }
      // Penalty: stay on the line (the ball sitting on the spot is not a loose ball to collect).
      if (this.setPiece?.kind === 'penalty' && !a.isHero) {
        // Tell-tale: a keeper who read the hero's habit cheats a step toward it.
        const read = a.team === 'opp' ? this.keeperRead : null
        const lean = read && read.zone !== 1 ? (read.zone === 0 ? -1 : 1) * KEEPER_LEAN * read.share : 0
        a.intent = { kind: 'run', to: { x: a.pos.x, y: GOAL_CENTER_Y + lean + Math.sin(this.time * 2.2) * 0.45 * (lean ? 0.5 : 1) }, until: this.time + 1 }
        return
      }
      // Loose slow ball in the box: collect.
      if (!this.owner && Math.abs(this.ball.x - ownGoalX(a.team)) < 15 && Math.abs(this.ball.y - GOAL_CENTER_Y) < 18 && Math.hypot(this.ball.vx, this.ball.vy) < 9) {
        a.intent = { kind: 'run', to: interceptPoint(a, w, 1.5).point, until: this.time + 1 }
        return
      }
      a.intent = { kind: 'run', to: keeperTarget(a, w).pos, until: this.time + 1 }
      return
    }

    if (this.owner === a) {
      this.carrierAct(a)
      return
    }

    // A keeper's moment (sweeping, 1v1, claiming): his outfielders leave the loose ball to him and track the runners.
    const keeperRace = !this.owner && a.team === 'hero' && this.hero.isKeeper && this.defending
    if (!this.owner && !keeperRace) {
      // Loose ball: best-placed player per team chases.
      const mates = this.agents.filter((q) => q.team === a.team && !q.isKeeper && !q.isHero)
      let bestId = ''
      let bestT = Infinity
      for (const m of mates) {
        const ip = interceptPoint(m, w, 2)
        const t = ip.reachable ? ip.t : 9 + dist(m.pos, ip.point) / 7
        if (t < bestT) {
          bestT = t
          bestId = m.id
        }
      }
      // Hero takes priority on own team if they're closest by distance.
      if (bestId === a.id) {
        const heroCloser = a.team === 'hero' && dist(this.hero.pos, ballP) + 1.5 < dist(a.pos, ballP) && !this.hero.isKeeper
        if (!heroCloser) {
          a.intent = { kind: 'run', to: interceptPoint(a, w, 2.2).point, until: this.time + 0.6, chase: a.team === 'hero' && this.heroPassIntoSpace }
          return
        }
      }
      // Pass target receiver keeps moving to the lead point.
      if (this.heroPassTo && this.heroPassTo.id === a.id) {
        a.intent = { kind: 'run', to: interceptPoint(a, w, 2.5).point, until: this.time + 0.6, chase: this.heroPassIntoSpace }
        return
      }
    }

    const possTeam = this.owner ? this.owner.team : this.lastPossTeam
    // The hero on the ball: the two nearest team-mates show for it, one either side of him.
    if (this.owner === this.hero && a.team === 'hero' && SUPPORT_KINDS.has(this.kind)) {
      const side = this.supportSide(a)
      if (side) {
        // Arrived and showing: he holds a spot that is still on (his side, 6–16 m off, open lane, onside), so the
        // ball can be played to a man standing still rather than one forever re-running his line.
        const cur = a.intent?.kind === 'run' && a.intent.support ? a.intent.to : null
        const line = this.offsideLineX()
        const opp = this.agents.filter((q) => q.team === 'opp' && !q.isKeeper).map((q) => q.pos)
        const d = cur ? dist(cur, this.hero.pos) : 0
        const keep = cur && (cur.y - this.hero.pos.y) * side >= 4 && d >= 6 && d <= 16 && (line === null || cur.x < line - 0.3) && laneOpenness(this.hero.pos, cur, opp) > 0.5
        a.intent = { kind: 'run', to: keep ? cur : heroSupportSpot(a, w, this.hero, side, this.rng), until: this.time + 1, support: true }
        return
      }
    }
    if (possTeam === a.team) {
      const near = dist(a.pos, ballP) < 35
      const runner = a.team === 'opp' && this.defending && near && (a.role === 'ST' || a.role === 'LW' || a.role === 'RW' || a.role === 'AM' || a.role === 'CM')
      a.intent = { kind: 'run', to: runner ? runTarget(a, w, this.owner, this.rng) : supportTarget(a, w, this.ballX0, this.rng), until: this.time + 1.5 }
      return
    }
    // Defending.
    if (!this.defendCache || this.defendCache.t !== this.time || this.defendCache.team !== a.team) {
      this.defendCache = { t: this.time, team: a.team, map: defendTargets(w, a.team, this.ballX0) }
    }
    const as = this.defendCache.map.get(a.id)
    if (as?.kind === 'press') a.intent = { kind: 'press', target: this.owner?.id ?? '' }
    else if (as?.kind === 'cover') a.intent = { kind: 'run', to: as.target, until: this.time + 1 }
    else a.intent = { kind: 'run', to: inField(a.anchor), until: this.time + 1 }
  }

  /**
   * Which side (if any) team-mate `a` shows on for the hero: the nearest outfield team-mate on each side of him
   * (within 30 m). Null for everyone else.
   */
  private supportSide(a: Agent): -1 | 1 | null {
    const h = this.hero
    let l: Agent | null = null
    let r: Agent | null = null
    for (const m of this.agents) {
      if (m.team !== 'hero' || m.isHero || m.isKeeper || dist(m.pos, h.pos) > 30) continue
      // A runner already in their box stays there (the cross / cut-back target), and a man well ahead of the
      // ball keeps running in behind (the through-ball target): support comes from level or behind.
      if (m.pos.x > PITCH_LENGTH - 16.5 && Math.abs(m.pos.y - GOAL_CENTER_Y) < 20) continue
      if (m.pos.x > h.pos.x + 6) continue
      if (m.pos.y < h.pos.y) {
        if (!l || dist(m.pos, h.pos) < dist(l.pos, h.pos)) l = m
      } else if (!r || dist(m.pos, h.pos) < dist(r.pos, h.pos)) r = m
    }
    return a === l ? -1 : a === r ? 1 : null
  }

  /** AI ball carrier executes a decision. */
  private carrierAct(a: Agent): void {
    const w = this.aiWorld()
    const heldFor = this.time - this.ownerSince
    // One-two requested: first-time return into the hero's run.
    // Passing ≥ 55 plays it first time (plan 2.1#59); a weaker passer needs a touch to set it.
    if (a.team === 'hero' && this.oneTwo?.armed && this.oneTwo.id === a.id) {
      if (oneTouchReturn(a.attrs.passing) || heldFor > ONE_TWO_SET_TOUCH) this.playOneTwo(a)
      return
    }
    // header (2.1#67, #119): the wide team-mate whips it in for the hero's run.
    // (Build 9: he waits for it — the generic carrier used to cut it back along the floor before the script fired.)
    if (this.kind === 'header' && a.team === 'hero') {
      if (heldFor > 0.55) return this.crossFor(a, this.hero, 1.9)
      a.intent = { kind: 'run', to: { x: a.pos.x + 0.8, y: a.pos.y }, until: this.time + 0.2 }
      return
    }
    // back_post (2.1#124): their winger crosses for the runner arriving at the far post.
    if (this.kind === 'back_post' && a.team === 'opp' && heldFor > 0.6) {
      const runner = this.agents
        .filter((q) => q.team === 'opp' && q !== a && !q.isKeeper && q.pos.x < 18)
        .sort((p, q) => Math.abs(q.pos.y - a.pos.y) - Math.abs(p.pos.y - a.pos.y))[0]
      if (runner) return this.crossFor(a, runner, 1.8)
    }
    // gk_claim: their winger whips it into our six-yard box.
    if (this.kind === 'gk_claim' && a.team === 'opp' && heldFor > 0.6) {
      const target = { x: this.rng.range(4, 7), y: GOAL_CENTER_Y + this.rng.range(-3.5, 3.5) }
      const plan = planKick({ kind: 'cross', from: { x: this.ball.x, y: this.ball.y }, target, targetZ: this.rng.range(2.4, 2.8), power: 0.7, curl: 0.4 * Math.sign(GOAL_CENTER_Y - a.pos.y), attrs: a.attrs, pressure: 0, assist: 'manual', env: this.env, noiseScale: 0.8 }, this.rng)
      return this.kickBall(a, plan, 'cross', 0.7, null)
    }
    // timed_run: the passer waits for the hero's run (or plays it anyway after a while).
    const timedRun = this.kind === 'timed_run' && a.team === 'hero' && !a.isHero
    // Hero called for the ball.
    if (a.team === 'hero' && this.heroRequest && this.time - this.heroRequest.t < 1.6 && heldFor > (this.heroRequest.explicit ? 0.05 : 0.2)) {
      const req = this.heroRequest
      this.heroRequest = null
      const heroC = { id: this.hero.id, pos: this.hero.pos, vel: this.hero.vel }
      // timed_run: always in behind the line, into the space ahead of his run.
      if (timedRun) return this.playInBehind(a)
      const target = req.at ? inField(req.at, 1) : leadPosition(a.pos, heroC, 13)
      const lane = laneOpenness({ x: this.ball.x, y: this.ball.y }, target, this.agents.filter((q) => q.team === 'opp').map((q) => q.pos))
      // A leader's call is answered more often (Leadership, more as captain).
      // His Vision (+1 % a point); the relationship ±30 points, the hero's Leadership up to +20, a shut lane −40.
      if (!this.rng.chance(eventChance('call', a, undefined, (a.relationToHero / 100) * 30 + 20 * this.lead - (lane < CALL_LANE_MIN ? 40 : 0)))) {
        this.events.push({ type: 'callRefused', by: a.id, reason: lane < CALL_LANE_MIN ? 'lane' : 'relation' })
      } else {
        const lofted = dist(a.pos, target) > 26
        const plan = planKick({ kind: lofted ? 'lofted' : 'pass', from: { x: this.ball.x, y: this.ball.y }, target, power: 0.6, curl: 0, attrs: a.attrs, pressure: this.pressureOn(a), assist: 'manual', env: this.env, noiseScale: 0.9, fromHands: a.isKeeper }, this.rng)
        this.kickBall(a, plan, lofted ? 'lofted' : 'pass', 0.6, null)
        return
      }
    }
    if (timedRun) {
      if (heldFor > 4) return this.playInBehind(a)
      // Head up, ball at his feet, waiting for the run.
      a.intent = { kind: 'run', to: { x: a.pos.x + 0.6, y: a.pos.y }, until: this.time + 0.3 }
      return
    }
    // interception: the carrier looks up and plays the runner in (the moment is about reading that pass).
    // Shooting wait for drama in keeper moments; in gk_save the attacker always pulls the trigger.
    // block: the shooter on the edge of the box shapes, then always pulls the trigger.
    const blockShooter = this.kind === 'block' && a.team === 'opp'
    // block: a composed shooter strikes as the angle opens; a nervous one dithers over the extra touch (Composure) —
    // time the man in front of him uses to get set.
    if (blockShooter && !this.blockWindUpSet) {
      this.blockWindUpSet = true
      this.blockWindUp *= BLOCK_WINDUP.base + BLOCK_WINDUP.composure * a01(a.attrs.composure)
    }
    const minHold = this.kind === 'gk_save' || blockShooter ? 0.7 : 0.3
    // Tactical carrier: opponents everywhere (except the scripted gk moments), team-mates in the
    // final third away from the flanks (wide areas keep the crossing logic).
    const toGoal = dist(a.pos, { x: attackDir(a.team) > 0 ? PITCH_LENGTH : 0, y: GOAL_CENTER_Y })
    const wide = a.pos.y < 14 || a.pos.y > PITCH_WIDTH - 14
    const smart = blockShooter ? false : a.team === 'opp' ? true : toGoal < 30 && !wide
    if (smart && this.smartCarrier(a, heldFor, minHold)) return
    // block (build 9): a defender who charges or dives in at a set shooter gets sold the shift — he drags it inside
    // and strikes past him (the shooter's Dribbling against the defender's Agility). One who stays on his feet in the
    // line is not.
    if (blockShooter && !this.blockShifted && !this.hero.isKeeper) {
      const h = this.hero
      const charging = this.blockCharge(a)
      // (A set blocker in the line is shifted less often: he reads the touch — Anticipation.)
      const set = !charging && heldFor > 0.5 && dist(h.pos, a.pos) < 2.6
      if (dist(h.pos, a.pos) < 3.2 && (charging || set)) {
        this.blockShifted = true
        // His Dribbling vs the hero's Agility (charging: +20, sold on the run) or his Anticipation (set in the line, −15:
        // he reads the touch), +1 % a point; the difficulty sharpens him.
        const p = charging ? eventChance('shift', a, h, 20 + (this.difficulty - 1) * 20) : eventChanceOf(a.attrs.dribbling, h.attrs.anticipation, -15 + (this.difficulty - 1) * 20)
        if (this.rng.chance(p)) {
          const side = a.pos.y >= h.pos.y ? 1 : -1
          a.intent = { kind: 'run', to: inField(add(a.pos, { x: -0.4, y: side * 1.8 }), 1), until: this.time + 0.35 }
          h.noTouch = Math.max(h.noTouch, charging ? 0.75 : 0.35)
          this.blockWindUp = Math.min(this.blockWindUp, heldFor + 0.35)
          return
        }
      }
    }
    let dec = carrierDecision(a, w, this.rng, { heldFor })
    if ((this.kind === 'gk_save' || (blockShooter && heldFor > this.blockWindUp)) && a.team === 'opp' && heldFor > 0.9 && dec.kind !== 'shoot') {
      // A better finisher picks his corner (build 9: the opposition's own Finishing — the save follows it).
      dec = { kind: 'shoot', target: { x: -0.2, y: GOAL_CENTER_Y + (this.rng.chance(0.5) ? 1 : -1) * this.rng.range(Math.min(3.0, 0.3 + 2.8 * a01(a.attrs.finishing)), 3.2) } }
    } else if (blockShooter && heldFor <= this.blockWindUp) {
      // Setting himself: a short touch to open the angle, then the strike.
      const dir = norm({ x: -0.8, y: a.pos.y > GOAL_CENTER_Y ? -0.35 : 0.35 })
      a.intent = { kind: 'run', to: inField(add(a.pos, scale(dir, 1.2)), 1), until: this.time + 0.3 }
      return
    }
    const from = { x: this.ball.x, y: this.ball.y }
    const base = { from, attrs: a.attrs, pressure: this.pressureOn(a), assist: 'manual' as AimAssist, env: this.env, fromHands: a.isKeeper }
    const oppNoise = a.team === 'opp' ? (1.15 / this.difficulty) * aiFinishNoise(a.attrs.finishing) : this.mateNoise()
    switch (dec.kind) {
      case 'shoot': {
        if (heldFor < minHold) break
        // (A forced strike — gk_save / block — is hit as hard as his Shot Power allows.)
        const forced = this.kind === 'gk_save' || blockShooter
        const power = forced ? this.rng.range(0.62 + 0.3 * a01(a.attrs.shooting), 0.8 + 0.18 * a01(a.attrs.shooting)) : this.rng.range(0.72, 0.95)
        const tgt = { ...dec.target }
        this.roundTheBody(a, tgt)
        const plan = planKick({ ...base, kind: 'shot', target: tgt, power, curl: this.rng.range(-0.35, 0.35), noiseScale: oppNoise }, this.rng)
        this.kickBall(a, plan, 'shot', power, null)
        return
      }
      case 'pass': {
        // Role hooks (ai.carrierDecision): into the space behind for a runner, a high ball for a pivot.
        const target = dec.through
          ? inField(add(leadPosition(a.pos, dec.to, 20), { x: attackDir(a.team) * 4, y: 0 }), 1)
          : leadPosition(a.pos, dec.to, dec.lofted ? 17 : 13)
        const kind: KickKind = dec.through ? (dec.lofted ? 'lofted' : 'through') : dec.lofted ? 'lofted' : 'pass'
        const plan = planKick({ ...base, kind, target, ...(dec.high ? { targetZ: 1.7 } : {}), power: 0.55, curl: 0, noiseScale: oppNoise }, this.rng)
        this.kickBall(a, plan, kind, 0.55, null)
        return
      }
      case 'cross': {
        const zone = this.pickCrossZone(a)
        if (zone.ground) {
          const plan = planKick({ ...base, kind: 'through', target: zone.point, power: 0.7, curl: 0, noiseScale: oppNoise }, this.rng)
          this.kickBall(a, plan, 'through', 0.7, null)
          return
        }
        const plan = planKick({ ...base, kind: 'cross', target: zone.point, targetZ: zone.z, power: 0.7, curl: 0.3 * Math.sign(GOAL_CENTER_Y - a.pos.y), noiseScale: oppNoise }, this.rng)
        this.kickBall(a, plan, 'cross', 0.7, null)
        return
      }
      case 'dribble':
        break
    }
    const dir = dec.kind === 'dribble' ? dec.dir : norm(sub({ x: attackDir(a.team) > 0 ? PITCH_LENGTH : 0, y: GOAL_CENTER_Y }, a.pos))
    a.intent = { kind: 'run', to: inField(add(a.pos, scale(dir, 5)), 1), until: this.time + 0.5 }
  }

  /**
   * Opponent carrier with tactical reasoning (see tactics.ts): values shooting,
   * every pass (time race against defenders), taking on the defender in front
   * and dribbling into space, and acts on the best. Returns false to fall back.
   */
  private smartCarrier(a: Agent, heldFor: number, minHold: number): boolean {
    const w = this.aiWorld()
    const noise = clampN(0.35 - a01(a.attrs.vision) * 0.25, 0.05, 0.35) / (a.team === 'opp' ? this.difficulty : 1)
    const heroBias = a.team === 'hero' ? 0.02 + (a.relationToHero / 100) * 0.04 + a01(a.attrs.vision) * 0.02 : 0
    // In a keeper moment the striker is set on shooting: he only picks his moment and corner.
    const shotBias = this.kind === 'gk_save' ? 0.6 + heldFor * 0.6 : 0
    const dec = evaluateCarrier(a, w, this.rng, { heldFor, noise, heroBias, shotBias })
    const from = { x: this.ball.x, y: this.ball.y }
    const base = { from, attrs: a.attrs, pressure: this.pressureOn(a), assist: 'manual' as AimAssist, env: this.env, fromHands: a.isKeeper }
    const oppNoise = a.team === 'opp' ? (1.15 / this.difficulty) * aiFinishNoise(a.attrs.finishing) : this.mateNoise()
    switch (dec.kind) {
      case 'shoot': {
        // Only pull the trigger on a real chance (or when time is up / swamped).
        const late = this.time > this.timeLimit - 2.5 || (this.kind === 'gk_save' && heldFor > 1.4)
        if (heldFor < minHold || (dec.value < 0.13 && !late && heldFor < 2.6)) break
        // (In a keeper moment the strike is as hard as his Shot Power allows.)
        const sp = a01(a.attrs.shooting)
        const power = isKeeperKind(this.kind) && a.team === 'opp' ? this.rng.range(0.62 + 0.3 * sp, 0.8 + 0.18 * sp) : this.rng.range(0.72, 0.95)
        // A better finisher picks his corner (build 9: the shot follows his own Finishing).
        const gy = GOAL_CENTER_Y
        const off = dec.target.y - gy
        const tgt = { x: dec.target.x, y: gy + (Math.sign(off) || 1) * clampN(Math.max(Math.abs(off), Math.min(3.0, 0.3 + 2.8 * a01(a.attrs.finishing))), 0, 3.2) }
        this.roundTheBody(a, tgt)
        const plan = planKick({ ...base, kind: 'shot', target: tgt, power, curl: this.rng.range(-0.35, 0.35), noiseScale: oppNoise }, this.rng)
        this.kickBall(a, plan, 'shot', power, null)
        return true
      }
      case 'pass': {
        if (heldFor < 0.35) break
        // Lead the runner as evaluated (half a second ahead), never past his reach into the keeper.
        const target = passLead(a.pos, dec.to, dec.lofted)
        const kind: KickKind = dec.lofted ? 'lofted' : 'pass'
        const power = 0.55 + clamp01(dist(a.pos, target) / 40) * 0.25
        const plan = planKick({ ...base, kind, target, power, curl: 0, noiseScale: oppNoise }, this.rng)
        this.kickBall(a, plan, kind, power, null)
        return true
      }
      case 'takeOn': {
        if (a.cd > 0 || heldFor < 0.25) break
        this.aiTakeOn(a, dec.defender)
        return true
      }
      case 'dribble': {
        a.intent = { kind: 'run', to: inField(add(a.pos, scale(dec.dir, 5)), 1), until: this.time + 0.4 }
        return true
      }
      default:
        break
    }
    // Waiting for the right moment: keep the ball moving toward goal, shielding from the nearest defender.
    const toGoal = norm(sub({ x: attackDir(a.team) > 0 ? PITCH_LENGTH : 0, y: GOAL_CENTER_Y }, a.pos))
    a.intent = { kind: 'run', to: inField(add(a.pos, scale(toGoal, 3)), 1), until: this.time + 0.3 }
    return true
  }

  /**
   * AI crosser's choice of delivery zone: the zone a team-mate (the hero
   * weighted by relationship) can attack first relative to his marker, with
   * the cut-back when the box is crowded and a runner arrives late.
   */
  private pickCrossZone(a: Agent): CrossZone {
    const zones = crossZones(a.pos.y, attackDir(a.team) > 0 ? PITCH_LENGTH : 0)
    const mates = this.agents.filter((m) => m.team === a.team && m !== a && !m.isKeeper)
    const opps = this.agents.filter((m) => m.team !== a.team && !m.isKeeper)
    let best = zones[2]
    let bestV = -Infinity
    for (const z of zones) {
      let v = -Infinity
      for (const m of mates) {
        const tm = dist(m.pos, z.point) / topSpeed({ ...m, sprint: true })
        const td = Math.min(...opps.map((o) => dist(o.pos, z.point) / topSpeed({ ...o, sprint: true }) + reactionTime(o, this.difficulty)))
        let s = (td - tm) + (m.isHero ? 0.3 + m.relationToHero / 250 : 0) + a01(m.attrs.heading) * (z.ground ? 0 : 0.3)
        if (z.ground) s += a01(m.attrs.shooting) * 0.3 - 0.15
        v = Math.max(v, s)
      }
      v += this.rng.range(-0.25, 0.25)
      if (v > bestV) {
        bestV = v
        best = z
      }
    }
    return best!
  }

  /**
   * Attacking the cross: each attacker of the delivering team near the
   * landing area picks the point on the ball's flight (header height) he can
   * reach in time and runs to arrive with the ball, not before it.
   */
  private planAttackingRuns(by: Agent): void {
    const pts = predictTrajectory(this.ball, this.env, { duration: 2.6, sampleEvery: 2 })
    const window = pts.filter((p) => p.z > 1.2 && p.z < 2.4 && p.t > 0.25)
    const low = pts.filter((p) => p.z <= 1.2 && p.t > 0.25)
    const cand = window.length ? window : low.slice(0, 6)
    if (!cand.length) return
    const runners = this.agents.filter((m) => m.team === by.team && m !== by && !m.isKeeper && !m.isHero && dist(m.pos, cand[0]!) < 20)
    for (const m of runners) {
      let best: { x: number; y: number; t: number } | null = null
      for (const p of cand) {
        const need = Math.max(0, dist(m.pos, p) - 0.4) / topSpeed({ ...m, sprint: true }) + 0.12
        if (need <= p.t + 0.05) {
          best = p
          break
        }
      }
      if (best) {
        m.intent = { kind: 'run', to: { x: best.x, y: best.y }, until: this.time + best.t + 0.4 }
        m.think = Math.max(m.think, Math.min(best.t, 1.2))
      }
    }
  }

  /**
   * An AI shooter with the hero standing in his line (within BODY_IN_LINE m, on his feet): bending it round him is his
   * Finishing vs the hero's Positioning (+1 % a point) — he moves his target off the body; otherwise he strikes it as
   * he meant to, body or not. Mutates `tgt` (goal-line point).
   */
  private roundTheBody(a: Agent, tgt: Vec2): void {
    const h = this.hero
    if (a.team !== 'opp' || h.isKeeper || h.state !== 'run' || dist(h.pos, a.pos) > BODY_IN_LINE) return
    const line = norm(sub(tgt, a.pos))
    const rel = sub(h.pos, a.pos)
    const along = dot(rel, line)
    const across = rel.x * line.y - rel.y * line.x
    if (along < 0.4 || Math.abs(across) > 1.2) return
    if (!this.rng.chance(eventChanceOf(a.attrs.finishing, h.attrs.positioning, 0))) return
    // Round the body: of the two corners, the one whose line passes furthest from him.
    const clear = (y: number): number => {
      const l = norm(sub({ x: tgt.x, y }, a.pos))
      const r = sub(h.pos, a.pos)
      return dot(r, l) < 0 ? 9 : Math.abs(r.x * l.y - r.y * l.x)
    }
    const lo = GOAL_CENTER_Y - 2.9
    const hi = GOAL_CENTER_Y + 2.9
    tgt.y = clear(lo) >= clear(hi) ? lo : hi
  }

  /** AI carrier tries to beat the defender in front (skill move / change of pace). */
  private aiTakeOn(a: Agent, def: Agent): void {
    a.cd = 1.1
    // Owner, build 9: his Dribbling vs the man's Tackling (a keeper: his GK Positioning), +1 % a point; one goal-side of
    // him is harder to get past (up to −15); the difficulty sharpens the opposition's dribblers. (Build 9 all-✅ pass: a
    // defender rushing in pays for it once — sold, he stumbles and has to turn (below) — no longer also +20 on the roll;
    // a keeper charging off his line is the gamble a 1v1 is about: rounded more easily, up to +20.)
    const toA = norm(sub(a.pos, def.pos))
    const rush = def.isKeeper ? clamp01((def.vel.x * toA.x + def.vel.y * toA.y - 1) / 4) : 0
    // (A set defender — the hero holding JOCKEY on him — is hard to sell: −15.)
    const set = def.isHero && this.jockeying() ? 15 : 0
    const mod = rush * 20 - goalSideness(def, a) * 15 - set + (a.team === 'opp' ? (this.difficulty - 1) * 20 : 0)
    if (this.rng.chance(eventChanceOf(a.attrs.dribbling, def.isKeeper ? def.attrs.gkPositioning : def.attrs.tackling, mod))) {
      const side = angleDiff(Math.atan2(def.pos.y - a.pos.y, def.pos.x - a.pos.x), a.facing) > 0 ? -1 : 1
      a.state = 'skill'
      a.stateT = 0
      a.actionDir = fromAngle(a.facing + side * 0.55)
      def.noTouch = 0.9
      if (!def.isHero) {
        def.state = 'down'
        def.stateT = 0
      } else {
        // The hero is wrong-footed: a committed (rushing) defender is sold and needs a moment to turn.
        const toA = norm(sub(a.pos, def.pos))
        const closing = def.vel.x * toA.x + def.vel.y * toA.y
        def.cd = Math.max(def.cd, 0.5)
        // A set jockey (JOCKEY held) is never sold like that; a rushing one stumbles and has to stop and turn
        // (on his feet: TestFlight 6, sprinting at a dribbler used to dump the hero on the floor).
        // Build 9: an agile defender can come in quicker without being sold, and a quick one is back on him sooner
        // (being fast used to be punished: the quicker hero arrived at speed and was sold every time).
        const sold = closing > 2.5 + 2.5 * a01(def.attrs.agility) && !this.jockeying()
        def.vel = scale(def.vel, sold ? 0.15 : 0.45)
        if (sold) this.stumbleUntil = this.time + (KEEPER_GETUP - 0.1) * (1.25 - 0.5 * a01(def.attrs.acceleration ?? def.attrs.pace))
      }
      this.events.push({ type: 'skill', by: a.id, success: true })
    } else {
      // Read and blocked: the ball comes back off the defender's legs (physics: it hits him and rebounds).
      this.owner = null
      const d = norm(sub(a.pos, def.pos))
      const sp = 3.5
      this.ball.vx = d.x * sp
      this.ball.vy = d.y * sp
      a.noTouch = 0.35
      this.lastTouch = def
      this.events.push({ type: 'skill', by: a.id, success: false })
      this.events.push({ type: 'touch', by: def.id, hero: def.isHero, x: def.pos.x, y: def.pos.y })
    }
  }

  /** Scripted set-piece takers (corner delivery, opposition penalty). */
  private setPieceAI(): void {
    const sp = this.setPiece
    if (!sp) return
    const taker = this.agents.find((a) => a.id === sp.takerId)
    if (!taker) return
    if (taker.isHero) {
      // corner_kick: strike the delivery the hero picked.
      const c = this.cornerChoice
      if (sp.kind !== 'corner' || !c || this.time < this.cornerKickAt) return
      const k = cornerKick(c, sp.spot)
      const short = c.zone === 'short' ? this.shortOption() : null
      const target = cornerZoneTarget(c.zone, sp.spot, short?.pos ?? null)
      const plan = planKick({ kind: k.kind, from: sp.spot, target, targetZ: k.kind === 'cross' ? k.targetZ : undefined, power: k.power, curl: k.curl, attrs: taker.attrs, pressure: 0, assist: this.assist, env: this.env }, this.rng)
      this.ball.x = sp.spot.x
      this.ball.y = sp.spot.y
      this.kickBall(taker, plan, k.kind, k.power, short?.id ?? null)
      return
    }
    if (sp.kind === 'freekick' && this.kind === 'fk_wall') {
      if (this.fkKickAt < 0 || this.time < this.fkKickAt) return
      const keeper = this.agents.find((a) => a.team === 'hero' && a.isKeeper)
      const wall = sp.wall.map((id) => this.agents.find((a) => a.id === id)).filter((a): a is Agent => !!a).map((a) => a.pos)
      const skill = a01(taker.attrs.setPieces) * 0.7 + a01(taker.attrs.shooting) * 0.3
      const runners = this.agents.filter((a) => a.team === 'opp' && !a.isKeeper && a !== taker).map((a) => ({ id: a.id, pos: a.pos }))
      const markers = this.agents.filter((a) => a.team === 'hero' && !a.isKeeper && a.state !== 'wall').map((a) => a.pos)
      const shot = chooseFkShot({ spot: sp.spot, wall, keeper: keeper?.pos ?? null, skill, runners, markers }, this.rng)
      this.fkShot = shot.label
      const kind: KickKind = shot.label === 'cross' ? 'cross' : 'freekick'
      const plan = planKick({ kind, from: sp.spot, target: shot.target, targetZ: shot.z, power: shot.power, curl: shot.curl, attrs: taker.attrs, pressure: 0, assist: 'manual', env: this.env, noiseScale: (FK_AGAINST_NOISE / this.difficulty) * aiFinishNoise(taker.attrs.setPieces) }, this.rng)
      this.ball.x = sp.spot.x
      this.ball.y = sp.spot.y
      this.kickBall(taker, plan, kind, shot.power, shot.passTo ?? null)
      return
    }
    if (sp.kind === 'corner' && this.time >= 1.4) {
      // Aim at the hero (relationship + crossing decide accuracy), else best header.
      const heroC = { id: this.hero.id, pos: this.hero.pos, vel: this.hero.vel }
      const toHero = this.rng.chance(clamp01(0.65 + taker.relationToHero / 250))
      let target = toHero ? leadPosition(sp.spot, heroC, 18, 3) : { x: PITCH_LENGTH - 8 - this.rng.range(0, 5), y: GOAL_CENTER_Y + this.rng.range(-5, 5) }
      target = { x: clampN(target.x, PITCH_LENGTH - 16, PITCH_LENGTH - 4), y: clampN(target.y, GOAL_CENTER_Y - 10, GOAL_CENTER_Y + 10) }
      const plan = planKick({ kind: 'cross', from: sp.spot, target, targetZ: 1.95, power: 0.7, curl: sp.spot.y < GOAL_CENTER_Y ? 0.5 : -0.5, attrs: taker.attrs, pressure: 0, assist: 'manual', env: this.env, noiseScale: 0.8 }, this.rng)
      this.ball.x = sp.spot.x
      this.ball.y = sp.spot.y
      this.kickBall(taker, plan, 'cross', 0.7, null)
      return
    }
    if (sp.kind === 'penalty') {
      if (!this.penaltyPlan) {
        const centre = this.rng.chance(0.12)
        const side = this.rng.chance(0.5) ? 1 : -1
        this.penaltyPlan = {
          target: { x: -0.2, y: centre ? GOAL_CENTER_Y + this.rng.range(-0.5, 0.5) : GOAL_CENTER_Y + side * this.rng.range(1.6, 3.2) },
          z: this.rng.range(0.15, 1.9),
          runStart: this.time + 0.6,
        }
      }
      const pp = this.penaltyPlan
      if (this.time < pp.runStart) return
      // Run-up: approach the ball; a good keeper may read the taker's body shape.
      const behind = { x: sp.spot.x + 0.5, y: sp.spot.y + 0.25 }
      taker.vel = arrive(taker, behind, 4.2, 0.4)
      // The tell (body shape / plant foot) shows from penaltyTellAt; Reflexes ≥ 70 read it 0.15 s earlier (2.1#87).
      const readSkill = a01(this.hero.attrs.gkPositioning) * 0.6 + a01(this.hero.attrs.reflexes) * 0.2
      const look = Math.atan2(pp.target.y - taker.pos.y, pp.target.x - taker.pos.x)
      const tell = this.time >= pp.runStart + penaltyTellDelay(this.hero.attrs.reflexes) ? readSkill : 0
      taker.facing = Math.PI + angleDiff(look, Math.PI) * tell
      // Going early gives the taker the middle (2.1#87).
      if (this.hero.isKeeper && this.hero.state === 'dive' && !pp.punished) {
        pp.punished = true
        if (this.rng.chance(EARLY_DIVE_CENTRE)) pp.target = { x: -0.2, y: GOAL_CENTER_Y + this.rng.range(-0.4, 0.4) }
      }
      if (dist(taker.pos, behind) < 0.35) {
        const plan = planKick({ kind: 'penalty', from: sp.spot, target: pp.target, targetZ: pp.z, power: this.rng.range(0.78, 0.95), curl: 0, attrs: taker.attrs, pressure: 0.3, assist: 'manual', env: this.env, noiseScale: 0.9 }, this.rng)
        this.ball.x = sp.spot.x
        this.ball.y = sp.spot.y
        this.kickBall(taker, plan, 'penalty', 0.88, null)
      }
    }
  }

  private landingPoint(): { p: Vec2; t: number } | null {
    const pts = predictTrajectory(this.ball, this.env, { duration: 2.5, sampleEvery: 2 })
    for (let i = 1; i < pts.length; i++) {
      if (pts[i]!.z < 2.4 && pts[i - 1]!.z >= pts[i]!.z) return { p: { x: pts[i]!.x, y: pts[i]!.y }, t: pts[i]!.t }
    }
    return null
  }

  /** Integrates position + state timers for an agent. */
  private integrateAgent(a: Agent): void {
    a.stateT += DT
    a.cd = Math.max(0, a.cd - DT)
    a.noTouch = Math.max(0, a.noTouch - DT)
    switch (a.state) {
      case 'slide': {
        const t = a.stateT
        a.vel = scale(a.actionDir, Math.max(0, len(a.vel) - 9 * DT))
        if (t > 0.6) {
          a.state = 'down'
          a.stateT = 0
        }
        break
      }
      case 'dive': {
        const t = a.stateT
        const dur = DIVE_TIME
        let sp = diveSpeed(a) * (t < DIVE_PEAK ? 1 : Math.max(0, 1 - (t - DIVE_PEAK) / 0.22))
        // (Diving to a point: the body stops where his hand meets the ball — a better diver does not over-dive it.)
        if (a.diveLeft !== undefined) {
          sp = Math.min(sp, Math.max(0, a.diveLeft) / DT)
          a.diveLeft -= sp * DT
        }
        a.vel = scale(a.actionDir, sp)
        a.z = Math.max(0, Math.sin((Math.PI * t) / dur) * 0.55)
        if (t > dur) {
          a.state = 'down'
          a.stateT = 0
          a.z = 0
        }
        break
      }
      case 'jump': {
        const dur = 0.56
        const h = this.wallIds.has(a.id) ? 0.18 + a01(a.attrs.jumping) * 0.2 : jumpHeight(a.attrs.jumping)
        a.z = Math.max(0, Math.sin((Math.PI * a.stateT) / dur) * h)
        a.vel = scale(a.vel, 0.97)
        if (a.stateT > dur) {
          a.state = 'run'
          a.z = 0
          a.stateT = 0
        }
        break
      }
      case 'down': {
        a.vel = scale(a.vel, 0.85)
        if (a.stateT > KEEPER_GETUP) {
          a.state = 'run'
          a.stateT = 0
        }
        break
      }
      case 'skill': {
        if (!a.isHero) a.vel = scale(a.actionDir, topSpeed({ ...a, sprint: true }) + 1)
        if (a.stateT > 0.42) {
          a.state = 'run'
          a.stateT = 0
        }
        break
      }
      default:
        break
    }
    a.pos.x = clampN(a.pos.x + a.vel.x * DT, -3, PITCH_LENGTH + 3)
    a.pos.y = clampN(a.pos.y + a.vel.y * DT, -3, PITCH_WIDTH + 3)
    // Facing: toward motion, else toward the ball.
    const sp = len(a.vel)
    let want: number
    if (a.state === 'dive' || a.state === 'slide') want = Math.atan2(a.actionDir.y, a.actionDir.x)
    else if (sp > 0.8) want = Math.atan2(a.vel.y, a.vel.x)
    else want = Math.atan2(this.ball.y - a.pos.y, this.ball.x - a.pos.x)
    if (this.setPiece && this.setPiece.takerId === a.id && a.isHero) want = Math.atan2(GOAL_CENTER_Y - a.pos.y, PITCH_LENGTH - a.pos.x)
    // Shielding: back to the nearest challenger, the ball on the far side of the body.
    if (a.isHero && this.shielding()) {
      const m = this.agents.filter((o) => o.team !== a.team && !o.isKeeper).sort((p, q) => dist(p.pos, a.pos) - dist(q.pos, a.pos))[0]
      if (m && dist(m.pos, a.pos) < 4) want = Math.atan2(a.pos.y - m.pos.y, a.pos.x - m.pos.x)
    }
    // Jockeying: square on to the carrier, backing off (never facing away from him).
    if (a.isHero && this.jockeying()) want = Math.atan2(this.owner!.pos.y - a.pos.y, this.owner!.pos.x - a.pos.x)
    if (this.setPiece?.kind === 'penalty' && this.setPiece.takerId === a.id && !a.isHero) return
    const rate = (a.isHero ? heroTurnRate(a.attrs.agility) : 8 + a01(a.attrs.agility) * 5) * DT
    const d = angleDiff(want, a.facing)
    a.facing += clampN(d, -rate, rate)
  }

  // ───────────────────────── Ball ─────────────────────────

  private updateBall(): void {
    const o = this.owner
    if (o) {
      // Dribble: touch cycle pushes the ball ahead, then the player catches up.
      const sp = len(o.vel)
      const moving = sp > 1
      const period = 0.62 - a01(o.attrs.dribbling) * 0.2
      if (moving) {
        o.touch += (DT / period) * clampN(sp / 6, 0.5, 1.4)
        if (o.touch >= 1) {
          o.touch -= 1
          if (o.isHero) this.events.push({ type: 'dribble', by: o.id })
        }
      }
      // Knock-on distance (plan 2.1#36): Dribbling 40 → 1.6 m, 80 → 0.9 m, +40 % sprinting.
      const reach = dribbleReach(o.attrs.dribbling, o.sprint && o.stamina > 0.05)
      const ahead = DRIBBLE_FOOT + (moving ? (1 - o.touch) * (reach - DRIBBLE_FOOT) * clampN(sp / 7.5, 0, 1) : 0)
      const f = fromAngle(o.facing)
      if (o.isKeeper) {
        // Held in hands.
        this.ball.x = o.pos.x + f.x * 0.3
        this.ball.y = o.pos.y + f.y * 0.3
        this.ball.z = 1.0
      } else {
        this.ball.x = o.pos.x + f.x * ahead
        this.ball.y = o.pos.y + f.y * ahead
        this.ball.z = 0
      }
      this.ball.vx = o.vel.x
      this.ball.vy = o.vel.y
      this.ball.vz = 0
      return
    }
    if (this.setPiece) {
      this.ball.vx = this.ball.vy = this.ball.vz = 0
      return
    }
    this.physEvents.length = 0
    stepBall(this.ball, this.env, this.tracker, this.physEvents)
    for (const e of this.physEvents) this.onPhysics(e)
  }

  private onPhysics(e: PhysicsEvent): void {
    switch (e.type) {
      case 'bounce':
        if (e.speed > 2) this.events.push({ type: 'bounce', speed: e.speed, x: e.x, y: e.y })
        break
      case 'post':
      case 'bar':
        this.events.push({ type: e.type, speed: e.speed, x: e.x, y: e.y, z: e.z })
        if (this.shot) this.shot.woodwork = true
        break
      case 'net':
        this.events.push({ type: 'net', speed: e.speed, end: e.end })
        break
      case 'goal':
        this.onGoal(e.end)
        break
      case 'out':
        this.events.push({ type: 'out', x: e.x, y: e.y })
        this.onOut()
        break
    }
  }

  // ───────────────────────── Contacts ─────────────────────────

  private contacts(): void {
    const b = this.ball
    const bp = { x: b.x, y: b.y }
    const speed = Math.hypot(b.vx, b.vy, b.vz)
    let best: Agent | null = null
    let bestD = Infinity
    let mode: 'feet' | 'head' | 'body' | 'keeper' = 'feet'
    const heads: Agent[] = []

    for (const a of this.agents) {
      if (a.noTouch > 0 || (a.state === 'down' && !a.isKeeper)) continue
      const d = Math.hypot(a.pos.x - b.x, a.pos.y - b.y)
      if (d > 3) continue
      // Keepers (hands) inside their box.
      if (a.isKeeper && this.inOwnBox(a, bp)) {
        let reachD = d
        // Off his line closing down a shooter, a keeper spreads himself (bigger, lower barrier).
        const off = Math.abs(a.pos.x - ownGoalX(a.team))
        const spread = !a.isHero && off > 3 && a.state === 'run' && !!this.shot && this.shot.by.team !== a.team && this.time - this.shot.t < 0.25
        // Every keeper the same (keeperPhysics): hands round his body from Reflexes, arm at full stretch from Diving,
        // catch height from Jumping; coming for a high ball (no shot), his take-off spot is GK Positioning.
        const claim = a.state === 'jump' && !this.shot ? Math.max(0, a01(a.attrs.gkPositioning) - 0.5) * 0.6 : 0
        let reachR = spread ? 0.95 : handsReach(a) + claim
        let reachZ = spread ? 1.9 : catchHeight(a) + a.z
        if (a.state === 'dive') {
          // The diving body is a line from trailing legs to fingertips: a ball behind the body (over-dive) still hits it.
          const seg = pointSegment(bp, add(a.pos, scale(a.actionDir, -DIVE_BODY_BACK)), add(a.pos, scale(a.actionDir, armReach(a))))
          reachD = seg.d
          reachR = 0.32
          reachZ = catchHeight(a) + 0.1 + a.z
        }
        if (reachD < reachR + BALL_RADIUS && b.z < reachZ) {
          if (reachD < bestD) {
            best = a
            bestD = reachD
            mode = 'keeper'
          }
        }
        continue
      }
      // Shot blocks by opponents of the shooter (bodies in the way, incl. jumping wall).
      // BLOCK button: spread in the line, wider with Positioning and Aggression (committing the body).
      // Build 9: the spread follows Positioning / Aggression properly (0.52 m at 40 → 0.88 m at 90; 0.66 at 62).
      const spread = a.isHero && this.time < this.blockUntil ? HERO_BLOCK_SPREAD * (0.4 + a01(a.attrs.positioning) * 0.65 + a01(a.attrs.aggression ?? 50) * 0.4) : 0
      // Spread (BLOCK held) is his own body shape: it replaces the default, it is not a floor on it.
      const blockR = a.isHero && this.kind === 'block' ? (a.state === 'slide' ? HERO_BLOCK_SLIDE_R : spread || HERO_BLOCK_R) : spread || 0.46
      if (this.shot && this.shot.by.team !== a.team && speed > 12 && d < blockR && b.z < 1.8 + a.z) {
        if (d < bestD) {
          best = a
          bestD = d
          mode = 'body'
        }
        continue
      }
      // (Any hard ball — a cross, a driven pass — struck into an opponent's body at torso height comes off him: below
      // it his feet meet it, above it his head; it never passes through him.)
      if (!this.shot && this.lastTouch && this.lastTouch.team !== a.team && !a.isKeeper && speed > 12 && d < 0.46 && b.z >= 1.1 && b.z < 1.8 + a.z && a.state !== 'jump') {
        if (d < bestD) {
          best = a
          bestD = d
          mode = 'body'
        }
        continue
      }
      // Headers: ball centre between shoulders and just over the top of the head.
      const headZ = 1.72 + a.z
      const headR = 0.55 + a01(a.attrs.heading) * 0.2 + (a.state === 'jump' ? 0.15 : 0)
      // (In the air he meets it as he rises or falls — a higher leap reaches higher, it does not leave him over the ball.)
      if (b.z > 1.15 && b.z > headZ - 0.42 - (a.state === 'jump' ? HEAD_ADJUST : 0) && b.z < headZ + 0.28 && d < headR) {
        // A fast shot hitting an opponent's head is a block, not a controlled header.
        if (this.shot && this.shot.by.team !== a.team && speed > 15) {
          if (d < bestD) {
            best = a
            bestD = d
            mode = 'body'
          }
          continue
        }
        if (a.isHero && a.state !== 'jump') {
          // Hero must time the jump to head it; a ball at chest height can be brought down
          // (and is contested like any aerial ball).
          if (b.z < 1.95 && d < 0.8) heads.push(a)
          continue
        }
        heads.push(a)
        continue
      }
      // Feet / chest. Reading an opponent's pass (Anticipation) gets the hero a longer leg to it.
      const readR = a.isHero && this.lastTouch && this.lastTouch.team !== a.team && speed > 6 ? (a01(a.attrs.anticipation) - 0.65) * 0.9 : 0
      const footR = (a.state === 'slide' ? 0.85 : 0.62) + readR + (this.passMeantFor(a) ? (RECEIVE.reach + RECEIVE.reachSkill * a01(a.attrs.firstTouch)) * this.receiveHelp() : 0)
      if (b.z < 1.2 && d < footR && d < bestD) {
        best = a
        bestD = d
        mode = 'feet'
      }
    }
    if (heads.length && mode !== 'keeper' && mode !== 'body') {
      best = this.headerContest(heads, bp)
      // The hero on the ground wins it with his chest: a first touch, not a header.
      mode = best.isHero && best.state !== 'jump' ? 'feet' : 'head'
      // (A team-mate's ball dropping to a man nobody contests: he brings it down on his chest — he does not head his own
      // side's pass away.)
      if (mode === 'head' && !best.isHero && this.lastTouch && this.lastTouch.team === best.team && this.aerialPool === 1 && this.ball.z < CHEST_TOP) mode = 'feet'
      // (A long ball dropping to a lone opponent: he has to have read its flight to be there — his Anticipation vs the
      // passer's Long Passing, as for a ground pass he cuts out.)
      const passer = this.lastTouch
      if (mode === 'head' && !best.isHero && passer && passer.team !== best.team && !this.shot && this.lastKickLong && this.aerialPool === 1 && this.heroLastKick !== 'cross') {
        if (!this.rng.chance(eventChanceOf(best.attrs.anticipation ?? best.attrs.positioning, passer.attrs.longPassing ?? passer.attrs.passing, best.team === 'opp' ? (this.difficulty - 1) * 20 : 0))) {
          best.noTouch = 0.5
          return
        }
      }
    }
    if (!best) return
    switch (mode) {
      case 'keeper':
        return this.keeperContact(best, speed)
      case 'body':
        return this.block(best)
      case 'head':
        return this.headerContact(best)
      case 'feet':
        return this.feetContact(best, speed)
    }
  }

  /**
   * Aerial duel: everyone close enough to jump for the ball competes, not just
   * whoever is nearest. Heading, jumping and strength, distance to the ball
   * and (for the hero) the timing of the jump decide who wins it.
   */
  private headerContest(heads: Agent[], bp: Vec2): Agent {
    const b = this.ball
    const gx = attackGoalX('hero')
    const inCorridor = Math.abs(bp.x - gx) >= CROSS_CORRIDOR.near && Math.abs(bp.x - gx) <= CROSS_CORRIDOR.far && Math.abs(bp.y - GOAL_CENTER_Y) <= CROSS_CORRIDOR.half
    const pool = new Set<Agent>(heads)
    for (const a of this.agents) {
      if (pool.has(a) || a.noTouch > 0 || a.state === 'down' || a.isKeeper) continue
      // (Build 9: the hero standing right under it is in the way of the man jumping over him — he contests it with his
      // body even without a leap.)
      if (a.isHero && a.state !== 'jump') {
        if (b.z < 2.4 && dist(a.pos, bp) < 0.8) pool.add(a)
        continue
      }
      const jumpTop = 1.72 + jumpHeight(a.attrs.jumping) + 0.28
      if (b.z < 1.15 || b.z > jumpTop) continue
      // A runner attacking the hero's delivery meets it: the better the ball (his Crossing / Curve), the further
      // the runner can get to it.
      // (A floated corner hangs for the runner; a driven one is on him before he can adjust.)
      const hang = this.cornerChoice && this.kind === 'corner_kick' ? (this.cornerChoice.height === 'floated' ? 1.4 : 0) : 1
      // (The delivery's quality is counted once — in the duel below; the runner's reach is his run onto a ball in the
      // corridor.)
      const meet = a.team === 'hero' && this.heroDeliveryAt >= 0 && this.lastTouch?.isHero && inCorridor ? CROSS_REACH * 0.6 * hang : 0
      if (dist(a.pos, bp) < 1.15 + meet) pool.add(a)
    }
    const list = [...pool]
    this.aerialPool = list.length
    if (list.length === 1) return list[0]!
    // Body position: the player in front (toward where the ball comes from) gets there first.
    const inc = norm({ x: -b.vx, y: -b.vy })
    const frontness = (a: Agent) => (a.pos.x - bp.x) * inc.x + (a.pos.y - bp.y) * inc.y
    // Owner, build 9: getting there is physics (the pool above: reach, jump height); the duel is ONE chance — the
    // best-placed man of each side, Heading vs Heading (+1 % a point; the hero taking it on his chest: First Touch,
    // 10 points harder). Being in front of the ball ±10, the hero's jump timing ±15, a quality delivery into the
    // corridor for his runner (the delivery as struck, ±DELIVERY_EDGE/2), a keeper's defenders leaving it to him −20, the difficulty.
    const placed = (a: Agent) => frontness(a) * 0.5 - dist(a.pos, bp)
    const best = (team: string) => list.filter((a) => a.team === team).sort((p, q) => placed(q) - placed(p))[0]
    const h = best('hero')
    const o = best('opp')
    let winner: Agent
    if (!h || !o) winner = (h ?? o)!
    else {
      const chest = h.isHero && h.state !== 'jump'
      const stat = chest ? h.attrs.firstTouch - 10 : h.attrs.heading
      const ahead = frontness(h) - frontness(o)
      let mod = ahead > 0.15 ? 10 : ahead < -0.15 ? -10 : 0
      if (h.isHero && h.state === 'jump') mod += h.stateT > 0.12 && h.stateT < 0.44 ? CHANCE_MOD.timing : -CHANCE_MOD.timing
      if (!h.isHero && this.heroDeliveryAt >= 0 && this.lastTouch?.isHero && this.heroCrossQ > 0 && inCorridor) mod += (this.heroCrossQ - 0.5) * DELIVERY_EDGE
      // (The hero's long ball to a team-mate the same: a well-weighted one drops onto his man, not between him and his marker.)
      else if (!h.isHero && this.lastTouch?.isHero && this.heroLastKick === 'lofted' && this.heroPassTo?.id === h.id) mod += (this.heroPassQuality - 0.5) * DELIVERY_EDGE
      if (this.hero.isKeeper && !h.isHero) mod -= 20
      mod -= (this.difficulty - 1) * 20
      winner = this.rng.chance(eventChanceOf(stat, o.attrs.heading, mod)) ? h : o
    }
    // The hero's cross / corner won in the air by a team-mate: a chance created (graded success).
    if (winner.team === 'hero' && !winner.isHero && this.lastTouch?.isHero && this.heroDeliveryAt >= 0) this.chance = true
    if (list.some((a) => a.isHero)) this.heroContested = true
    this.events.push({ type: 'aerial', by: winner.id, n: list.length - 1, hero: winner.isHero, heroIn: list.some((a) => a.isHero && a.state === 'jump') })
    for (const a of list) {
      if (a === winner) continue
      a.noTouch = Math.max(a.noTouch, 0.35)
      if (!a.isHero && a.state === 'run') {
        a.state = 'jump'
        a.stateT = 0
      }
    }
    if (!winner.isHero && winner.state === 'run') {
      winner.state = 'jump'
      winner.stateT = 0.2
    }
    return winner
  }

  private inOwnBox(a: Agent, p: Vec2): boolean {
    const gx = ownGoalX(a.team)
    return Math.abs(p.x - gx) < 16.5 && Math.abs(p.y - GOAL_CENTER_Y) < 20.2
  }

  private block(a: Agent): void {
    if (this.offsideCheck(a)) return
    const b = this.ball
    const sp = Math.hypot(b.vx, b.vy)
    // Off the body (physics): reflected about the line from his centre to the ball, a soft body keeps 30 % of it.
    const nrm = len(sub({ x: b.x, y: b.y }, a.pos)) > 1e-3 ? norm(sub({ x: b.x, y: b.y }, a.pos)) : norm({ x: -b.vx, y: -b.vy })
    const vn = b.vx * nrm.x + b.vy * nrm.y
    const rx = b.vx - 2 * vn * nrm.x
    const ry = b.vy - 2 * vn * nrm.y
    const rl = Math.hypot(rx, ry) || 1
    b.vx = (rx / rl) * sp * 0.3
    b.vy = (ry / rl) * sp * 0.3
    b.vz = 1 + sp * 0.06
    b.spin.side = 0
    a.noTouch = 0.35
    this.lastTouch = a
    if (a.isHero && this.defending) {
      this.stats.tackles++
      this.oppShotFree = false
    }
    if (this.shot) this.shot.blocked = true
    this.events.push({ type: 'block', by: a.id, x: b.x, y: b.y })
    // block: the hero got his body in the way: that is the moment won.
    if (a.isHero && this.kind === 'block' && this.shot) this.finish('defended', 'shot blocked')
  }

  private headerContact(a: Agent): void {
    const b = this.ball
    const bp = { x: b.x, y: b.y }
    if (a.isHero && this.defending && !a.isKeeper && Math.abs(bp.x - ownGoalX(a.team)) < 40) {
      // Defending (build 9): a defender's header is a clearance — up, away and wide — not a header at goal.
      // How far it goes: Heading and Strength, and the timing of the leap.
      const timing = a.stateT > 0.12 && a.stateT < 0.44 ? 1 : 0.6
      const reach = (14 + a01(a.attrs.heading) * 10 + a01(a.attrs.strength) * 4) * timing
      const away = attackDir(a.team)
      const target = inField({ x: bp.x + away * reach, y: bp.y + (bp.y < GOAL_CENTER_Y ? -1 : 1) * this.rng.range(4, 12) }, 2)
      const plan = planKick({ kind: 'clear', from: bp, fromZ: b.z, target, power: 0.7, curl: 0, attrs: a.attrs, pressure: this.pressureOn(a), assist: 'manual', env: this.env }, this.rng)
      this.kickBall(a, plan, 'clear', 0.7, null)
      this.events.push({ type: 'header', by: a.id })
      return
    }
    if (a.isHero) {
      // Timing quality: how close to the apex & ball centre.
      const dz = Math.abs(b.z - (1.78 + a.z))
      const timing = clamp01(1 - dz / 0.5) * (a.stateT > 0.12 && a.stateT < 0.44 ? 1 : 0.7)
      const aim = this.heroHeaderAim ?? this.autoGoalAim()
      const plan = planKick({ kind: 'header', from: bp, fromZ: b.z, target: aim, targetZ: 0.6, power: 0.55 + timing * 0.45, curl: 0, attrs: a.attrs, pressure: this.pressureOn(a), assist: this.assist, assistPull: this.assistPull(), env: this.env, noiseScale: (1.6 - timing * 0.8) * (1.3 - 0.6 * a01(a.attrs.heading)) * this.noiseScale() * HERO_SHOT_NOISE * HERO_HEADER_NOISE }, this.rng)
      this.kickBall(a, plan, 'header', 0.55 + timing * 0.45, null)
      this.stopBullet()
      return
    }
    const attacking = a.team === 'hero' ? b.x > PITCH_LENGTH - 20 : b.x < 20
    if (attacking) {
      // Head it down and away from the keeper.
      const aim = shotTarget(bp, a.team, this.aiWorld(), this.rng)
      const plan = planKick({ kind: 'header', from: bp, fromZ: b.z, target: { x: aim.x + attackDir(a.team) * 0.2, y: aim.y }, targetZ: 0.45, power: 0.8, curl: 0, attrs: a.attrs, pressure: this.pressureOn(a), assist: 'manual', env: this.env, noiseScale: a.team === 'opp' ? 1 / this.difficulty : 1 }, this.rng)
      this.kickBall(a, plan, 'header', 0.8, null)
    } else {
      // Defensive clearance header: up and away.
      if (this.defending && a.team === 'hero' && this.dutySnap === null) this.dutySnap = this.onDuty()
      const away = attackDir(a.team)
      const target = inField({ x: b.x + away * this.rng.range(14, 24), y: b.y + this.rng.range(-10, 10) }, 2)
      const plan = planKick({ kind: 'clear', from: bp, fromZ: b.z, target, power: 0.7, curl: 0, attrs: a.attrs, pressure: 0.5, assist: 'manual', env: this.env }, this.rng)
      this.kickBall(a, plan, 'clear', 0.7, null)
      this.events.push({ type: 'header', by: a.id })
    }
  }

  private feetContact(a: Agent, speed: number): void {
    const b = this.ball
    const rel = Math.hypot(b.vx - a.vel.x, b.vy - a.vel.y, b.vz)
    const meant = this.passMeantFor(a)
    // The receiving help (m/s of pace he takes comfortably): the full aim assist, a side on top, the pass meant for him.
    const help = (a.isHero && this.assist === 'full' ? 3 : 0) + (a.team === 'hero' && !a.isHero ? 1.5 * this.lead : 0) + (meant ? (RECEIVE.cushion + RECEIVE.cushionSkill * a01(a.attrs.firstTouch)) * this.receiveHelp() : 0)
    const limit = 6 + a01(a.attrs.firstTouch) * 14.5 + help
    // Hero slide tackle on a loose ball.
    if (a.isHero && a.state === 'slide') {
      if (this.offsideCheck(a)) return
      this.heroTackleResolved = true
      b.vx = a.actionDir.x * 8
      b.vy = a.actionDir.y * 8
      b.vz = 0.5
      this.lastTouch = a
      a.noTouch = 0.3
      this.events.push({ type: 'tackle', by: a.id, won: true, slide: true, x: a.pos.x, y: a.pos.y })
      if (this.defending) {
        this.stats.tackles++
        this.finish('defended', 'slide won ball')
      }
      return
    }
    const opponentsBall = this.lastTouch && this.lastTouch.team !== a.team
    // Interception skill for opponents of the passer.
    if (opponentsBall && !a.isHero && speed > 6) {
      const helper = a.team === 'hero' && this.defending
      // Reading the pass: anticipation first, positioning (being in the lane) second.
      // Owner, build 9: his Anticipation vs the passer's Passing (+1 % a point). A crisp, true pass from the hero is
      // harder to read (up to −20 points at quality 0.9); team-mates helping in the hero's defending moment leave it to
      // him (HELPER_MOD); the difficulty sharpens the opposition.
      const passer = this.lastTouch!
      let mod = a.team === 'opp' ? (this.difficulty - 1) * 20 : 4 * this.lead
      if (a.team === 'opp' && passer.isHero) mod -= clampN((this.heroPassQuality - 0.4) * 40, -4, 20)
      if (helper) mod += this.hero.isKeeper ? HELPER_MOD - 20 : HELPER_MOD
      // (A long ball: against his Long Passing.)
      const passing = this.lastKickLong ? passer.attrs.longPassing ?? passer.attrs.passing : passer.attrs.passing
      if (!this.rng.chance(eventChanceOf(a.attrs.anticipation ?? a.attrs.positioning, passing, mod))) {
        a.noTouch = 0.5
        return
      }
    }
    // Not his ball: a team-mate in the lane of the hero's pass to someone else lets it run rather than miscontrol it.
    if (rel >= limit && a.team === 'hero' && !a.isHero && this.lastTouch?.isHero && this.heroPassTo && this.heroPassTo.id !== '*' && this.heroPassTo.id !== a.id) {
      a.noTouch = 0.25
      return
    }
    if (this.offsideCheck(a)) return
    // rebound: first to the ball the keeper parried — the reaction the moment is about (graded success once his
    // follow-up is on target, keeperContact).
    if (a.isHero && this.kind === 'rebound' && (!this.lastTouch || this.lastTouch.team === 'opp')) this.reboundFirst = true
    // The hero's ball into the box (cross / corner) reaching a team-mate in the box (first touch his, clean or not):
    // a chance created (graded success).
    if (!a.isHero && a.team === 'hero' && this.lastTouch?.isHero && this.heroDeliveryAt >= 0 && this.heroCrossQ > 0 && a.pos.x > PITCH_LENGTH - 16.5 && Math.abs(a.pos.y - GOAL_CENTER_Y) < 20.2) this.chance = true
    // long_ball_control: first to the long ball (clean or not) — he won the contact the moment is about (graded success).
    if (a.isHero && this.kind === 'long_ball_control' && this.lastTouch?.team === 'hero' && !this.lastTouch.isHero) this.chance = true
    // switch_play: the switch reached a team-mate across the pitch (first touch his, clean or not).
    if (!a.isHero && a.team === 'hero' && this.kind === 'switch_play' && this.lastTouch?.isHero && Math.abs(a.pos.y - this.heroKickY) >= 18) this.chance = true
    // timed_run: the hero onside on the end of the ball over the top (clean or not) — the run worked (graded success).
    if (a.isHero && this.kind === 'timed_run' && this.lastTouch?.team === 'hero' && !this.lastTouch.isHero) this.chance = true
    // Owner, build 9: a soft ball (≤ CONTROL_EASY m/s at him) is simply his; a harder one is his First Touch (+1 % a
    // point): +50 points, −3 per m/s over the easy pace, the receiving help at 3 points per m/s.
    if (this.rng.chance(firstTouchChance(a, rel, help * 3))) {
      this.setOwner(a)
      return
    }
    // Heavy touch: ball pops off (further for a poor first touch).
    const f = fromAngle(a.facing)
    const pop = 1.5 + (1 - a01(a.attrs.firstTouch)) * 3.5
    b.vx = b.vx * 0.3 + f.x * pop
    b.vy = b.vy * 0.3 + f.y * pop
    b.vz = Math.min(3, rel * 0.08)
    a.noTouch = 0.3
    this.lastTouch = a
    this.events.push({ type: 'touch', by: a.id, hero: a.isHero, x: a.pos.x, y: a.pos.y })
  }

  private keeperContact(k: Agent, speed: number): void {
    if (this.offsideCheck(k)) return
    const b = this.ball
    const bp = { x: b.x, y: b.y }
    let stretch = 0.15
    if (k.state === 'dive') stretch = clamp01(pointSegment(bp, k.pos, add(k.pos, scale(k.actionDir, armReach(k)))).t)
    // The hero's placed shot made the keeper stretch (graded success); one struck at him does not count.
    // From range a save he made the keeper dive for counts; a follow-up from close in, any save.
    const sh = this.shot
    // (The range rule is for the range moments: a careless shot from distance in a 1v1 / 2v1 earns nothing.)
    // (Build 9: in the range moments the rule holds wherever he shoots from — stepping in closer is not punished.)
    // (A 2-on-1 is about working the chance: a placed save counts from inside the box, not a pot-shot from distance.)
    const far = RANGE_KINDS.has(this.kind) && (this.kind !== 'counter_2v1' || (sh?.range ?? 0) < PARTIAL_SAVE_RANGE)
    // (From range: a save from a shot he placed away from the keeper — his aim, not the keeper's dive — with real pace
    // on it — Shot Power: a tame one is an easy catch wherever it goes — counts.)
    // (Build 9 physics pass: with saves decided by reach, a dive alone is not the shooter's merit — inside the range
    // moments the credit also needs his aim away from the keeper.)
    // (…and a pot-shot from outside the box in a 2-on-1 earns nothing, as the rule above says.)
    const potShot = this.kind === 'counter_2v1' && (sh?.range ?? 0) >= PARTIAL_SAVE_RANGE
    const placed = !potShot && (far ? stretch >= PARTIAL_SAVE_STRETCH_RANGE || (sh?.placedAim === true && speed >= (PARTIAL_RANGE_PACE[this.kind] ?? 17)) : stretch >= PARTIAL_SAVE_STRETCH && sh?.placedAim === true)
    // (rebound: first to the parried ball and the follow-up on target — the moment done.)
    if (sh?.by.isHero && !k.isHero && (placed || this.reboundFirst)) this.chance = true
    // (dribble: past his man, the move ended in a shot the keeper had to stop — held or pushed out, the same thing.)
    if (sh?.by.isHero && !k.isHero && this.kind === 'dribble') this.chance = true
    // Owner, build 9: a keeper who gets to the ball stops it — physics (his reach and the ball's path) decided that,
    // there is no save roll. Holding it or pushing it away is the chance (Handling, less for a hard / stretched one).
    // High ball (cross / corner): catch it, or punch it clear under pressure (WP-14).
    if (!this.shot && b.z > 1.3) {
      const crowd = Math.min(2, this.agents.filter((o) => o.team !== k.team && !o.isKeeper && dist(o.pos, k.pos) < 1.6).length) / 2
      // PUNCH chosen (context button): he goes up with fists rather than hands.
      if (k.isHero && this.punchCross) {
        this.punchCross = false
        return this.punch(k, speed)
      }
      // Catch it (Handling, minus traffic round him and a ball above him) or punch it clear.
      if (!this.rng.chance(claimHoldChance(k, b.z, crowd, speed))) return this.punch(k, speed)
    }
    // A soft ball is simply gathered; otherwise Handling, minus 1.5 points per m/s over 14 and up to 20 at full stretch.
    const held = this.rng.chance(keeperHoldChance(k, speed, stretch))
    if (held) {
      this.events.push({ type: 'save', by: k.id, held: true, x: b.x, y: b.y, z: b.z })
      const wasShot = this.shot
      this.setOwner(k)
      this.shot = wasShot
      this.onKeeperHold(k)
    } else {
      // Parry: pushed out and wide, away from the goal (the side the ball was going), a third of its pace — physics.
      const pv = parryVelocity(b.y, speed, stretch, attackDir(k.team))
      b.vx = pv.vx
      b.vy = pv.vy
      b.vz = pv.vz
      b.spin.side = 0
      k.noTouch = 0.7
      this.lastTouch = k
      if (this.shot) this.shot.parried = true
      this.events.push({ type: 'save', by: k.id, held: false, x: b.x, y: b.y, z: b.z })
    }
  }

  /** Two-fisted punch: high and away from goal, toward the side the ball came in on. */
  private punch(k: Agent, speed: number): void {
    const b = this.ball
    const inward = attackDir(k.team)
    const side = b.y >= GOAL_CENTER_Y ? 1 : -1
    const d = norm({ x: inward * 0.85, y: side * 0.45 })
    const sp = clampN(11 + speed * 0.2 + a01(k.attrs.strength) * 4, 11, 19)
    b.vx = d.x * sp
    b.vy = d.y * sp
    b.vz = 4.5
    b.spin.side = 0
    b.spin.top = 0
    k.noTouch = 0.7
    k.state = 'jump'
    k.stateT = 0.1
    this.lastTouch = k
    this.events.push({ type: 'save', by: k.id, held: false, punch: true, x: b.x, y: b.y, z: b.z })
    // An AI keeper punching our delivery away counts as a clearance.
    if (k.team === 'opp' && !this.defending) this.oppClearedAt = this.time
  }

  // ───────────────────────── Offside ─────────────────────────

  /**
   * Called on every touch of a loose ball. The first touch after a pass
   * settles the offside snapshot: if the toucher was offside when the ball was
   * played the flag goes up (returns true, play is dead); otherwise the
   * snapshot is cleared.
   */
  private offsideCheck(a: Agent): boolean {
    const snap = this.offsideSnap
    if (!snap) return false
    this.offsideSnap = null
    if (!snap.ids.has(a.id) || this.phase !== 'live') return false
    const b = this.ball
    this.events.push({ type: 'offside', by: a.id, team: snap.team, x: a.pos.x, y: a.pos.y })
    // Play stops: the receiver checks the ball, everyone eases off.
    b.vx *= 0.25
    b.vy *= 0.25
    b.vz = Math.min(b.vz, 0)
    a.noTouch = 1
    this.heroPassTo = null
    this.assistChain = null
    const offside = { playerId: a.id, byHero: a.isHero }
    if (snap.team === 'hero') this.finish('lost_ball', 'offside', { offside })
    else this.finish('defended', 'opponent offside', { offside })
    return true
  }

  // ───────────────────────── Duels ─────────────────────────

  private duels(): void {
    const o = this.owner
    const hero = this.hero
    // Hero slide tackle vs carrier.
    if (hero.state === 'slide' && !this.heroTackleResolved && o && o.team === 'opp') {
      const foot = add(hero.pos, scale(hero.actionDir, 0.6))
      const bp = { x: this.ball.x, y: this.ball.y }
      const behind = isBehind(o, hero)
      if (dist(foot, bp) < 0.75) {
        this.heroTackleResolved = true
        // Sliding in only pays off when the ball is away from his feet (the timing), Tackling vs his Dribbling.
        if (this.rng.chance(eventChance('tackle', hero, o, this.tackleMod(Math.min(0.95, this.exposure(o) + 0.1), behind, 0, true)))) {
          this.winBall(hero, o, true)
          this.finish('defended', 'slide tackle')
        } else if (!this.rng.chance(this.cleanChance(hero, true, behind))) {
          this.heroFoul(o, true, behind)
        } else {
          // Carrier skips over it.
          o.vel = scale(o.vel, 1.1)
        }
        return
      }
      if (dist(hero.pos, o.pos) < 0.7) {
        this.heroTackleResolved = true
        // Through the man, not the ball: clean only on a fine Tackling (35 points harder).
        if (!this.rng.chance(this.cleanChance(hero, true, behind, 35 / -CHANCE_MOD.lunge))) this.heroFoul(o, true, behind)
        return
      }
    }
    if (!o || o.isKeeper) return
    // Opening grace: the hero gets his first touch and a look up before anyone can challenge (the keeper included).
    if (o.isHero && this.time < this.graceUntil) return
    if (this.keeperSmother(o)) return
    // Scripted build-up: the feed to the hero is not contested on the carrier's feet.
    if (o === this.setupCarrier) return
    // AI tackles on the carrier.
    for (const a of this.agents) {
      if (a.team === o.team || a.isHero || a.isKeeper || a.cd > 0 || a.noTouch > 0 || a.state !== 'run') continue
      // In range of the carrier, or of a ball he has knocked away from his feet (2.1#37).
      // From behind, the body is in the way: only the ball itself counts.
      const dBall = Math.hypot(a.pos.x - this.ball.x, a.pos.y - this.ball.y)
      // (Leaning on the hero's back while he shields it: he reaches round him — the shield contest, see aiChallenge.)
      const reachRound = o.isHero && this.shielding() && dist(a.pos, o.pos) < BODY_GAP + REACH_ROUND
      const d = reachRound ? 0 : isBehind(o, a) ? dBall : Math.min(dist(a.pos, o.pos), dBall)
      if (d > TACKLE_RANGE) continue
      // Aggressive players go into more challenges (and foul more, see tackleOdds).
      const rate = (0.45 + a01(a.attrs.tackling) * 0.8 + a01(a.attrs.aggression ?? 50) * 0.4) * (a.team === 'opp' ? this.difficulty : (this.defending ? 0.3 * this.defendHelp() : 0.8) * Math.max(0.2, 1 + 0.8 * this.lead))
      if (!this.rng.chance(rate * DT)) continue
      if (this.aiChallenge(a, o)) return
    }
  }

  /**
   * One AI challenge on the carrier `o` (his Tackling / Aggression vs the carrier's hold, a shield, the ball's gap,
   * foul and card risk). Returns true when it ended the moment (a foul given).
   */
  private aiChallenge(a: Agent, o: Agent): boolean {
    a.cd = 1.1
    const behind = isBehind(o, a)
    // Owner, build 9: his Tackling vs the carrier's Dribbling (+1 % a point) — with SHIELD held it is the carrier's
    // Strength he has to get past, and the body in the way is worth CHANCE_MOD.shield. The timing (the ball off the
    // foot) ±15, from behind −20, a ball knocked away from the carrier's feet +10, the difficulty sharpens him.
    const shield = o.isHero && this.shielding()
    // (A shield contest is body against body — his Strength / Balance and the shield's CHANCE_MOD.shield; the timing and
    // the from-behind of a tackle on a carrier are that same body, not counted twice.)
    const mod = (shield ? -CHANCE_MOD.shield : clampN((this.exposure(o) - 0.45) / 0.45, -1, 1) * CHANCE_MOD.timing + (behind ? CHANCE_MOD.behind : 0) + (this.ballGap(o) > LOOSE_BALL_GAP ? 10 : 0)) + (a.team === 'opp' ? (this.difficulty - 1) * 20 : 0)
    // (The shield is his body: Strength and Balance together.)
    if (this.rng.chance(eventChanceOf(a.attrs.tackling, shield ? (o.attrs.strength + (o.attrs.balance ?? o.attrs.strength)) / 2 : o.attrs.dribbling, mod))) {
      this.winBall(a, o, false)
      if (o.isHero) o.noTouch = 0.7
    } else if (a.team === 'opp' && behind && !this.rng.chance(this.cleanChance(a, false, behind))) {
      if (o.isHero && this.rng.chance(0.03)) this.injured = true
      const card = cardForFoul(this.rng, false, behind, false, this.refStrictness)
      if (!this.injured && this.tryAdvantage(a, o, card)) return true
      this.events.push({ type: 'foul', by: a.id, on: o.id, card })
      this.finish(this.defending ? 'defended' : 'foul_won', 'fouled')
      return true
    } else {
      a.state = 'down'
      a.stateT = 0
      a.noTouch = 0.6
      if (o.isHero) this.stats.dribbles++
      this.events.push({ type: 'tackle', by: a.id, won: false, slide: false, x: a.pos.x, y: a.pos.y })
    }
    return false
  }

  /**
   * Bodies (playtester build 9: the hero ran through the carrier and the ball). The hero never overlaps an opponent
   * (centres {@link BODY_GAP} apart) nor the ball at an opponent's feet ({@link BALL_CONTACT}); the check is swept over
   * the step (closest approach of the two moving points), so no approach speed skips it. Meeting the carrier or his
   * ball right after a defensive press is a challenge (standing tackle: Tackling and timing vs his hold, a reckless
   * charge timed worse, foul risk); otherwise the hero is simply stopped by the body.
   */
  private heroBodyContact(): void {
    const hero = this.hero
    if (hero.state !== 'run' && hero.state !== 'jump' && hero.state !== 'wall') return
    const o = this.owner
    const swept = (p0: Vec2, p1: Vec2, q0: Vec2, q1: Vec2): { d: number; r0: Vec2; r1: Vec2 } => {
      const r0 = sub(p0, q0)
      const r1 = sub(p1, q1)
      const dr = sub(r1, r0)
      const l2 = dot(dr, dr)
      const t = l2 > 1e-9 ? clamp01(-dot(r0, dr) / l2) : 1
      return { d: len(add(r0, scale(dr, t))), r0, r1 }
    }
    // (Sold — shifted past, beaten on the turn: noTouch — he is out of it for that beat, contact or not.)
    const intent = () => this.phase === 'live' && hero.cd <= 0 && hero.noTouch <= 0 && hero.state === 'run' && !hero.isKeeper && this.time >= this.stumbleUntil && (this.time - this.defPressAt < CONTEST_INTENT || this.dash?.why === 'press' || !!this.engage || !!this.pressOn)
    // Body weight in a collision (Strength, Balance): the stronger man gives less ground.
    const weight = (a: Agent) => 0.6 + a01(a.attrs.strength) * 0.6 + a01(a.attrs.balance ?? a.attrs.strength) * 0.3
    const push = (gap: number, r0: Vec2, r1: Vec2, vel: Vec2, other: Agent | null, keepPace = false): void => {
      // Back on the side he came from (crossed over this step) or straight out along the contact normal.
      const crossed = dot(r0, r1) < 0 && len(r0) > 1e-3
      const n = crossed ? norm(r0) : len(r1) > 1e-3 ? norm(r1) : len(r0) > 1e-3 ? norm(r0) : { x: -1, y: 0 }
      // Both bodies give way (the ball does not): the hero's share by weight.
      // Shielding is a braced stance (SHIELD held, body between man and ball): he gives far less ground.
      const wh = other ? weight(other) / (weight(hero) * (this.shielding() ? 3 : 1) + weight(other)) : 1
      const delta = sub(scale(n, gap), r1)
      hero.pos = add(hero.pos, scale(delta, wh))
      if (other) other.pos = sub(other.pos, scale(delta, 1 - wh))
      const vn = dot(sub(hero.vel, vel), n)
      if (vn < 0 && !keepPace) {
        hero.vel = sub(hero.vel, scale(n, vn * wh))
        if (other) other.vel = add(other.vel, scale(n, vn * (1 - wh)))
      }
    }
    const hp0 = { x: hero.prev.x, y: hero.prev.y }
    // Barging into him at a sprint is a lunge (graded by the closing speed, HERO_CHARGE): arriving under control is not.
    const contest = (c: Agent): void => {
      const closing = dot(hero.vel, norm(sub(c.pos, hero.pos)))
      this.lunge = clamp01((closing - HERO_CHARGE.from) / HERO_CHARGE.span)
      this.standingTackle(c)
      this.lunge = 0
    }
    // The ball at an opponent's feet first (it sits in front of him, the side a defender comes from).
    // (A keeper going down at a man's feet takes the ball with his hands: keeperLogic's smother, not a body block.)
    if (o && o.team === 'opp' && this.ball.z < 0.7 && !hero.isKeeper) {
      const b1 = { x: this.ball.x, y: this.ball.y }
      const c = swept(hp0, hero.pos, { x: this.prevBall.x, y: this.prevBall.y }, b1)
      if (c.d < BALL_CONTACT) {
        if (intent()) {
          contest(o)
          if (this.owner !== o) return
        }
        push(BALL_CONTACT, c.r0, c.r1, o.vel, null)
      }
    }
    for (const a of this.agents) {
      if (a.team === hero.team || a.state === 'down' || a.state === 'slide' || a.state === 'dive') continue
      const c = swept(hp0, hero.pos, { x: a.prev.x, y: a.prev.y }, a.pos)
      if (c.d >= BODY_GAP) continue
      if (a === this.owner && intent()) {
        contest(a)
        if (this.owner !== a) continue
      }
      // Contact takes out the closing speed only (they slide round each other, nobody is bulldozed). A loose ball (a
      // drop, a rebound, a cross): bodies never overlap but nobody is slowed either — the aerial / race contests
      // decide it (playtester build 9 phone pass).
      push(BODY_GAP, c.r0, c.r1, a.vel, a, !this.owner)
    }
  }

  /**
   * Shoulder to shoulder (Strength, Balance): the hero and the nearest opponent running side by side (racing for
   * a loose ball, or one of them carrying it) lean into each other every {@link SHOULDER_EVERY} s. Strength (with a little
   * aggression and momentum) wins the contact; the loser is knocked off his line and, with poor Balance, off
   * his feet — losing the ball if he had it.
   */
  private shoulderContact(): void {
    // (Bodies are solid since build 9's pressing fix: side by side they stay in range, so the lean is re-decided less often.)
    if (this.time - this.shoulderAt < SHOULDER_EVERY) return
    const hero = this.hero
    if (hero.state !== 'run' || hero.isKeeper || this.time < this.stumbleUntil) return
    if (this.owner === hero && this.time < this.graceUntil) return
    const o = this.owner
    let opp: Agent | null = null
    let best = 1.15
    for (const a of this.agents) {
      if (a.team === 'hero' || a.isKeeper || a.state !== 'run') continue
      const d = dist(a.pos, hero.pos)
      if (d < best) {
        best = d
        opp = a
      }
    }
    if (!opp) return
    // Only a running contest: both moving, the ball loose near them or carried by one of the two.
    const ballNear = Math.hypot(this.ball.x - hero.pos.x, this.ball.y - hero.pos.y) < 7
    const involved = o ? o === hero || o === opp : ballNear && this.ball.z < 1.6
    if (!involved || len(hero.vel) < 2.5 || len(opp.vel) < 2.5) return
    this.shoulderAt = this.time
    // Owner, build 9: Strength vs Strength (+1 % a point); the man arriving faster leans in harder (2 points per m/s
    // of difference), the difficulty sharpens the opposition.
    const pHero = eventChance('shoulder', hero, opp, (len(hero.vel) - len(opp.vel)) * 2 - (this.difficulty - 1) * 20)
    const heroWins = this.rng.chance(pHero)
    const winner = heroWins ? hero : opp
    const loser = heroWins ? opp : hero
    // Off his line: slowed and pushed away from the winner.
    const away = norm(sub(loser.pos, winner.pos))
    loser.vel = add(scale(loser.vel, 0.55), scale(away, 1.2))
    // Off his feet: his Balance vs the winner's Strength (+1 % a point) — staying up is the usual (+30 points), more
    // so shielding (+15).
    const down = !this.rng.chance(eventChance('keepFeet', loser, winner, 30 + (loser.isHero && this.shielding() ? 15 : 0)))
    if (down) {
      loser.state = 'down'
      loser.stateT = 0.2
      loser.noTouch = 0.6
    } else loser.noTouch = Math.max(loser.noTouch, 0.25)
    if (o === loser) {
      // Shrugged off the ball: it runs on loose.
      this.owner = null
      this.ball.vx = loser.vel.x + away.x * -1.5
      this.ball.vy = loser.vel.y + away.y * -1.5
      this.lastTouch = loser
    }
    this.events.push({ type: 'shoulder', by: winner.id, on: loser.id, down, x: (hero.pos.x + opp.pos.x) / 2, y: (hero.pos.y + opp.pos.y) / 2 })
  }

  // ───────────────────────── Advantage (WP-14) ─────────────────────────

  /**
   * An opponent fouled our carrier in the opposition half and he stayed on
   * his feet: the referee may wave play on (his advantage tendency). Returns
   * true when advantage is played.
   */
  private tryAdvantage(fouler: Agent, on: Agent, card: 'yellow' | 'red' | undefined): boolean {
    if (this.defending || on.team !== 'hero' || this.advantage || this.advantageResult) return false
    if (this.ball.x < PITCH_LENGTH * 0.45) return false
    if (!this.rng.chance(this.refAdvantage)) return false
    // The carrier rides the challenge (slowed, still on the ball); the fouler is left behind.
    on.vel = scale(on.vel, 0.6)
    fouler.state = 'down'
    fouler.stateT = 0
    fouler.noTouch = 1.2
    this.advantage = { t: this.time, x0: this.ball.x }
    this.events.push({ type: 'foul', by: fouler.id, on: on.id, card, advantage: true })
    this.events.push({ type: 'advantage', state: 'on', x: this.ball.x, y: this.ball.y })
    return true
  }

  /**
   * While advantage runs: a shot, or real progress in possession, means it
   * paid off; losing the ball or nothing happening within the window brings
   * play back for the free kick.
   */
  private checkAdvantage(): void {
    const adv = this.advantage
    if (!adv || this.result) return
    const o = this.owner
    const shotSince = !!this.shot && this.shot.by.team === 'hero' && this.shot.t >= adv.t
    const progressed = o?.team === 'hero' && this.ball.x - adv.x0 >= ADVANTAGE_GAIN_M
    if (shotSince || progressed) {
      this.advantage = null
      this.advantageResult = 'played'
      this.events.push({ type: 'advantage', state: 'played', x: this.ball.x, y: this.ball.y })
      return
    }
    const lost = (!!o && o.team === 'opp') || (!o && this.lastTouch?.team === 'opp')
    if (lost || this.time - adv.t > ADVANTAGE_WINDOW) {
      this.advantage = null
      this.advantageResult = 'called_back'
      this.events.push({ type: 'advantage', state: 'called_back', x: adv.x0, y: this.ball.y })
      this.finish('foul_won', 'advantage called back')
    }
  }

  // ───────────────────────── Keepers ─────────────────────────

  /**
   * An AI keeper closing down a dribbler in his box goes down at his feet:
   * timing (ball off the carrier's foot), handling/agility vs dribbling decide it.
   * Beaten, he is left on the ground. Returns true when the duel ended play.
   */
  private keeperSmother(o: Agent): boolean {
    // The hero keeper smothers only when he chose to come (RUSH): Handling / Agility / GK Positioning vs the dribble.
    const k = this.agents.find((a) => a.isKeeper && a.team !== o.team && (!a.isHero || this.dash?.why === 'rush'))
    if (!k || k.state !== 'run' || k.cd > 0 || k.noTouch > 0 || !this.inOwnBox(k, o.pos)) return false
    if (dist(k.pos, { x: this.ball.x, y: this.ball.y }) > 1.5 && dist(k.pos, o.pos) > 1.3) return false
    if (k.isHero) this.dash = null
    k.cd = 1.2
    // Owner, build 9: his Handling vs the dribbler's Dribbling (+1 % a point); the ball off the dribbler's foot ±15, a
    // keeper who chose his moment to come (RUSH) +15, the difficulty sharpens the opposition's.
    const p = eventChance('smother', k, o, clampN((this.exposure(o) - 0.55) / 0.45, -1, 1) * 15 + (k.isHero ? 15 : (this.difficulty - 1) * 20))
    k.state = 'dive'
    k.stateT = DIVE_PEAK * 0.6
    k.actionDir = norm(sub(o.pos, k.pos))
    this.events.push({ type: 'dive', by: k.id })
    if (this.rng.chance(p)) {
      o.noTouch = 0.8
      this.events.push({ type: 'save', by: k.id, held: true, x: this.ball.x, y: this.ball.y, z: 0 })
      const wasShot = this.shot
      this.setOwner(k)
      this.shot = wasShot
      this.onKeeperHold(k)
      return true
    }
    k.noTouch = 0.9
    return false
  }

  private keeperLogic(): void {
    // Open play (owner, build 9: physics, no dice): from his reaction on, every step the earliest point on the ball's
    // real path he can reach in time (keeperPhysics.keeperIntercept); he runs there, and dives only when he must.
    // (Any loose ball whose real path ends in his goal — a shot, a pass, a deflection, a back-pass — is the same to
    // him: physics, not the label of the last kick.)
    if (!this.gkReact && !this.owner && this.phase === 'live') {
      for (const k of this.agents) {
        if (!k.isKeeper || k.isHero || k.state !== 'run' || (this.shot && this.shot.by.team === k.team)) continue
        const inward = attackDir(k.team) > 0 ? 1 : -1
        if (this.ball.vx * inward > -0.5 || Math.abs(this.ball.x - ownGoalX(k.team)) > 45) continue
        if (pathEntersGoal(this.ball, this.env, ownGoalX(k.team), inward)) this.gkReact = { keeper: k, at: this.time + keeperReaction(k, this.difficulty) }
      }
    }
    const gr = this.gkReact
    const away = gr ? this.ball.vx * (attackDir(gr.keeper.team) > 0 ? 1 : -1) > 0.5 : false
    if (gr && (this.owner || (this.shot ? this.shot.by.team === gr.keeper.team : away))) this.gkReact = null
    else if (gr && this.time >= gr.at) {
      const k = gr.keeper
      if (k.state === 'run' && k.noTouch <= 0) {
        const plan = keeperIntercept(k, this.ball, this.env, ownGoalX(k.team), attackDir(k.team) > 0 ? 1 : -1)
        if (plan && plan.onTarget) {
          if (plan.dive && plan.t <= DIVE_PEAK + 0.04 && dist(plan.point, k.pos) > 0.3) this.startDive(k, norm(sub(plan.point, k.pos)), plan.point)
          else if (plan.jump && plan.t <= JUMP_APEX + 0.02 && dist(plan.point, k.pos) < handsReach(k) + 0.3 && len(k.vel) < 3 && k.cd <= 0) {
            // Up for it (a ball dipping over him): Jumping is the height.
            k.state = 'jump'
            k.stateT = 0
            k.cd = 0.6
          } else k.intent = { kind: 'run', to: plan.point, until: this.time + 0.3 }
        }
      }
    }
    const al = this.keeperAlert
    if (!al || this.time < al.at) return
    this.keeperAlert = null
    const k = al.keeper
    if (k.state === 'dive' || this.owner) return
    if (k.state === 'down') {
      // Still getting up (opening scenario after a parry): he can only react once on his feet.
      this.keeperAlert = { ...al, at: this.time + Math.max(DT, KEEPER_GETUP - k.stateT) }
      return
    }
    const plan = planSave(k, this.aiWorld(), 0)
    if (!plan) return
    if (al.penaltyGuess) {
      const g = al.penaltyGuess
      if (g.habit !== undefined) {
        // Goes where the book says; if the hero changed it up, he is left stranded.
        const ty = zoneY(g.habit)
        if (Math.abs(plan.point.y - ty) < 1.4) this.startDive(k, norm(sub(plan.point, k.pos)), plan.point)
        else if (g.habit !== 1) this.startDive(k, norm(sub({ x: k.pos.x, y: ty }, k.pos)))
        return
      }
      if (g.centre) return
      const actualSide = Math.sign(plan.point.y - k.pos.y) || 1
      const side = g.read ? actualSide : -actualSide
      const target = g.read ? plan.point : { x: k.pos.x, y: GOAL_CENTER_Y + side * 2.6 }
      this.startDive(k, norm(sub(target, k.pos)), g.read ? plan.point : undefined)
      return
    }
    if (!plan.onTarget) return
    const lateral = Math.abs(plan.point.y - k.pos.y)
    if (lateral < 0.55 && plan.z < KEEPER_STAND_MAX_Z) {
      k.intent = { kind: 'run', to: plan.point, until: this.time + 1 }
      return
    }
    // Shuffle across first; commit to the dive so full stretch coincides with the ball's arrival.
    const lead = DIVE_PEAK + 0.04
    if (plan.t > lead + DT * 2) {
      k.intent = { kind: 'run', to: plan.point, until: this.time + 1 }
      this.keeperAlert = { keeper: k, at: this.time + Math.min(0.12, plan.t - lead) }
      return
    }
    this.startDive(k, norm(sub(plan.point, k.pos)), plan.point)
  }

  private onKeeperHold(k: Agent): void {
    const s = this.shot
    if (k.team === 'opp') {
      if (s && s.by.isHero) {
        this.stats.shotsOnTarget++
        this.finish('saved', 'keeper holds hero shot')
      } else if (s && s.by.team === 'hero') {
        this.finish(s.assistBy ? 'pass_complete' : this.heroInvolvedOutcome(), 'keeper holds teammate shot')
      } else {
        this.finish('lost_ball', 'keeper claims')
      }
    } else if (k.isHero && this.phase === 'live' && KEEPER_HOLD_KINDS.has(this.kind) && !this.keeperHold) {
      // Hero keeper: the ball is in his hands, now he decides where it goes (2.1#85).
      this.shot = null
      k.vel = { x: 0, y: 0 }
      this.keeperHold = { until: this.time + KEEPER_HOLD_SECONDS, releasedAt: -1, thrown: false }
    } else {
      this.finish('defended', 'keeper holds')
    }
  }

  /** Six-second rule and the fate of the distribution. Returns true when it ended the moment. */
  private checkKeeperHold(): boolean {
    const h = this.keeperHold
    if (!h) return false
    if (h.releasedAt < 0) {
      if (this.owner !== this.hero) this.keeperHold = null // lost the ball some other way
      else if (this.time >= h.until) {
        this.finish(this.kind === 'gk_distribution' ? 'timeout' : 'defended', 'six seconds')
        return true
      }
      return false
    }
    const o = this.owner
    if (o && o.team === 'hero' && o !== this.hero) {
      this.finish('pass_complete', h.thrown ? 'throw found a team-mate' : 'kick found a team-mate')
      return true
    }
    if (o && o.team === 'opp') {
      this.finish('lost_ball', 'distribution intercepted')
      return true
    }
    if (this.time - h.releasedAt > KEEPER_RELEASE_SECONDS) {
      this.finish(this.kind === 'gk_distribution' ? 'timeout' : 'defended', 'distribution ran out')
      return true
    }
    return false
  }

  // ───────────────────────── Ending ─────────────────────────

  private heroInvolvedOutcome(): HighlightOutcome {
    if (this.stats.passesCompleted > 0) return 'pass_complete'
    // Bringing a long ball down and keeping it is the job done.
    if (this.kind === 'long_ball_control' && this.heroControlled && this.owner?.team === 'hero') return 'pass_complete'
    return 'timeout'
  }

  private onGoal(end: 'west' | 'east'): void {
    this.goalTime = this.time
    if (this.phase !== 'live') return
    const s = this.shot
    if (end === 'east') {
      // Hero team scores.
      let scorer = this.lastTouch && this.lastTouch.team === 'hero' ? this.lastTouch : s && s.by.team === 'hero' ? s.by : null
      if (!scorer && s) scorer = s.by
      const scorerId = scorer ? scorer.id : this.hero.id
      this.events.push({ type: 'goal', team: 'hero', scorerId, end })
      if (scorer?.isHero) {
        this.stats.shotsOnTarget++
        this.finish('goal', 'hero scored', { scorerId: this.hero.id })
      } else if (s?.assistBy || this.assistChain === scorerId || (this.heroDeliveryAt >= 0 && this.time - this.heroDeliveryAt < 4)) {
        this.finish('assist', 'teammate scored from hero pass', { scorerId, assistId: this.hero.id })
      } else {
        this.finish(this.heroInvolvedOutcome(), 'teammate scored', { scorerId })
      }
    } else {
      const scorerId = this.lastTouch && this.lastTouch.team === 'opp' ? this.lastTouch.id : s?.by.id ?? 'opp'
      this.events.push({ type: 'goal', team: 'opp', scorerId, end })
      this.finish('conceded', 'goal against', { scorerId })
    }
    this.postLeft = 2.4
  }

  private onOut(): void {
    if (this.phase !== 'live') return
    const s = this.shot
    if (s && s.by.isHero) {
      if (s.parried) {
        this.stats.shotsOnTarget++
        return this.finish('saved', 'parried out')
      }
      if (s.blocked) return this.finish('blocked', 'blocked out')
      return this.finish(s.woodwork ? 'woodwork' : 'missed', 'shot out')
    }
    if (this.defending) return this.finish('defended', 'ball out')
    if (s && s.by.team === 'hero') return this.finish(s.assistBy ? 'pass_complete' : this.heroInvolvedOutcome(), 'teammate shot out')
    const lt = this.lastTouch
    if (lt && lt.team === 'opp') return this.finish(this.stats.passesCompleted > 0 ? 'pass_complete' : 'timeout', 'opponent put it out')
    return this.finish('lost_ball', 'hero team put it out')
  }

  private checkEnd(): void {
    if (this.phase !== 'live') return
    const o = this.owner
    // Long ball brought down and shielded under pressure: the job is done.
    if (this.kind === 'long_ball_control' && o === this.hero && this.time - this.ownerSince > 1.0) return this.finish('pass_complete', 'held up')
    // hold_up: kept it under the marker long enough for the team to come up.
    if (this.kind === 'hold_up' && o === this.hero && this.time - this.ownerSince > HOLD_UP_SECONDS) return this.finish('pass_complete', 'held up')
    // shoulder_duel: came through the duel with the ball under control.
    if (this.kind === 'shoulder_duel' && o === this.hero && this.time - this.ownerSince > SHOULDER_WON_SECONDS) return this.finish('pass_complete', 'won the duel')
    // press_trap: they played through the press into midfield.
    if (this.kind === 'press_trap' && o && o.team === 'opp' && !o.isKeeper && this.ball.x < PRESS_BEATEN_X) return this.finish('timeout', 'press beaten')
    if (this.keeperHold) {
      if (this.checkKeeperHold()) return
      if (this.keeperHold && this.time < this.timeLimit + KEEPER_HOLD_SECONDS) return
    }
    if (!this.defending) {
      if (o && o.team === 'opp' && !o.isKeeper) {
        this.lossT += DT
        if (this.lossT > 1.1) {
          const s = this.shot
          if (s && s.by.isHero && s.blocked) return this.finish('blocked', 'blocked and cleared')
          if (s && s.by.isHero && s.parried) {
            this.stats.shotsOnTarget++
            return this.finish('saved', 'parried and cleared')
          }
          return this.finish('lost_ball', 'possession lost')
        }
      } else {
        this.lossT = Math.max(0, this.lossT - DT * 2)
      }
      if (this.oppClearedAt > 0 && this.time - this.oppClearedAt > 0.5 && !o) {
        const s = this.shot
        if (s && s.by.isHero && s.blocked) return this.finish('blocked', 'blocked & cleared')
        if (s && s.by.isHero && s.parried) {
          this.stats.shotsOnTarget++
          return this.finish('saved', 'parry cleared')
        }
        if (this.lastTouch?.team === 'opp' && Math.hypot(this.ball.vx, this.ball.vy) > 10) return this.finish('lost_ball', 'cleared')
      }
    } else {
      if (o && o.team === 'hero') {
        return this.finish('defended', 'won possession')
      }
      if (!o && this.lastTouch?.team === 'hero' && !this.lastTouch.isKeeper && this.lastTouch.isHero === false && Math.hypot(this.ball.vx, this.ball.vy) > 12) {
        return this.finish('defended', 'teammate cleared')
      }
    }
    // Penalty: once the shot is dead, resolve.
    if (this.kind === 'penalty' || this.kind === 'gk_penalty') {
      const s = this.shot
      const slow = Math.hypot(this.ball.vx, this.ball.vy, this.ball.vz) < 1.5
      if (s && this.time - s.t > 0.5 && (slow || this.time - s.t > 3)) {
        if (this.kind === 'penalty') {
          if (s.parried) this.stats.shotsOnTarget++
          return this.finish(s.parried ? 'saved' : s.woodwork ? 'woodwork' : 'missed', 'penalty dead')
        }
        return this.finish('defended', 'penalty dead')
      }
    }
    // Time limit — but let a shot/cross in flight resolve (up to 3 s extra).
    if (this.time >= this.timeLimit) {
      const inFlight = !this.owner && Math.hypot(this.ball.vx, this.ball.vy, this.ball.vz) > 4
      if (inFlight && this.time < this.timeLimit + 3) return
      if (this.defending) return this.finish(isKeeperKind(this.kind) ? 'defended' : this.oppShotTaken ? 'shot_conceded' : 'timeout', 'time limit')
      return this.finish(this.heroInvolvedOutcome(), 'time limit')
    }
  }

  private finish(outcomeIn: HighlightOutcome, reason: string, extra: Partial<HighlightResult> = {}): void {
    if (this.result) return
    // Stopping the attacker means stopping the shot: a save by our keeper or a miss after the
    // hero was beaten is a chance conceded, unless the hero himself won the ball back.
    let outcome = outcomeIn
    if (outcome === 'defended' && this.oppShotFree && !(this.owner?.isHero) && this.kind !== 'fk_wall') outcome = 'shot_conceded'
    // fk_wall: anything but a goal means the wall and the keeper did their job.
    // (A long clearance the hero hits that ends with their keeper is the same.)
    if (this.kind === 'fk_wall' && FK_WALL_HELD.has(outcome)) outcome = 'defended'
    // corner_kick: a delivery the defence dealt with is "cleared", not a lost ball.
    if (this.kind === 'corner_kick' && this.cornerChoice && !extra.offside && (outcome === 'lost_ball' || outcome === 'timeout')) outcome = 'cleared'
    this.result = this.buildResult(outcome, extra)
    this.endReason = reason
    this.phase = 'post'
    this.postLeft = outcome === 'goal' || outcome === 'assist' || outcome === 'conceded' ? 2.4 : 1.3
    this.stopBullet()
    this.events.push({ type: 'whistle', long: true })
    this.events.push({ type: 'end', result: this.result, reason })
  }

  // ───────────────────────── Misc ─────────────────────────

  /** True while a shot is being tracked (tests / diagnostics). */
  shotActive(): boolean {
    return this.shot !== null
  }

  /** Current AI world view. */
  aiWorld(): AiWorld {
    return { agents: this.agents, ball: this.ball, owner: this.owner, env: this.env, time: this.time, difficulty: this.difficulty, kind: this.kind, heroStyle: this.heroStyle }
  }

  /** True if the hero is the intended target of the incoming ball (header prompt). */
  get headerChance(): boolean {
    if (this.owner || this.hero.isKeeper || this.ball.z < 0.9) return false
    const c = predictPlaneCrossing(this.ball, this.env, this.hero.pos.x, 1.5)
    return !!c && Math.abs(c.y - this.hero.pos.y) < 3 && c.z > 1 && c.z < 3
  }

  private record(): void {
    // Cross slow-mo: when a delivery is about to reach the hero.
    if (this.crossBulletArmed && !this.owner && this.phase === 'live') {
      const eta = dist(this.ball, this.hero.pos) / Math.max(4, Math.hypot(this.ball.vx, this.ball.vy))
      if (eta < 0.75 && this.ball.z > 0.8) {
        this.crossBulletArmed = false
        this.startBullet(0.4, 0.55 + a01(this.hero.attrs.composure) * 0.4)
      }
    }
    const n = this.agents.length
    const arr = new Float32Array(n * 5)
    for (let i = 0; i < n; i++) {
      const a = this.agents[i]!
      arr[i * 5] = a.pos.x
      arr[i * 5 + 1] = a.pos.y
      arr[i * 5 + 2] = a.z
      arr[i * 5 + 3] = a.facing
      arr[i * 5 + 4] = STATE_CODES.indexOf(a.state)
    }
    this.frames.push({ t: this.time, bx: this.ball.x, by: this.ball.y, bz: this.ball.z, agents: arr })
    const max = Math.round(REPLAY_SECONDS / DT)
    if (this.frames.length > max) this.frames.splice(0, this.frames.length - max)
  }
}

/** Whether the hero's team is defending in a kind. */
export { isDefendingKind, isKeeperKind }

/** Pitch extents for renderers. */
export const PITCH = { length: PITCH_LENGTH, width: PITCH_WIDTH, goalHeight: GOAL_HEIGHT }
