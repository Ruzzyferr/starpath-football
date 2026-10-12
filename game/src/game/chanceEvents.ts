/**
 * The chance events of a moment and of the training drills (owner, build 9): each is ONE stat of the player who
 * attempts it against (where it is a contest) ONE stat of the man he meets, through {@link statChance} — +1 point,
 * +1 %, capped at CHANCE_CAP. The input (timing, approach, a set body) only moves it by a few points (`mod`), and
 * whether the event happens at all is physics (reach, time to get there). The pairs here are the ones the matchup
 * card shows ("Top kapma şansı %58 — Müdahale 70 vs Dripling 62").
 */
import type { AttributeKey, Attributes } from '../core/types'
import { statChance } from './statChance'

type Who = { attrs: Attributes }
const v = (a: Who, k: AttributeKey): number => a.attrs[k] ?? 50

/** A chance event: who attempts it, with which stat, against which stat of the man he meets. */
export interface ChanceEventDef {
  /** i18n key under match.live.matchup.events (the card's label). */
  id: ChanceEventId
  stat: AttributeKey
  opp?: AttributeKey
}

export type ChanceEventId = 'tackle' | 'takeOn' | 'shoulder' | 'aerial' | 'read' | 'firstTouch' | 'hold' | 'smother' | 'penaltyRead' | 'shift' | 'clean' | 'keepFeet' | 'call'

export const CHANCE_EVENTS: Readonly<Record<ChanceEventId, ChanceEventDef>> = {
  /** Wins the ball in a challenge (standing or slide). */
  tackle: { id: 'tackle', stat: 'tackling', opp: 'dribbling' },
  /** A challenge that does not win it stays clean (else it is a foul). */
  clean: { id: 'clean', stat: 'tackling' },
  /** Beats the man with the ball at his feet (a skill move / take-on). */
  takeOn: { id: 'takeOn', stat: 'dribbling', opp: 'tackling' },
  /** Comes through a shoulder-to-shoulder contact. */
  shoulder: { id: 'shoulder', stat: 'strength', opp: 'strength' },
  /** Stays on his feet when he loses one. */
  keepFeet: { id: 'keepFeet', stat: 'balance', opp: 'strength' },
  /** Wins a header against the man he goes up with. */
  aerial: { id: 'aerial', stat: 'heading', opp: 'heading' },
  /** Reads a pass he is in the way of and gets a foot on it. */
  read: { id: 'read', stat: 'anticipation', opp: 'passing' },
  /** Brings a hard ball under control with his first touch. */
  firstTouch: { id: 'firstTouch', stat: 'firstTouch' },
  /** A keeper holds the ball he got to (else he parries / punches). */
  hold: { id: 'hold', stat: 'handling' },
  /** A keeper going down at a dribbler's feet takes it. */
  smother: { id: 'smother', stat: 'handling', opp: 'dribbling' },
  /** A keeper reads a penalty taker's side. */
  penaltyRead: { id: 'penaltyRead', stat: 'gkPositioning', opp: 'composure' },
  /** A set shooter sells the shift to the defender closing him down. */
  shift: { id: 'shift', stat: 'dribbling', opp: 'agility' },
  /** A team-mate plays it to the hero when he calls for it. */
  call: { id: 'call', stat: 'vision' },
}

/** Chance (0..1) that `a` succeeds at event `id` against `b` (if the event is a contest), moved by `mod` points. */
export function eventChance(id: ChanceEventId, a: Who, b?: Who, mod = 0): number {
  const d = CHANCE_EVENTS[id]
  return statChance(v(a, d.stat), d.opp && b ? v(b, d.opp) : undefined, mod)
}

/** Event chance from explicit stat values (the opponent stat swapped for another one: a shield is Strength). */
export const eventChanceOf = (stat: number, opp?: number, mod = 0): number => statChance(stat, opp, mod)

/**
 * Input adjustments, in percentage points (documented so the card and BALANCE.md can show them):
 * timing ±20 (a challenge as the ball leaves his foot / a take-on as the man steps in), from behind −20, a lunge
 * −40 at worst (pressed from well out of reach / barging in at a sprint), a slide −5, a shield +15 for the body
 * in the way, a heavy ball −3 per m/s over the easy pace.
 */
export const CHANCE_MOD = { timing: 20, behind: -20, lunge: -40, slide: -5, shield: 15, heavyPerMs: -3, cleanStanding: 30, cleanSlide: 10 } as const

/** A ball arriving at most this fast (m/s, relative to him) is simply controlled; above it First Touch decides. */
export const CONTROL_EASY = 8

/**
 * First touch on a ball arriving `rel` m/s (relative): certain up to CONTROL_EASY (physics: a soft ball); then First
 * Touch +1 % a point, +50, minus 3 points per m/s over the easy pace, plus `helpPts` (receiving help).
 */
export function firstTouchChance(receiver: Who, rel: number, helpPts = 0): number {
  if (rel <= CONTROL_EASY) return 1
  return eventChance('firstTouch', receiver, undefined, 50 + CHANCE_MOD.heavyPerMs * (rel - CONTROL_EASY) + helpPts)
}
