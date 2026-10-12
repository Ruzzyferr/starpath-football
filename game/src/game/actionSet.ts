/**
 * Context buttons for match moments (TestFlight build 6 feedback: "every mini-game shows SPRINT and SKILL").
 *
 * Each highlight kind gets 2–4 buttons that make sense for what the hero is doing *right now*
 * (on the ball, off it, defending, keeping goal, ball in the keeper's hands). Every button maps to a
 * real runtime mechanic ({@link HeroAction} `btn`, or a hold read by the runtime every step) that
 * leans on the relevant attributes; a button that would do nothing in that context is not shown.
 *
 * Pure module: no DOM, no Phaser. The scene draws the buttons, the input layer hit-tests them.
 */
import type { HighlightKind } from '../sim/match/types'
import type { BindAction } from '../input/bindings'

/** Every context button the match knows. */
export type ActionId =
  // Carrying the ball.
  | 'sprint' | 'skill' | 'shield'
  // Kicks on the ball.
  | 'pass' | 'through' | 'lofted' | 'cross' | 'shoot'
  // Attacking off the ball.
  | 'call' | 'head' | 'jump'
  // Defending.
  | 'tackle' | 'slide' | 'jockey' | 'block' | 'intercept' | 'press'
  // Goalkeeper.
  | 'dive' | 'diveLeft' | 'diveRight' | 'stay' | 'rush' | 'claim' | 'punch' | 'throw' | 'kick'

/** Buttons held down (continuous) rather than tapped. */
export type HoldId = 'sprint' | 'jockey' | 'shield'

export type ActionPhase = 'ball' | 'off' | 'def' | 'gk' | 'gkHands'

export type ActionIcon =
  | 'bolt' | 'swerve' | 'shield' | 'pass' | 'through' | 'lofted' | 'cross' | 'goal' | 'hand' | 'head' | 'jump'
  | 'boot' | 'slide' | 'contain' | 'block' | 'intercept' | 'press' | 'dive' | 'diveL' | 'diveR' | 'stay' | 'rush'
  | 'glove' | 'fist' | 'throw' | 'kick'

export interface ActionDef {
  id: ActionId
  label: { tr: string; en: string }
  icon: ActionIcon
  hold: boolean
  /** Keyboard binding (by action) the button answers to, most wanted first. */
  keys: readonly BindAction[]
  /** Accent colour (0xRRGGBB): attack gold, defence red, keeper teal, movement white. */
  tone: number
}

const GOLD = 0xffc83d
const RED = 0xff5a4e
const TEAL = 0x3fd6c6
const WHITE = 0xf2f5ff
const BLUE = 0x6fb2ff

export const ACTION_DEFS: Readonly<Record<ActionId, ActionDef>> = {
  sprint: { id: 'sprint', label: { tr: 'DEPAR', en: 'SPRINT' }, icon: 'bolt', hold: true, keys: ['sprint'], tone: WHITE },
  skill: { id: 'skill', label: { tr: 'ÇALIM', en: 'SKILL' }, icon: 'swerve', hold: false, keys: ['skill', 'action'], tone: GOLD },
  shield: { id: 'shield', label: { tr: 'KORU', en: 'SHIELD' }, icon: 'shield', hold: true, keys: ['chip', 'action', 'skill'], tone: BLUE },
  pass: { id: 'pass', label: { tr: 'PAS', en: 'PASS' }, icon: 'pass', hold: false, keys: ['pass'], tone: GOLD },
  through: { id: 'through', label: { tr: 'ARA PAS', en: 'THROUGH' }, icon: 'through', hold: false, keys: ['through'], tone: GOLD },
  lofted: { id: 'lofted', label: { tr: 'UZUN TOP', en: 'LONG BALL' }, icon: 'lofted', hold: false, keys: ['chip', 'action'], tone: GOLD },
  cross: { id: 'cross', label: { tr: 'ORTA', en: 'CROSS' }, icon: 'cross', hold: false, keys: ['chip', 'action'], tone: GOLD },
  shoot: { id: 'shoot', label: { tr: 'ŞUT', en: 'SHOOT' }, icon: 'goal', hold: false, keys: ['shoot'], tone: GOLD },
  call: { id: 'call', label: { tr: 'TOP İSTE', en: 'CALL' }, icon: 'hand', hold: false, keys: ['call'], tone: WHITE },
  head: { id: 'head', label: { tr: 'KAFA', en: 'HEAD' }, icon: 'head', hold: false, keys: ['action', 'skill'], tone: GOLD },
  jump: { id: 'jump', label: { tr: 'ZIPLA', en: 'JUMP' }, icon: 'jump', hold: false, keys: ['action', 'skill'], tone: BLUE },
  tackle: { id: 'tackle', label: { tr: 'MÜDAHALE', en: 'TACKLE' }, icon: 'boot', hold: false, keys: ['action'], tone: RED },
  slide: { id: 'slide', label: { tr: 'KAYARAK', en: 'SLIDE' }, icon: 'slide', hold: false, keys: ['skill', 'action'], tone: RED },
  jockey: { id: 'jockey', label: { tr: 'KARŞILA', en: 'JOCKEY' }, icon: 'contain', hold: true, keys: ['chip', 'skill', 'action'], tone: BLUE },
  block: { id: 'block', label: { tr: 'BLOK', en: 'BLOCK' }, icon: 'block', hold: false, keys: ['action', 'skill'], tone: RED },
  intercept: { id: 'intercept', label: { tr: 'ARAYA GİR', en: 'INTERCEPT' }, icon: 'intercept', hold: false, keys: ['action', 'skill'], tone: RED },
  press: { id: 'press', label: { tr: 'BASKI', en: 'PRESS' }, icon: 'press', hold: false, keys: ['skill', 'action'], tone: RED },
  dive: { id: 'dive', label: { tr: 'UZAN', en: 'DIVE' }, icon: 'dive', hold: false, keys: ['action', 'skill'], tone: TEAL },
  diveLeft: { id: 'diveLeft', label: { tr: 'SOLA', en: 'LEFT' }, icon: 'diveL', hold: false, keys: ['pass'], tone: TEAL },
  diveRight: { id: 'diveRight', label: { tr: 'SAĞA', en: 'RIGHT' }, icon: 'diveR', hold: false, keys: ['chip'], tone: TEAL },
  stay: { id: 'stay', label: { tr: 'ORTADA KAL', en: 'STAY' }, icon: 'stay', hold: false, keys: ['skill', 'action'], tone: TEAL },
  rush: { id: 'rush', label: { tr: 'ÇIK', en: 'RUSH' }, icon: 'rush', hold: false, keys: ['skill', 'action'], tone: TEAL },
  claim: { id: 'claim', label: { tr: 'YAKALA', en: 'CLAIM' }, icon: 'glove', hold: false, keys: ['action', 'skill'], tone: TEAL },
  punch: { id: 'punch', label: { tr: 'YUMRUKLA', en: 'PUNCH' }, icon: 'fist', hold: false, keys: ['skill', 'action'], tone: TEAL },
  throw: { id: 'throw', label: { tr: 'ELLE AT', en: 'THROW' }, icon: 'throw', hold: false, keys: ['pass', 'action'], tone: TEAL },
  kick: { id: 'kick', label: { tr: 'VURUŞ', en: 'KICK' }, icon: 'kick', hold: false, keys: ['through', 'skill'], tone: TEAL },
}

type KindSets = Partial<Record<ActionPhase, readonly ActionId[]>>

/** Fallback per phase (kinds only list what differs). */
const DEFAULT_SETS: Readonly<Record<ActionPhase, readonly ActionId[]>> = {
  ball: ['pass', 'shoot', 'skill', 'sprint'],
  off: ['sprint', 'call'],
  def: ['tackle', 'slide', 'jockey', 'sprint'],
  gk: ['dive', 'rush'],
  gkHands: ['throw', 'kick'],
}

/** Per highlight kind: which buttons, most important first (2–4 each). */
export const KIND_ACTIONS: Readonly<Record<HighlightKind, KindSets>> = {
  build_up: { ball: ['pass', 'through', 'skill', 'sprint'], off: ['sprint', 'call'] },
  counter: { ball: ['sprint', 'pass', 'shoot', 'skill'], off: ['sprint', 'call'] },
  one_on_one: { ball: ['shoot', 'skill', 'sprint'], off: ['sprint', 'call'] },
  cross: { ball: ['cross', 'pass', 'sprint'], off: ['head', 'sprint', 'call'] },
  edge_of_box: { ball: ['shoot', 'pass', 'skill', 'sprint'], off: ['sprint', 'call'] },
  freekick: { ball: [], off: ['head', 'sprint'] },
  penalty: { ball: [], off: ['shoot', 'sprint'] },
  corner: { ball: ['shoot', 'pass'], off: ['head', 'sprint'] },
  defend: { def: ['tackle', 'slide', 'jockey', 'sprint'] },
  gk_save: { gk: ['dive', 'stay'] },
  gk_penalty: { gk: ['diveLeft', 'stay', 'diveRight'] },
  counter_2v1: { ball: ['pass', 'shoot', 'sprint'], off: ['sprint', 'call'] },
  long_ball_control: { ball: ['shield', 'pass', 'shoot', 'sprint'], off: ['sprint', 'call'] },
  rebound: { ball: ['shoot', 'pass'], off: ['shoot', 'sprint'] },
  interception: { def: ['intercept', 'tackle', 'jockey', 'sprint'] },
  hold_up: { ball: ['shield', 'pass', 'skill'], off: ['sprint', 'call'] },
  defend_1v1: { def: ['jockey', 'tackle', 'slide', 'sprint'] },
  block: { def: ['block', 'slide', 'sprint'] },
  corner_kick: { ball: [], off: ['head', 'sprint'] },
  fk_wall: { def: ['jump', 'block'], gk: ['dive', 'stay'] },
  dribble: { ball: ['skill', 'sprint', 'shoot'], off: ['sprint', 'call'] },
  header: { off: ['head', 'sprint'], ball: ['shoot', 'pass'] },
  gk_1v1: { gk: ['rush', 'dive', 'stay'] },
  gk_sweep: { gk: ['rush', 'sprint', 'dive'] },
  back_post: { def: ['head', 'intercept', 'sprint'] },
  long_shot: { ball: ['shoot', 'skill', 'sprint'], off: ['sprint', 'call'] },
  switch_play: { ball: ['lofted', 'pass', 'sprint'], off: ['sprint', 'call'] },
  recovery_run: { def: ['sprint', 'slide', 'tackle'] },
  shoulder_duel: { ball: ['shield', 'sprint', 'shoot'], off: ['sprint', 'call'] },
  timed_run: { ball: ['shoot', 'skill', 'sprint'], off: ['sprint', 'call'] },
  press_trap: { def: ['press', 'intercept', 'tackle', 'sprint'] },
  gk_claim: { gk: ['claim', 'punch', 'dive'] },
  gk_distribution: { gkHands: ['throw', 'kick'] },
}

/** Snapshot the button logic needs (read off the runtime each frame). */
export interface ActionContext {
  kind: HighlightKind
  heroIsKeeper: boolean
  heroOnBall: boolean
  /** The hero is the set-piece taker (swipe / picker only: no buttons). */
  heroTaker: boolean
  /** An opponent has the ball, or the moment is a defensive one and nobody of ours does. */
  oppInPossession: boolean
}

/** Which situation the hero is in. */
export function actionPhase(c: ActionContext): ActionPhase {
  if (c.heroIsKeeper) return c.heroOnBall ? 'gkHands' : 'gk'
  if (c.heroOnBall) return 'ball'
  return c.oppInPossession ? 'def' : 'off'
}

/** The buttons for this kind in this phase. */
export function actionsFor(kind: HighlightKind, phase: ActionPhase): readonly ActionId[] {
  const own = KIND_ACTIONS[kind]?.[phase]
  if (own) return own
  // A keeper on the ball outside a distribution kind (held a shot, swept it up) distributes like one.
  return DEFAULT_SETS[phase]
}

/** Buttons for a live context (none while the hero takes a set piece). */
export function contextActions(c: ActionContext): readonly ActionId[] {
  if (c.heroTaker) return []
  return actionsFor(c.kind, actionPhase(c))
}

/**
 * Keyboard key per button: each id takes its first wanted binding not already used by an earlier
 * button of the same set (so a set never has two buttons on one key).
 */
export function assignKeys(ids: readonly ActionId[]): Map<ActionId, BindAction> {
  const used = new Set<BindAction>()
  const out = new Map<ActionId, BindAction>()
  const pool: BindAction[] = ['action', 'skill', 'chip', 'pass', 'through', 'shoot', 'call']
  for (const id of ids) {
    const want = [...ACTION_DEFS[id].keys, ...pool].find((k) => !used.has(k))
    if (!want) continue
    used.add(want)
    out.set(id, want)
  }
  return out
}

/** Hold buttons in a set. */
export const isHold = (id: ActionId): id is HoldId => ACTION_DEFS[id].hold
