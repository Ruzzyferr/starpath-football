/**
 * Contextual control hints for match moments and training drills.
 *
 * Pure selection logic (which hint, which platform, when it is "learned") plus
 * a tiny reactive input-platform detector. The overlay is ControlHint.tsx.
 */
import { signal } from '@preact/signals'

export type HintGroup = 'shoot' | 'pass' | 'move' | 'header' | 'defend' | 'keeper' | 'setPiece' | 'fitness' | 'cross' | 'headMachine' | 'tackleDuel' | 'distribute' | 'cornerPick' | 'wallSet' | 'claim'
export type InputPlatform = 'touch' | 'mouse' | 'pad'
export type HintContext = 'match' | 'drill'

/** Highlight kind → hint groups, most relevant first. */
export const MATCH_GROUPS: Record<string, HintGroup[]> = {
  build_up: ['pass', 'move', 'shoot'],
  counter: ['move', 'shoot', 'pass'],
  one_on_one: ['shoot', 'move'],
  cross: ['pass', 'shoot'],
  edge_of_box: ['shoot'],
  freekick: ['setPiece'],
  penalty: ['shoot'],
  corner: ['header'],
  defend: ['defend'],
  gk_save: ['keeper'],
  gk_penalty: ['keeper'],
  counter_2v1: ['pass', 'shoot', 'move'],
  long_ball_control: ['move', 'shoot'],
  rebound: ['shoot'],
  interception: ['defend'],
  hold_up: ['move', 'pass'],
  defend_1v1: ['defend'],
  block: ['defend'],
  corner_kick: ['cornerPick', 'header'],
  fk_wall: ['wallSet', 'keeper'],
  dribble: ['move', 'shoot'],
  header: ['header'],
  gk_1v1: ['keeper'],
  gk_sweep: ['keeper', 'move'],
  back_post: ['header', 'defend'],
  long_shot: ['shoot'],
  switch_play: ['pass', 'move'],
  recovery_run: ['move', 'defend'],
  shoulder_duel: ['move', 'shoot'],
  timed_run: ['move', 'shoot'],
  press_trap: ['defend', 'move'],
  gk_claim: ['claim', 'keeper'],
  gk_distribution: ['distribute'],
}

const DRILL_GROUPS: Record<string, HintGroup> = {
  finishing: 'shoot',
  setPiece: 'setPiece',
  passing: 'pass',
  dribbling: 'move',
  fitness: 'fitness',
  goalkeeping: 'keeper',
  crossing: 'cross',
  heading: 'headMachine',
  tackling: 'tackleDuel',
  distribution: 'distribute',
}

export const hintId = (ctx: HintContext, g: HintGroup) => `${ctx}:${g}`

/** The first not-yet-learned hint for a highlight kind (null = nothing to teach). */
export function pickMatchHint(kind: string, seen: (id: string) => boolean): HintGroup | null {
  const groups = MATCH_GROUPS[kind] ?? ['shoot']
  return groups.find((g) => !seen(hintId('match', g))) ?? null
}

/** Hint for a drill's first run (null once learned). */
export function pickDrillHint(drill: string, variant: string | undefined, seen: (id: string) => boolean): HintGroup | null {
  const g = DRILL_GROUPS[variant === 'setPiece' ? 'setPiece' : drill] ?? null
  return g && !seen(hintId('drill', g)) ? g : null
}

/** Minimal shape shared by match RuntimeEvents and training DrillEvents. */
export interface HintEvent {
  type: string
  hero?: boolean
  by?: string
  kick?: string
  good?: boolean
  ok?: boolean
  success?: boolean
  won?: boolean
}

const SHOTS = new Set(['shot', 'chip', 'penalty', 'freekick', 'header'])
const PASSES = new Set(['pass', 'lofted', 'through', 'cross'])

/** Did this event show the player performed the hinted action successfully? */
export function isHintSuccess(g: HintGroup, e: HintEvent, heroId?: string | null): boolean {
  const byHero = e.hero === true || (!!heroId && e.by === heroId)
  // Drill kicks carry `hero` but no kick kind.
  const heroKick = e.type === 'kick' && byHero
  switch (g) {
    case 'shoot':
      return heroKick && (e.kick === undefined || SHOTS.has(e.kick))
    case 'setPiece':
      return heroKick && (e.kick === undefined || e.kick === 'freekick' || SHOTS.has(e.kick))
    case 'pass':
      return heroKick && (e.kick === undefined || PASSES.has(e.kick))
    case 'header':
      return (heroKick && e.kick === 'header') || (e.type === 'header' && byHero)
    case 'move':
      return (e.type === 'dribble' && byHero) || (e.type === 'skill' && (byHero || e.ok === true)) || e.type === 'cone'
    case 'defend':
      return e.type === 'tackle' && byHero
    case 'keeper':
      return (e.type === 'dive' && (byHero || e.by === undefined)) || (e.type === 'save' && byHero)
    case 'cross':
      return heroKick
    case 'distribute':
      return heroKick
    case 'headMachine':
      return heroKick || (e.type === 'header' && byHero)
    case 'tackleDuel':
      return (e.type === 'tackle' && byHero) || (e.type === 'skill' && e.ok === true)
    case 'cornerPick':
      return heroKick || e.type === 'setPieceChoice'
    case 'wallSet':
      return e.type === 'setPieceChoice'
    case 'claim':
      return (e.type === 'jump' && byHero) || (e.type === 'save' && byHero)
    case 'fitness':
      return e.type === 'score' && e.good === true
    default:
      return false
  }
}

/** Which gesture illustration fits a hint on a platform. */
export function gestureFor(g: HintGroup, p: InputPlatform): 'swipe' | 'tap' | 'click' | 'keys' {
  if (p === 'pad') return 'keys'
  if (g === 'cornerPick' || g === 'wallSet') return p === 'mouse' ? 'keys' : 'tap'
  if (p === 'mouse') return g === 'move' || g === 'defend' || g === 'fitness' || g === 'tackleDuel' ? 'keys' : 'click'
  return g === 'shoot' || g === 'setPiece' || g === 'keeper' ? 'swipe' : g === 'move' ? 'swipe' : 'tap'
}

// ───────────────────────── Input platform ─────────────────────────

function initialPlatform(): InputPlatform {
  if (typeof window === 'undefined') return 'mouse'
  try {
    if (navigator.getGamepads?.().some((p) => !!p && p.connected)) return 'pad'
  } catch {
    /* not allowed */
  }
  return ('ontouchstart' in window) || window.matchMedia?.('(pointer: coarse)').matches === true ? 'touch' : 'mouse'
}

export const inputPlatform = signal<InputPlatform>(initialPlatform())

let watching = false
/** Track the last input device the player used (idempotent). */
export function watchInputPlatform(): void {
  if (watching || typeof window === 'undefined') return
  watching = true
  window.addEventListener('pointerdown', (e) => {
    const p: InputPlatform = e.pointerType === 'mouse' ? 'mouse' : 'touch'
    if (inputPlatform.value !== p) inputPlatform.value = p
  }, { capture: true, passive: true })
  window.addEventListener('keydown', () => {
    if (inputPlatform.value === 'touch') inputPlatform.value = 'mouse'
  }, { capture: true, passive: true })
  window.addEventListener('gamepadconnected', () => (inputPlatform.value = 'pad'))
  window.addEventListener('gamepaddisconnected', () => (inputPlatform.value = initialPlatform()))
}

// ───────────────────────── Event bus (scene → overlay) ─────────────────────────

type HintListener = (e: HintEvent, heroId: string | null) => void
const listeners = new Set<HintListener>()

/** Subscribe to gameplay events forwarded from the Phaser scenes. Returns the unsubscribe. */
export function onHintEvent(fn: HintListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Forward a gameplay event (called by the highlight bridge / drill overlay). */
export function emitHintEvent(e: HintEvent, heroId: string | null = null): void {
  if (!listeners.size) return
  for (const fn of [...listeners]) fn(e, heroId)
}
