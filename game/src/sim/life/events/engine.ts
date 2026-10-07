/**
 * Life-event engine: picks decision cards, resolves template variables and
 * applies the consequences of a choice to GameState.
 *
 * ## Storage (all inside `life.flags`, so no core type changes are needed)
 * - `ev:followups` — JSON string of {@link QueuedFollowUp}[]: scheduled chain
 *   steps `{ id, due, vars, from }`, `due` being an absolute week.
 * - `ev:week` / `ev:weekCount` / `ev:weekRegular` — anti-spam counters for the
 *   current absolute week (all events / non-follow-up events).
 * - `ev:recentCats` — JSON string array of the last {@link RECENT_CATEGORY_MEMORY}
 *   fired categories (variety balancing).
 * - `life.eventHistory[eventId]` — absolute week the event last fired
 *   (cooldowns and `once`).
 * - Content flags (chains) use plain keys such as `romance_stage`.
 *
 * Absolute week = career/common `absWeek` ((season − START_YEAR)·52 + week, see {@link absoluteWeek}); monotonic
 * across seasons because a season never exceeds 52 weeks.
 */
import type { Calendar, GameState, Lang, LText, NpcPlayer, PendingEvent, RelationKind, Relationship } from '../../../core/types'
import { clamp, type Rng } from '../../../core/rng'
import { heroGender } from '../../../core/gender'
import { ALL_EVENTS } from './content'
import { ADULT_AGE, absWeek, heroAge } from '../../career/common'
import { recordRelationChange, teammateId } from '../relationships'
import type {
  AppliedDelta,
  Delta,
  EffectResult,
  EventCategory,
  EventCtx,
  EventDef,
  EventVars,
  FollowUp,
  ResolvedEffect,
} from './types'
import { contentFlags } from '../../../core/contentFlags'

// ───────────────────────── Tunables ─────────────────────────

/** Hard cap of event cards per week (follow-ups included). */
export const MAX_EVENTS_PER_WEEK = 3
/** Cap for spontaneous (non-follow-up) events per week. */
export const MAX_REGULAR_PER_WEEK = 2
/** Never stack more unanswered cards than this. */
export const MAX_PENDING = 3
/** A due follow-up whose conditions keep failing is dropped after this many weeks. */
export const FOLLOWUP_GRACE_WEEKS = 6
export const RECENT_CATEGORY_MEMORY = 8
/** Each recent occurrence of a category multiplies its weight by this. */
export const CATEGORY_REPEAT_PENALTY = 0.4
/** Chance that a roll produces its first card, by tag (max over tags). */
export const TAG_FIRE_CHANCE: Record<string, number> = {
  weekly: 0.9,
  post_match: 0.4,
  match_win: 0.45,
  match_loss: 0.45,
  match_draw: 0.3,
  scored: 0.3,
  injury: 0.7,
  transfer_window: 0.5,
  nightlife: 0.75,
  casino: 0.6,
  new_season: 0.9,
  season_end: 0.8,
  training: 0.2,
  benched: 0.5,
  big_money: 0.6,
  national_break: 0.6,
  shopping: 0.4,
  social_post: 0.6,
}
/**
 * Event cards are a side dish for fame, not the main course (balance pass,
 * docs/BALANCE.md): they used to add +13–20 reputation a season — more than
 * matches. Gains are halved and shrink as fame grows (×0.45 at 0, ×0.18 at
 * 50, ×0.04 at 85); losses apply in full (scandals still hurt).
 */
export const EVENT_REP_SCALE = 0.33
export const eventRepGain = (rep: number, amount: number): number =>
  amount > 0 ? amount * EVENT_REP_SCALE * Math.pow(Math.max(0, 1 - rep / 100), 1.3) : amount

/** Each extra card in the same roll is this much less likely than the previous. */
export const EXTRA_CARD_FACTOR = 0.5
export const CURRENCY_SYMBOL = '€'

export const FLAG_FOLLOWUPS = 'ev:followups'
export const FLAG_WEEK = 'ev:week'
export const FLAG_WEEK_COUNT = 'ev:weekCount'
export const FLAG_WEEK_REGULAR = 'ev:weekRegular'
export const FLAG_RECENT_CATS = 'ev:recentCats'
/** JSON map eventId → times fired this career (for `maxPerCareer`). */
export const FLAG_COUNTS = 'ev:counts'

/** Times an event fired this career. */
export function careerCount(state: GameState, id: string): number {
  return readJson<Record<string, number>>(state, FLAG_COUNTS, {})[id] ?? 0
}

// ───────────────────────── Registry ─────────────────────────

export interface QueuedFollowUp {
  id: string
  /** Absolute week from which it may fire. */
  due: number
  vars: EventVars
  /** Parent event id (debugging / UI "because…"). */
  from: string
}

export interface RollOptions {
  /** Event pool (defaults to ALL_EVENTS). Tests inject small pools. */
  events?: readonly EventDef[]
  /** Override the first-card fire chance (1 = always try). */
  fireChance?: number
}

const indexCache = new WeakMap<readonly EventDef[], Map<string, EventDef>>()
function indexOf(events: readonly EventDef[]): Map<string, EventDef> {
  let m = indexCache.get(events)
  if (!m) {
    m = new Map(events.map((e) => [e.id, e]))
    indexCache.set(events, m)
  }
  return m
}

/** Look up an event definition by id. */
export function getEventDef(id: string, events: readonly EventDef[] = ALL_EVENTS): EventDef | undefined {
  return indexOf(events).get(id)
}

// ───────────────────────── Helpers ─────────────────────────

/**
 * Monotonic week index across seasons. Delegates to career/common `absWeek`
 * so event cooldowns, relationship `lastContactWeek` and career timestamps
 * share one scheme.
 */
export function absoluteWeek(cal: Calendar): number {
  return absWeek(cal)
}

function readJson<T>(state: GameState, key: string, fallback: T): T {
  const raw = state.life.flags[key]
  if (typeof raw !== 'string') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/** Scheduled follow-ups (chain steps) waiting to fire. */
export function scheduledFollowUps(state: GameState): QueuedFollowUp[] {
  return readJson<QueuedFollowUp[]>(state, FLAG_FOLLOWUPS, [])
}

function writeFollowUps(state: GameState, q: QueuedFollowUp[]): void {
  if (q.length === 0) delete state.life.flags[FLAG_FOLLOWUPS]
  else state.life.flags[FLAG_FOLLOWUPS] = JSON.stringify(q)
}

function weekCounters(state: GameState, abs: number): { total: number; regular: number } {
  if (state.life.flags[FLAG_WEEK] !== abs) {
    state.life.flags[FLAG_WEEK] = abs
    state.life.flags[FLAG_WEEK_COUNT] = 0
    state.life.flags[FLAG_WEEK_REGULAR] = 0
  }
  const total = state.life.flags[FLAG_WEEK_COUNT]
  const regular = state.life.flags[FLAG_WEEK_REGULAR]
  return { total: typeof total === 'number' ? total : 0, regular: typeof regular === 'number' ? regular : 0 }
}

function formatNumber(n: number, lang: Lang): string {
  const sep = lang === 'tr' ? '.' : ','
  const neg = n < 0
  const s = String(Math.round(Math.abs(n)))
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, sep)
  return (neg ? '-' : '') + grouped
}

/** Money display: "12.500 €" (tr) / "€12,500" (en). */
export function formatMoney(n: number, lang: Lang): string {
  const v = formatNumber(n, lang)
  return lang === 'tr' ? `${v} ${CURRENCY_SYMBOL}` : `${CURRENCY_SYMBOL}${v}`
}

const PLACEHOLDER = /\{(\w+)(?::(\w+))?\}/g
/**
 * Gender alternative: `{g:male text|female text}` picks by `vars.heroGender`
 * (missing = male). It covers the hero AND the players of the hero's world
 * (teammates, rivals, youth prospects share the hero's gender); staff, family
 * and strangers keep their own fixed pronouns. Alternatives may not contain
 * braces or `|`, so nest `{var}` placeholders outside them.
 */
const GENDER_ALT = /\{g:([^{}|]*)\|([^{}|]*)\}/g

/** Resolve only the `{g:male|female}` alternatives. */
export function resolveGender(text: string, gender: unknown): string {
  const female = gender === 'female'
  return text.replace(GENDER_ALT, (_w, m: string, f: string) => (female ? f : m))
}

/**
 * Resolve `{g:male|female}` alternatives, then `{var}` / `{var:money}`
 * placeholders. Numbers are digit-grouped per language. Unknown placeholders
 * are left untouched (tests guard against them).
 */
export function formatText(text: LText, vars: EventVars, lang: Lang): string {
  return resolveGender(text[lang], vars['heroGender']).replace(PLACEHOLDER, (whole, key: string, spec: string | undefined) => {
    const v = vars[key]
    if (v === undefined) return whole
    if (typeof v === 'number') return spec === 'money' ? formatMoney(v, lang) : formatNumber(v, lang)
    return v
  })
}

/** Both languages resolved. */
export function formatBoth(text: LText, vars: EventVars): LText {
  return { tr: formatText(text, vars, 'tr'), en: formatText(text, vars, 'en') }
}

/** Placeholder names used in a text (both languages), for validation. */
export function placeholdersOf(text: LText): string[] {
  const out = new Set<string>()
  for (const s of [text.tr, text.en]) for (const m of s.matchAll(PLACEHOLDER)) out.add(m[1])
  return [...out]
}

// ───────────────────────── Standard vars ─────────────────────────

const FALLBACK_NAMES = ['Deniz', 'Emre', 'Selin', 'Kerem', 'Ada', 'Baran', 'Lena', 'Marco']
const FALLBACK_CLUBS = ['Kuzeyspor', 'Liman FK', 'Atlas United', 'Demirkent']

/** Names of standard vars always available to every event. */
export const STANDARD_VAR_KEYS = [
  'heroName', 'heroFirst', 'heroLast', 'clubName', 'clubShort', 'city', 'stadium', 'managerName', 'leagueName',
  'rivalClub', 'rivalPlayer', 'rivalPlayerId', 'mate', 'mateId', 'mate2', 'mate2Id',
  'partnerName', 'motherName', 'fatherName', 'siblingName', 'friendName', 'agentName', 'chairmanName',
  'season', 'age', 'shirt', 'wage', 'heroGender',
] as const

function relName(state: GameState, kind: RelationKind, fallback: string): string {
  const r = Object.values(state.life.relationships).find((x) => x.kind === kind)
  return r?.name || fallback
}

/** Variables derived from state at fire time (names, club, amounts). */
export function standardVars(state: GameState, rng: Rng): EventVars {
  const h = state.hero
  const club = h.contract ? state.world.clubs[h.contract.clubId] : undefined
  const league = club ? state.world.leagues[club.leagueId] : undefined
  const fb = (): string => rng.pick(FALLBACK_NAMES)

  const squad: NpcPlayer[] = club ? club.squad.map((id) => state.world.players[id]).filter((p): p is NpcPlayer => !!p) : []
  let mate: NpcPlayer | undefined
  let mate2: NpcPlayer | undefined
  if (squad.length > 0) {
    mate = rng.pick(squad)
    const rest = squad.filter((p) => p !== mate)
    mate2 = rest.length ? rng.pick(rest) : undefined
  }
  const otherClubs = league ? league.clubIds.filter((id) => id !== club?.id && state.world.clubs[id]) : []
  const rivalClubId = otherClubs.length ? rng.pick(otherClubs) : undefined
  const rivalClub = rivalClubId ? state.world.clubs[rivalClubId] : undefined
  const rivalSquad = rivalClub ? rivalClub.squad.map((id) => state.world.players[id]).filter((p): p is NpcPlayer => !!p) : []
  const rivalPool = rivalSquad.filter((p) => p.position === h.position)
  const rivalP = rivalPool.length ? rng.pick(rivalPool) : rivalSquad.length ? rng.pick(rivalSquad) : undefined

  return {
    heroName: h.nickname || h.firstName,
    heroFirst: h.firstName,
    heroLast: h.lastName,
    clubName: club?.name ?? 'FC Yıldız',
    clubShort: club?.shortName ?? 'YLD',
    city: club?.city ?? 'İstanbul',
    stadium: club?.stadium.name ?? 'Arena',
    managerName: club?.managerName || relName(state, 'manager', fb()),
    leagueName: league?.name ?? 'Lig',
    rivalClub: rivalClub?.name ?? rng.pick(FALLBACK_CLUBS),
    rivalPlayer: rivalP ? `${rivalP.firstName} ${rivalP.lastName}` : `${fb()} Varga`,
    rivalPlayerId: rivalP?.id ?? '',
    mate: mate ? `${mate.firstName} ${mate.lastName}` : `${fb()} Kaya`,
    mateId: mate?.id ?? '',
    mate2: mate2 ? `${mate2.firstName} ${mate2.lastName}` : `${fb()} Demir`,
    mate2Id: mate2?.id ?? '',
    partnerName: relName(state, 'partner', rng.pick(['Deniz', 'Selin', 'Ece', 'Ada', 'Kerem', 'Arda'])),
    motherName: relName(state, 'mother', 'Ayşe'),
    fatherName: relName(state, 'father', 'Mehmet'),
    siblingName: relName(state, 'sibling', 'Can'),
    friendName: relName(state, 'bestFriend', 'Ozan'),
    agentName: state.life.agent?.name || relName(state, 'agent', 'Rıza'),
    chairmanName: relName(state, 'chairman', 'Halit Bey'),
    season: state.calendar.season,
    age: state.calendar.season - h.birthYear,
    shirt: h.shirtNumber,
    wage: Math.max(400, h.contract?.wage ?? 400),
    heroGender: heroGender(h),
  }
}

// ───────────────────────── Weighting ─────────────────────────

/** Life-situation affinity: who you are shapes what happens to you. */
export function categoryAffinity(state: GameState, cat: EventCategory): number {
  const l = state.life
  const h = state.hero
  const fame = 0.6 + h.reputation / 60 // 0.6 .. 2.27
  switch (cat) {
    case 'casino':
      return 0.6 + l.casino.addiction / 25 + (l.casino.visitsThisWeek > 0 ? 0.6 : 0)
    case 'nightlife':
      return 1 + (l.happiness < 40 ? 0.3 : 0) + (l.stress > 60 ? 0.3 : 0) + (typeof l.flags['party_animal'] === 'number' || l.flags['party_animal'] === true ? 0.5 : 0)
    case 'romance':
      return Object.values(l.relationships).some((r) => r.kind === 'partner') ? 1.3 : 1
    case 'press':
    case 'social':
    case 'fans':
    case 'awards':
      return fame
    case 'health':
      return 1 + (l.stress > 65 ? 0.6 : 0) + (l.health < 50 ? 0.6 : 0) + (h.injury ? 0.5 : 0)
    case 'money': {
      const w = Math.max(400, h.contract?.wage ?? 400)
      return l.money > w * 40 ? 1.4 : 0.9
    }
    case 'manager':
      return h.managerTrust < 35 ? 1.3 : 1
    case 'family':
      return l.happiness < 45 ? 1.2 : 1
    case 'business':
      return (l.businesses?.length ?? 0) > 0 ? 1.6 : l.money > Math.max(400, h.contract?.wage ?? 400) * 30 ? 1 : 0.5
    case 'scam':
      return l.money > Math.max(400, h.contract?.wage ?? 400) * 20 ? 1.3 : 0.8
    case 'rumour':
    case 'charity':
      return 0.8 + h.reputation / 80
    case 'mentor':
      return state.calendar.season - h.birthYear >= 25 ? 1.3 : 0.6
    default:
      return 1
  }
}

function baseWeight(def: EventDef, ctx: EventCtx): number {
  const w = typeof def.weight === 'function' ? def.weight(ctx) : def.weight
  return Number.isFinite(w) && w > 0 ? w : 0
}

function triggerMatches(def: EventDef, tags: readonly string[]): boolean {
  if (!def.triggers || def.triggers.length === 0) return tags.includes('weekly')
  return def.triggers.some((tg) => tags.includes(tg))
}

function safeCond(def: EventDef, ctx: EventCtx): boolean {
  try {
    return def.conditions(ctx)
  } catch {
    return false
  }
}

/** Categories built around gambling, betting or alcohol: adults only. */
export const ADULT_EVENT_CATEGORIES: readonly EventCategory[] = ['casino', 'nightlife']

/** Minimum hero age for an event (explicit `minAge`, else 18 for adult categories, else 0). */
export const eventMinAge = (def: EventDef): number =>
  def.minAge ?? (ADULT_EVENT_CATEGORIES.includes(def.category) ? ADULT_AGE : 0)

const oldEnough = (state: GameState, def: EventDef): boolean =>
  heroAge(state.hero, state.calendar.season) >= eventMinAge(def)

/** True if `def` may spontaneously fire now (ignores weekly caps and chance). */
export function isEligible(state: GameState, def: EventDef, tags: readonly string[], abs = absoluteWeek(state.calendar)): boolean {
  if (def.followUpOnly) return false
  if (contentFlags.hideCasino && (def.category === 'casino' || def.triggers?.includes('casino'))) return false
  if (!triggerMatches(def, tags)) return false
  const last = state.life.eventHistory[def.id]
  if (last !== undefined) {
    if (def.once) return false
    if (abs - last < def.cooldownWeeks) return false
  }
  if (def.maxPerCareer !== undefined && careerCount(state, def.id) >= def.maxPerCareer) return false
  if (def.minWeek !== undefined && state.calendar.week < def.minWeek) return false
  if (!oldEnough(state, def)) return false
  if (state.pendingEvents.some((p) => p.defId === def.id)) return false
  return safeCond(def, { state, vars: {}, absWeek: abs, tags })
}

// ───────────────────────── Rolling ─────────────────────────

/**
 * Resolve the full variable set for an event about to fire:
 * standard vars ← event's own `vars()` ← parent (chain) vars, later wins.
 */
export function buildVars(state: GameState, rng: Rng, def: EventDef, tags: readonly string[] = [], parentVars?: EventVars): EventVars {
  const abs = absoluteWeek(state.calendar)
  const std = standardVars(state, rng)
  const ctx0: EventCtx = { state, vars: { ...std, ...(parentVars ?? {}) }, absWeek: abs, tags }
  const own = def.vars ? def.vars(ctx0, rng) : {}
  return { ...std, ...own, ...(parentVars ?? {}) }
}

function fire(state: GameState, rng: Rng, def: EventDef, tags: readonly string[], abs: number, parentVars?: EventVars): PendingEvent {
  const vars = buildVars(state, rng, def, tags, parentVars)
  const pending: PendingEvent = { defId: def.id, vars, firedAt: { ...state.calendar } }
  state.pendingEvents.push(pending)
  state.life.eventHistory[def.id] = abs
  if (def.maxPerCareer !== undefined) {
    const counts = readJson<Record<string, number>>(state, FLAG_COUNTS, {})
    counts[def.id] = (counts[def.id] ?? 0) + 1
    state.life.flags[FLAG_COUNTS] = JSON.stringify(counts)
  }
  const recent = readJson<string[]>(state, FLAG_RECENT_CATS, [])
  recent.push(def.category)
  state.life.flags[FLAG_RECENT_CATS] = JSON.stringify(recent.slice(-RECENT_CATEGORY_MEMORY))
  state.life.flags[FLAG_WEEK_COUNT] = (state.life.flags[FLAG_WEEK_COUNT] as number) + 1
  return pending
}

/**
 * Roll decision cards for the current moment and push them to
 * `state.pendingEvents`.
 *
 * Order: due follow-ups first (chains feel continuous), then spontaneous
 * events picked by weight × trigger match × life affinity × novelty × category
 * variety penalty. Anti-spam: ≤ {@link MAX_EVENTS_PER_WEEK} cards per week,
 * ≤ {@link MAX_REGULAR_PER_WEEK} spontaneous ones, ≤ {@link MAX_PENDING}
 * unanswered, and never two of the same category in one roll.
 *
 * @param tags situation tags, e.g. `['weekly']`, `['post_match','match_win','scored']`, `['nightlife']`.
 * @param maxCount cards this call may add at most.
 * @returns the newly added pending events.
 */
export function rollEvents(state: GameState, rng: Rng, tags: string[], maxCount = 1, opts: RollOptions = {}): PendingEvent[] {
  const events = opts.events ?? ALL_EVENTS
  const index = indexOf(events)
  const abs = absoluteWeek(state.calendar)
  const added: PendingEvent[] = []
  const counters = weekCounters(state, abs)
  let total = counters.total
  let regular = counters.regular
  const room = (): boolean => added.length < maxCount && total < MAX_EVENTS_PER_WEEK && state.pendingEvents.length < MAX_PENDING
  const usedCats = new Set<EventCategory>()

  // 1) Due follow-ups.
  const queue = scheduledFollowUps(state).sort((a, b) => a.due - b.due)
  const keep: QueuedFollowUp[] = []
  for (const q of queue) {
    const def = index.get(q.id)
    if (!def) continue // unknown id: drop
    if (q.due > abs) {
      keep.push(q)
      continue
    }
    const tagOk = tags.includes('weekly') || (def.triggers ?? []).some((tg) => tags.includes(tg))
    const condOk = tagOk && oldEnough(state, def) && !state.pendingEvents.some((p) => p.defId === def.id) && safeCond(def, { state, vars: q.vars, absWeek: abs, tags })
    if (condOk && room()) {
      added.push(fire(state, rng, def, tags, abs, q.vars))
      usedCats.add(def.category)
      total++
    } else if (abs - q.due <= FOLLOWUP_GRACE_WEEKS) keep.push(q)
  }
  writeFollowUps(state, keep)

  // 2) Spontaneous events.
  const baseChance = opts.fireChance ?? Math.max(0, ...tags.map((tg) => TAG_FIRE_CHANCE[tg] ?? 0.4))
  const recent = readJson<string[]>(state, FLAG_RECENT_CATS, [])
  let slot = 0
  while (room() && regular < MAX_REGULAR_PER_WEEK) {
    const chance = baseChance * Math.pow(EXTRA_CARD_FACTOR, slot)
    slot++
    if (!rng.chance(chance)) break
    const ctx: EventCtx = { state, vars: {}, absWeek: abs, tags }
    const cands: { def: EventDef; w: number }[] = []
    for (const def of events) {
      if (usedCats.has(def.category)) continue
      if (!isEligible(state, def, tags, abs)) continue
      let w = baseWeight(def, ctx)
      if (w <= 0) continue
      if (def.triggers?.some((tg) => tg !== 'weekly' && tags.includes(tg))) w *= 2
      w *= categoryAffinity(state, def.category)
      if (state.life.eventHistory[def.id] === undefined) w *= 1.3
      const seen = recent.filter((c) => c === def.category).length
      w *= Math.pow(CATEGORY_REPEAT_PENALTY, seen)
      if (w > 0 && Number.isFinite(w)) cands.push({ def, w })
    }
    if (cands.length === 0) break
    const pick = rng.weighted(cands, (c) => c.w).def
    added.push(fire(state, rng, pick, tags, abs))
    usedCats.add(pick.category)
    recent.push(pick.category)
    total++
    regular++
    state.life.flags[FLAG_WEEK_REGULAR] = regular
  }
  return added
}

// ───────────────────────── Resolving ─────────────────────────

/** Card view-model for the UI. */
export interface EventView {
  defId: string
  category: EventCategory
  icon: string
  title: string
  text: string
  choices: { label: string; hint?: string; risk?: 'low' | 'medium' | 'high'; enabled: boolean; lockedHint?: string }[]
}

/** Render a pending event in one language, with choice availability. */
export function describeEvent(state: GameState, pending: PendingEvent, lang: Lang, events: readonly EventDef[] = ALL_EVENTS): EventView | null {
  const def = getEventDef(pending.defId, events)
  if (!def) return null
  const ctx: EventCtx = { state, vars: pending.vars, absWeek: absoluteWeek(state.calendar), tags: [] }
  return {
    defId: def.id,
    category: def.category,
    icon: def.icon,
    title: formatText(def.title, pending.vars, lang),
    text: formatText(def.text, pending.vars, lang),
    choices: def.choices.map((c) => {
      const enabled = isChoiceAvailable(c.requires, ctx)
      return {
        label: formatText(c.label, pending.vars, lang),
        ...(c.hint ? { hint: formatText(c.hint, pending.vars, lang) } : {}),
        ...(c.risk ? { risk: c.risk } : {}),
        enabled,
        ...(!enabled && c.lockedHint ? { lockedHint: formatText(c.lockedHint, pending.vars, lang) } : {}),
      }
    }),
  }
}

function isChoiceAvailable(req: ((ctx: EventCtx) => boolean) | undefined, ctx: EventCtx): boolean {
  if (!req) return true
  try {
    return req(ctx)
  } catch {
    return false
  }
}

/**
 * Apply the player's choice for a pending card, remove the card, and return
 * what happened (resolved text + applied deltas for UI chips).
 * @throws if the event id is unknown, the index is out of range or the choice is locked.
 */
export function resolveEvent(state: GameState, rng: Rng, pending: PendingEvent, choiceIndex: number, events: readonly EventDef[] = ALL_EVENTS): ResolvedEffect {
  const def = getEventDef(pending.defId, events)
  if (!def) throw new Error(`Unknown event ${pending.defId}`)
  const choice = def.choices[choiceIndex]
  if (!choice) throw new Error(`Event ${def.id} has no choice ${choiceIndex}`)
  const ctx: EventCtx = { state, vars: pending.vars, absWeek: absoluteWeek(state.calendar), tags: [] }
  if (!isChoiceAvailable(choice.requires, ctx)) throw new Error(`Choice ${choiceIndex} of ${def.id} is locked`)
  const result = choice.effects(ctx, rng)
  const idx = state.pendingEvents.indexOf(pending)
  if (idx >= 0) state.pendingEvents.splice(idx, 1)
  else {
    const j = state.pendingEvents.findIndex((p) => p.defId === pending.defId)
    if (j >= 0) state.pendingEvents.splice(j, 1)
  }
  return applyEffectResult(state, rng, def, pending.vars, result, events)
}

/**
 * THE single place where event consequences touch GameState: deltas, flags,
 * follow-up scheduling, news and the life log.
 */
export function applyEffectResult(
  state: GameState,
  rng: Rng,
  def: EventDef,
  vars: EventVars,
  result: EffectResult,
  events: readonly EventDef[] = ALL_EVENTS,
): ResolvedEffect {
  const abs = absoluteWeek(state.calendar)
  const memory = formatBoth(def.title, vars)
  const applied: AppliedDelta[] = []
  for (const d of result.deltas) {
    const a = applyDelta(state, d, memory, abs, vars)
    if (a) applied.push(a)
  }
  for (const [k, v] of Object.entries(result.setFlags ?? {})) {
    if (v === null) delete state.life.flags[k]
    else state.life.flags[k] = v
  }
  for (const [k, v] of Object.entries(result.addFlags ?? {})) {
    const cur = state.life.flags[k]
    state.life.flags[k] = (typeof cur === 'number' ? cur : 0) + v
  }
  const followUps: FollowUp[] = []
  if (result.followUps?.length) {
    const q = scheduledFollowUps(state)
    const index = indexOf(events)
    for (const f of result.followUps) {
      if (!index.has(f.eventId)) continue
      q.push({ id: f.eventId, due: abs + Math.max(0, f.inWeeks), vars: { ...vars, ...(f.vars ?? {}) }, from: def.id })
      followUps.push(f)
    }
    writeFollowUps(state, q)
  }
  const text = formatBoth(result.text, vars)
  const cal = state.calendar
  state.life.log.push({ season: cal.season, week: cal.week, day: cal.day, text, icon: def.icon, kind: 'event' })
  let newsOut = result.news
  if (result.news) {
    newsOut = {
      ...result.news,
      headline: formatBoth(result.news.headline, vars),
      ...(result.news.body ? { body: formatBoth(result.news.body, vars) } : {}),
    }
    state.life.news.push({
      id: rng.id('ev'),
      season: cal.season,
      week: cal.week,
      headline: newsOut.headline,
      ...(newsOut.body ? { body: newsOut.body } : {}),
      source: result.news.source ?? 'StarPath Daily',
      sentiment: result.news.sentiment,
    })
  }
  return { text, deltas: applied, followUps, ...(newsOut ? { news: newsOut } : {}) }
}

const AUTO_CREATE: Partial<Record<RelationKind, true>> = { fans: true, press: true, manager: true, chairman: true }

function findRel(state: GameState, kind: RelationKind, npcId?: string): Relationship | undefined {
  const rels = Object.values(state.life.relationships)
  if (npcId) return rels.find((r) => r.npcId === npcId)
  return rels.find((r) => r.kind === kind)
}

function createRel(state: GameState, kind: RelationKind, name: string, abs: number, npcId?: string): Relationship {
  // Teammate ids must match life/relationships.ts (`tm_<npcId>`).
  let id: string = npcId ? teammateId(npcId) : kind
  let n = 2
  while (state.life.relationships[id]) id = `${npcId ? teammateId(npcId) : kind}_${n++}`
  const r: Relationship = { id, kind, name, value: 0, memory: [], lastContactWeek: abs, ...(npcId ? { npcId } : {}) }
  state.life.relationships[id] = r
  return r
}

function bump(r: Relationship, amount: number, memory: LText, abs: number): number {
  const before = r.value
  r.value = clamp(Math.round(r.value + amount), -100, 100)
  r.memory = [memory, ...r.memory].slice(0, 5)
  r.lastContactWeek = abs
  recordRelationChange(r, r.value - before, 'event', memory, abs)
  return r.value - before
}

function applyDelta(state: GameState, d: Delta, memory: LText, abs: number, vars: EventVars): AppliedDelta | null {
  const l = state.life
  const h = state.hero
  const num = (v: number): number => (Number.isFinite(v) ? v : 0)
  switch (d.kind) {
    case 'money': {
      let a = Math.round(num(d.amount))
      // Safety net: an event can't spend more than cash + savings (scam / fine / chain
      // losses stop at what the hero actually has); only deliberate play (casino, shopping) can go further.
      if (a < 0) a = -Math.min(-a, Math.max(0, Math.round(l.money + l.bank.savings)))
      if (a === 0) return null
      l.money += a
      return { kind: 'money', amount: a }
    }
    case 'stat': {
      const a = num(d.amount)
      const get = (): number => {
        switch (d.key) {
          case 'happiness': return l.happiness
          case 'health': return l.health
          case 'stress': return l.stress
          case 'energy': return l.energy
          case 'addiction': return l.casino.addiction
          case 'morale': return h.morale
          case 'form': return h.form
          case 'fatigue': return h.fatigue
          case 'sharpness': return h.sharpness
          case 'managerTrust': return h.managerTrust
        }
      }
      const before = get()
      const after = clamp(Math.round(before + a), 0, 100)
      switch (d.key) {
        case 'happiness': l.happiness = after; break
        case 'health': l.health = after; break
        case 'stress': l.stress = after; break
        case 'energy': l.energy = after; break
        case 'addiction': l.casino.addiction = after; break
        case 'morale': h.morale = after; break
        case 'form': h.form = after; break
        case 'fatigue': h.fatigue = after; break
        case 'sharpness': h.sharpness = after; break
        case 'managerTrust': h.managerTrust = after; break
      }
      return after === before ? null : { kind: 'stat', key: d.key, amount: after - before }
    }
    case 'attr': {
      const before = h.attrs[d.key]
      const after = clamp(Math.round(before + num(d.amount)), 1, 99)
      h.attrs[d.key] = after
      return after === before ? null : { kind: 'attr', key: d.key, amount: after - before }
    }
    case 'reputation': {
      const before = h.reputation
      h.reputation = clamp(Math.round((before + eventRepGain(before, num(d.amount))) * 10) / 10, 0, 100)
      return h.reputation === before ? null : { kind: 'reputation', amount: Math.round((h.reputation - before) * 10) / 10 }
    }
    case 'discipline': {
      const before = l.discipline
      l.discipline = clamp(Math.round(before + num(d.amount)), 0, 100)
      return l.discipline === before ? null : { kind: 'discipline', amount: l.discipline - before }
    }
    case 'followers': {
      const before = l.followers
      l.followers = Math.max(0, Math.round(before + num(d.amount)))
      return l.followers === before ? null : { kind: 'followers', amount: l.followers - before }
    }
    case 'injury': {
      const w = Math.max(0, Math.round(num(d.weeks)))
      if (w === 0) return null
      const severity: 1 | 2 | 3 = w <= 1 ? 1 : w <= 4 ? 2 : 3
      if (h.injury) h.injury = { ...h.injury, weeksLeft: Math.max(h.injury.weeksLeft, w) }
      else h.injury = { name: formatBoth(d.name, vars), weeksLeft: w, severity }
      return { kind: 'injury', weeks: w, name: formatBoth(d.name, vars) }
    }
    case 'suspension': {
      const m = Math.max(0, Math.round(num(d.matches)))
      if (m === 0) return null
      h.suspendedMatches += m
      return { kind: 'suspension', matches: m }
    }
    case 'relation': {
      const amount = num(d.amount)
      if (d.target === 'teammate' && !d.npcId) {
        const mates = Object.values(l.relationships).filter((r) => r.kind === 'teammate')
        if (mates.length === 0 || amount === 0) return null
        for (const r of mates) bump(r, amount, memory, abs)
        return { kind: 'relation', target: 'teammate', amount: Math.round(amount) }
      }
      let r = findRel(state, d.target, d.npcId)
      if (!r) {
        const club = h.contract ? state.world.clubs[h.contract.clubId] : undefined
        const fallbackName = d.name || (d.target === 'manager' ? club?.managerName : d.target === 'fans' ? club?.name : d.target === 'press' ? 'Media' : d.target === 'chairman' ? String(vars['chairmanName'] ?? 'Chairman') : undefined)
        const canCreate = !!d.npcId || !!d.name || !!AUTO_CREATE[d.target]
        if (!canCreate || !fallbackName) return null
        r = createRel(state, d.target, fallbackName, abs, d.npcId)
      }
      const change = bump(r, amount, memory, abs)
      if (change === 0) return null
      return { kind: 'relation', target: r.kind, amount: change, label: r.name, ...(r.npcId ? { npcId: r.npcId } : {}) }
    }
    case 'brand': {
      const list = l.businesses ?? []
      const b = d.business ? list.find((x) => x.kind === d.business) : list[0]
      if (!b) return null
      const before = b.brand
      b.brand = clamp(Math.round(before + num(d.amount)), 0, 100)
      return b.brand === before ? null : { kind: 'brand', amount: b.brand - before, label: b.name }
    }
    case 'endRelation': {
      const r = findRel(state, d.target, d.npcId)
      if (!r) return null
      delete l.relationships[r.id]
      if (r.kind === 'partner') l.flags['ex_partner'] = r.name
      return { kind: 'endRelation', target: r.kind, label: r.name }
    }
  }
}
