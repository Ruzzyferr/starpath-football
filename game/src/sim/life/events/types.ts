/**
 * Decision-card ("life event") contracts.
 *
 * An {@link EventDef} is pure data + small pure functions. Content files only
 * *describe* consequences by returning an {@link EffectResult}; the engine
 * (`engine.ts → applyEffectResult`) is the single place that mutates
 * GameState. That keeps content testable and saves deterministic.
 */
import type { AttributeKey, BusinessKind, GameState, LText, RelationKind } from '../../../core/types'
import type { Rng } from '../../../core/rng'

/** Narrative categories. Used for variety balancing and UI theming. */
export type EventCategory =
  | 'teammates'
  | 'manager'
  | 'club'
  | 'family'
  | 'romance'
  | 'friends'
  | 'press'
  | 'social'
  | 'fans'
  | 'nightlife'
  | 'money'
  | 'casino'
  | 'health'
  | 'national'
  | 'awards'
  | 'rivals'
  | 'community'
  | 'transfer'
  | 'milestone'
  | 'weird'
  | 'legal'
  | 'scam'
  | 'rumour'
  | 'business'
  | 'charity'
  | 'mentor'

export const EVENT_CATEGORIES: readonly EventCategory[] = [
  'teammates', 'manager', 'club', 'family', 'romance', 'friends', 'press', 'social', 'fans', 'nightlife',
  'money', 'casino', 'health', 'national', 'awards', 'rivals', 'community', 'transfer', 'milestone', 'weird',
  'legal', 'scam', 'rumour', 'business', 'charity', 'mentor',
]

/**
 * Situation tags the game loop passes to `rollEvents`. An event with
 * `triggers` is only eligible when at least one of its triggers is in the
 * rolled tags. An event *without* triggers is "ambient" and is eligible only
 * on the `'weekly'` roll.
 */
export type EventTag =
  | 'weekly'
  | 'match_win'
  | 'match_loss'
  | 'match_draw'
  | 'post_match'
  | 'scored'
  | 'injury'
  | 'transfer_window'
  | 'nightlife'
  | 'casino'
  | 'new_season'
  | 'season_end'
  | 'training'
  | 'benched'
  | 'big_money'
  | 'national_break'
  | 'shopping'
  | 'social_post'

/** Template variables (names, amounts) resolved when an event fires. */
export type EventVars = Record<string, string | number>

/** Read-only context handed to conditions, vars, requires and effects. */
export interface EventCtx {
  /** Live state. Content functions must treat it as read-only. */
  readonly state: GameState
  /** Resolved variables (standard vars + event vars). Empty inside `conditions`. */
  readonly vars: EventVars
  /** Absolute week index, see `absoluteWeek()` in engine.ts. */
  readonly absWeek: number
  /** Tags of the roll that fired (or is evaluating) the event. */
  readonly tags: readonly string[]
}

export type StatKey =
  | 'happiness'
  | 'health'
  | 'stress'
  | 'energy'
  | 'morale'
  | 'form'
  | 'fatigue'
  | 'sharpness'
  | 'managerTrust'
  | 'addiction'

/**
 * A single state change. Deltas are both applied (by the engine) and shown
 * to the player as chips, so one list serves logic and UI.
 */
export type Delta =
  | { kind: 'money'; amount: number }
  | {
      kind: 'relation'
      /** Relationship kind to affect. With `npcId`, a specific teammate. `'teammate'` alone = whole dressing room. */
      target: RelationKind
      amount: number
      /** Specific NPC (teammate/rival); the relationship is created if missing. */
      npcId?: string
      /** Display name; also used to create a missing relationship (e.g. a new partner). */
      name?: string
      /** Exact relationship id (`life.relationships[id]`); nothing happens if it does not exist. */
      relId?: string
    }
  | { kind: 'stat'; key: StatKey; amount: number }
  | { kind: 'attr'; key: AttributeKey; amount: number }
  | { kind: 'reputation'; amount: number }
  | { kind: 'followers'; amount: number }
  | { kind: 'discipline'; amount: number }
  | { kind: 'injury'; weeks: number; name: LText }
  | { kind: 'suspension'; matches: number }
  /** Morality-clause scandal: sponsors drop out (level 4 = all of them; see sim/life/sponsors). */
  | { kind: 'sponsorLoss'; level: 1 | 2 | 3 | 4 }
  /** Starts a fixed objective (sim/game/objectives presets). */
  | { kind: 'objective'; preset: 'prove_yourself' | 'dev_focus' }
  /** Removes a relationship (break-up, falling out). */
  | { kind: 'endRelation'; target: RelationKind; npcId?: string }
  /** Brand reputation of an owned business (life/business); no-op without one. */
  | {
      kind: 'brand'
      amount: number
      business?: BusinessKind
      /** Temporary revenue multiplier for N weeks (marketing push > 1, crisis < 1). */
      boost?: { mult: number; weeks: number }
      /** Hire (true) or let go (false) the general manager. */
      manager?: boolean
      /** Free expansion: +1 level (max 3); `invest` is added to the resale basis. */
      expand?: { invest: number }
    }

/** Delta after application: amounts are the *actual* change after clamping. */
export type AppliedDelta = Delta & { label?: string }

export interface FollowUp {
  eventId: string
  /** 0 = may fire later the same week; 1 = next week… */
  inWeeks: number
  /** Extra vars passed to the follow-up (merged over the parent's vars). */
  vars?: EventVars
}

export type FlagValue = number | string | boolean

export interface NewsSpec {
  headline: LText
  body?: LText
  sentiment: -1 | 0 | 1
  source?: string
}

/** What a choice did. Text may contain {placeholders} resolved with the event's vars. */
export interface EffectResult {
  text: LText
  deltas: Delta[]
  followUps?: FollowUp[]
  /** Set flags; `null` deletes the flag. */
  setFlags?: Record<string, FlagValue | null>
  /** Increment numeric flags (missing = 0). */
  addFlags?: Record<string, number>
  news?: NewsSpec
}

/** Result returned to the UI after the engine applied an effect. */
export interface ResolvedEffect {
  /** Outcome text with placeholders already resolved, both languages. */
  text: LText
  /** Deltas actually applied (clamped amounts, zero-change and impossible ones removed). */
  deltas: AppliedDelta[]
  followUps: FollowUp[]
  news?: NewsSpec
}

export interface ChoiceDef {
  label: LText
  hint?: LText
  risk?: 'low' | 'medium' | 'high'
  /** Gate (money, relationship level…). A locked choice is shown disabled. */
  requires?: (ctx: EventCtx) => boolean
  /** Shown when `requires` fails, e.g. "Not enough money". */
  lockedHint?: LText
  effects: (ctx: EventCtx, rng: Rng) => EffectResult
}

export interface EventDef {
  /** Unique, `category.slug`. */
  id: string
  category: EventCategory
  /** Base weight (≈ 1 = normal, 0.3 = rare, 3 = common) or a function of state. */
  weight: number | ((ctx: EventCtx) => number)
  /** Weeks before the same event can fire again. */
  cooldownWeeks: number
  /** Fires at most once per career. */
  once?: boolean
  /** Fires at most this many times per career ("kariyerde en fazla 2"). */
  maxPerCareer?: number
  /** Only reachable as a scheduled follow-up of another event (chain step). */
  followUpOnly?: boolean
  /** Earliest week of the season (calendar.week) at which it may fire. */
  minWeek?: number
  /**
   * Minimum hero age. Defaults to 18 for the `casino` and `nightlife`
   * categories (gambling, betting, alcohol) — see `eventMinAge`.
   */
  minAge?: number
  conditions: (ctx: EventCtx) => boolean
  triggers?: EventTag[]
  vars?: (ctx: EventCtx, rng: Rng) => EventVars
  title: LText
  text: LText
  /** Emoji or icon key for the card and log. */
  icon: string
  choices: ChoiceDef[]
}
