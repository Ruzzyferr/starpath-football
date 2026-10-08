/**
 * Relationships (GDD 4.2): values −100..100 with a 5-line memory, weekly
 * neglect decay toward neutral, teammate roster sync, and gameplay effect
 * helpers (pass frequency in matches, family happiness).
 */
import type { Hero, LText, Life, RelationCause, RelationChange, RelationKind, Relationship } from '../../core/types'
import { clamp, fill, lt, signed, type Lines } from '../career/common'
import { makeRelation } from '../career/createHero'
import { perkValue } from '../career/perks'

/** Max memory lines kept per relationship (GDD: "son 5 olay"). */
export const MEMORY_SIZE = 5

/** Relationship id for a teammate NPC. */
export const teammateId = (npcId: string): string => `tm_${npcId}`

/** Kinds treated as family/close circle for happiness & decay rules. */
const CLOSE_KINDS: ReadonlySet<RelationKind> = new Set(['mother', 'father', 'sibling', 'partner', 'bestFriend'])

/** Max ledger entries kept per relationship (the "why" panel shows the last 10). */
export const RELATION_LOG_SIZE = 20

/** `life.flags` key with the last known absolute week (fallback timestamp for callers that pass none). */
export const REL_WEEK_FLAG = 'rel:week'

/** Default "why" line per cause when the caller gives no memory/why text. */
export const DEFAULT_WHY: Readonly<Record<RelationCause, LText>> = {
  match: lt('Maç performansı', 'Match performance'),
  event: lt('Bir olay', 'An event'),
  activity: lt('Birlikte vakit geçirdiniz', 'Time spent together'),
  decay: lt('Uzun süredir görüşmediniz', "You haven't been in touch"),
  interview: lt('Röportajdaki sözlerin', 'What you said in an interview'),
  role: lt('Kadrodaki rolün', 'Your squad role'),
  social: lt('Sosyal medya paylaşımın', 'Your social media post'),
  casino: lt('Kumarhane haberleri', 'Casino headlines'),
  transfer: lt('Transfer kararı', 'Transfer decision'),
  business: lt('İş dünyasındaki adımın', 'A business move'),
  other: lt('Çeşitli', 'Miscellaneous'),
}

const currentWeek = (life: Life): number => {
  const w = life.flags[REL_WEEK_FLAG]
  return typeof w === 'number' ? w : 0
}

/**
 * Append an entry to a relationship's ledger (most recent first). Consecutive
 * `decay` entries merge into one ("neglect ×4 weeks, −3") so the panel stays
 * readable. Zero changes are not recorded.
 */
export function recordRelationChange(r: Relationship, d: number, cause: RelationCause, why: LText, week: number): void {
  if (!Number.isFinite(d) || Math.abs(d) < 0.005) return
  const log = r.log ?? (r.log = [])
  const top = log[0]
  const v = Math.round(r.value * 100) / 100
  if (cause === 'decay' && top && top.cause === 'decay') {
    top.d = Math.round((top.d + d) * 100) / 100
    top.v = v
    top.w = Math.max(top.w, week)
    top.n = (top.n ?? 1) + 1
    return
  }
  log.unshift({ w: week, d: Math.round(d * 100) / 100, v, cause, why })
  if (log.length > RELATION_LOG_SIZE) log.length = RELATION_LOG_SIZE
}

export interface RelationOpts {
  memory?: LText
  week?: number
  contact?: boolean
  hero?: Pick<Hero, 'perks'>
  /** What caused the change (ledger). Default 'other'. */
  cause?: RelationCause
  /** Ledger line; defaults to `memory`, then a per-cause default. */
  why?: LText
}

/**
 * Change a relationship value.
 * Diminishing returns near the extremes: a +10 gift to someone already at +90
 * yields about +4, so maxing a relationship takes sustained effort, while
 * damage to a great relationship still lands in full (trust is easy to break).
 * Every applied change is written to the relationship's ledger with its cause.
 *
 * @param contact   true when this was an interaction (resets neglect timer)
 * @param hero      optional: applies perk multipliers (`teammate_bond`, `fan_gain`, `family_bond`)
 * @returns the applied (rounded) delta
 */
export function changeRelation(life: Life, id: string, delta: number, opts: RelationOpts = {}): number {
  const r = life.relationships[id]
  if (!r || !Number.isFinite(delta) || delta === 0) return 0
  let d = delta
  if (opts.hero && d > 0) {
    if (r.kind === 'teammate') d *= 1 + perkValue(opts.hero, 'teammate_bond')
    if (r.kind === 'fans') d *= 1 + perkValue(opts.hero, 'fan_gain')
    if (CLOSE_KINDS.has(r.kind) && r.kind !== 'partner') d *= 1 + perkValue(opts.hero, 'family_bond')
  }
  // Same-direction diminishing returns: factor 1 at 0, 0.4 at ±90.
  if (Math.sign(d) === Math.sign(r.value)) d *= 1 - (Math.abs(r.value) / 100) * 0.65
  const before = r.value
  r.value = clamp(Math.round(r.value + d), -100, 100)
  if (opts.memory) {
    r.memory.unshift(opts.memory)
    if (r.memory.length > MEMORY_SIZE) r.memory.length = MEMORY_SIZE
  }
  if (opts.contact && opts.week !== undefined) r.lastContactWeek = opts.week
  const applied = r.value - before
  const cause = opts.cause ?? 'other'
  recordRelationChange(r, applied, cause, opts.why ?? opts.memory ?? DEFAULT_WHY[cause], opts.week ?? currentWeek(life))
  return applied
}

/** Ledger entries of a relationship, most recent first (default: the last 10). */
export function relationHistory(r: Pick<Relationship, 'log'>, n = 10): RelationChange[] {
  return (r.log ?? []).slice(0, n)
}

/** Net change per cause over the whole ledger (for the "why" panel summary). */
export function relationCauseTotals(r: Pick<Relationship, 'log'>): Partial<Record<RelationCause, number>> {
  const out: Partial<Record<RelationCause, number>> = {}
  for (const e of r.log ?? []) out[e.cause] = Math.round(((out[e.cause] ?? 0) + e.d) * 10) / 10
  return out
}

/** Feedback line for a relation change, e.g. "Annen ile ilişki +5". */
export function relationLine(life: Life, id: string, applied: number): LText | null {
  const r = life.relationships[id]
  if (!r || applied === 0) return null
  return fill(lt('{name} ile ilişki {d}', 'Relationship with {name} {d}'), { name: r.name, d: signed(applied) })
}

/** Change + produce a feedback line in one call. */
export function changeRelationWithLine(
  life: Life, id: string, delta: number, opts: RelationOpts = {},
): Lines {
  const l = relationLine(life, id, changeRelation(life, id, delta, opts))
  return l ? [l] : []
}

/**
 * Neglect grace period (weeks without contact before decay starts) and decay
 * per week once neglected. Partner is the neediest (romance fades fast),
 * childhood friends are the most forgiving. Fans/press/manager are not
 * contact-based: fans & press drift slowly toward neutral every week
 * (yesterday's hero is forgotten), the manager is handled by squadRole.
 */
const DECAY_RULES: Partial<Record<RelationKind, { grace: number; perWeek: number }>> = {
  partner: { grace: 1, perWeek: 3 },
  mother: { grace: 3, perWeek: 1.5 },
  father: { grace: 3, perWeek: 1.5 },
  sibling: { grace: 4, perWeek: 1.5 },
  bestFriend: { grace: 4, perWeek: 1 },
  teammate: { grace: 3, perWeek: 1 },
  agent: { grace: 6, perWeek: 1 },
}

/**
 * Analiz-ve-Plan 2.4#4: neglect erodes a bond by 2 % of its value per week
 * (family: half that), never more than {@link DECAY_MAX_STEP} points in one
 * tick. The flat per-kind rate above is the floor for very small values, so
 * a fresh +10 teammate still fades, while a +80 bond erodes by 1.6/week.
 */
export const NEGLECT_RATE = 0.02
export const FAMILY_NEGLECT_FACTOR = 0.5
export const DECAY_MAX_STEP = 3

/** Weekly neglect decay in points for a relationship value (before perks). */
export function neglectStep(kind: RelationKind, value: number): number {
  const rule = DECAY_RULES[kind]
  if (!rule || value <= 0) return 0
  const family = CLOSE_KINDS.has(kind) && kind !== 'partner'
  const pct = value * NEGLECT_RATE * (family ? FAMILY_NEGLECT_FACTOR : 1)
  // Proportional term, with a small flat floor (a fifth of the legacy rate) so
  // low values still reach zero; partner keeps its faster romance fade.
  const flat = rule.perWeek * 0.2 * (kind === 'partner' ? 3 : 1)
  return Math.min(DECAY_MAX_STEP, Math.max(pct * (kind === 'partner' ? 3 : 1), flat))
}

/** Fraction of the value fans/press lose per week (toward 0). */
const PUBLIC_DRIFT = 0.02
const PUBLIC_FADE = lt('Gündem değişti, ilgi azaldı', 'The news cycle moved on')

/**
 * Weekly decay tick. Only *positive* close relations decay with neglect
 * (grudges are handled by events, not by time); public opinion drifts both
 * ways toward neutral. Returns warning lines when a close bond crosses
 * below +20 because of neglect.
 */
export function weeklyRelationDecay(life: Life, week: number, hero?: Pick<Hero, 'perks'>): Lines {
  const lines: Lines = []
  const familySlow = hero ? clamp(perkValue(hero, 'family_bond'), 0, 0.9) : 0
  life.flags[REL_WEEK_FLAG] = week
  // Lost captaincy vote (2.4#53): the winner stays a rival for the season; the bond cools by 1 every 3rd week.
  const rivalUntil = life.flags.captain_rival_until
  if (typeof rivalUntil === 'number') {
    if (week >= rivalUntil) { delete life.flags.captain_rival_until; delete life.flags.captain_rival_id }
    else if (week % 3 === 0 && typeof life.flags.captain_rival_id === 'string' && life.flags.captain_rival_id) {
      const rid = teammateId(life.flags.captain_rival_id)
      if (life.relationships[rid]) changeRelation(life, rid, -1, { week, cause: 'event', why: lt('Kaptanlık rekabeti', 'Captaincy rivalry') })
    }
  }
  for (const r of Object.values(life.relationships)) {
    if (r.kind === 'fans' || r.kind === 'press') {
      const b = r.value
      r.value = Math.round(r.value * (1 - PUBLIC_DRIFT) * 100) / 100
      recordRelationChange(r, r.value - b, 'decay', PUBLIC_FADE, week)
      continue
    }
    const rule = DECAY_RULES[r.kind]
    if (!rule || r.value <= 0) continue
    const idle = week - r.lastContactWeek
    if (idle <= rule.grace) continue
    let d = neglectStep(r.kind, r.value)
    if (CLOSE_KINDS.has(r.kind) && r.kind !== 'partner') d *= 1 - familySlow
    if (r.closeFriend) d *= 0.5 // a chosen close friend (2.4#37) forgives neglect twice as long
    const before = r.value
    r.value = Math.max(0, Math.round((r.value - d) * 10) / 10)
    recordRelationChange(r, r.value - before, 'decay', DEFAULT_WHY.decay, week)
    if (before >= 20 && r.value < 20 && CLOSE_KINDS.has(r.kind)) {
      lines.push(fill(lt('{name} seni ihmal ettiğini düşünüyor.', '{name} feels neglected.'), { name: r.name }))
    }
  }
  return lines
}

/**
 * Sync teammate relationships with the current squad: adds new teammates at a
 * neutral-friendly +10 (new dressing room, cautious welcome) and removes ones
 * who left. Returns ids added/removed.
 */
export function ensureTeammates(life: Life, teammates: readonly { npcId: string; name: string }[], week = 0): { added: string[]; removed: string[] } {
  const want = new Set(teammates.map((t) => teammateId(t.npcId)))
  const added: string[] = []
  const removed: string[] = []
  for (const r of Object.values(life.relationships)) {
    if (r.kind === 'teammate' && !want.has(r.id)) {
      delete life.relationships[r.id]
      removed.push(r.id)
    }
  }
  for (const t of teammates) {
    const id = teammateId(t.npcId)
    if (!life.relationships[id]) {
      life.relationships[id] = makeRelation(id, 'teammate', t.name, 10, week, t.npcId)
      added.push(id)
    }
  }
  return { added, removed }
}

/** Create (or rename) a single-person relation such as manager/agent/partner/chairman. */
export function ensureRelation(life: Life, id: string, kind: RelationKind, name: string, initial = 0, week = 0): Relationship {
  const r = life.relationships[id]
  if (r) {
    if (r.name !== name) {
      // New person in the role (e.g. manager sacked): fresh start.
      life.relationships[id] = makeRelation(id, kind, name, initial, week)
    }
    return life.relationships[id]
  }
  life.relationships[id] = makeRelation(id, kind, name, initial, week)
  return life.relationships[id]
}

/**
 * Teammate relation → pass frequency multiplier for the match engine
 * (`MatchPlayer.relationToHero` can also be fed raw). Piecewise linear:
 * −100 → 0.6 (he looks for anyone else), 0 → 1.0, +100 → 1.3.
 * Asymmetric on purpose: a feud hurts more than friendship helps, which is the
 * NSS lesson ("keep the dressing room sweet").
 */
export function passFactor(value: number): number {
  const v = clamp(value, -100, 100)
  return v < 0 ? 1 + v * 0.004 : 1 + v * 0.003
}

/** Pass factor for a teammate by NPC id (1.0 if unknown). */
export const teammatePassFactor = (life: Life, npcId: string): number =>
  passFactor(life.relationships[teammateId(npcId)]?.value ?? 0)

/** Human label for a value. */
export function relationLabel(value: number): LText {
  if (value <= -60) return lt('Düşman', 'Enemy')
  if (value <= -25) return lt('Soğuk', 'Cold')
  if (value < 10) return lt('Mesafeli', 'Distant')
  if (value < 35) return lt('İyi', 'Good')
  if (value < 65) return lt('Yakın', 'Close')
  return lt('Can ciğer', 'Inseparable')
}

/**
 * Close-circle happiness contribution, −15..+15. Average of family, best
 * friend and partner (partner counts double: GDD "sevgili → mutluluk/stres").
 */
export function closeCircleMood(life: Life): number {
  let sum = 0
  let w = 0
  for (const r of Object.values(life.relationships)) {
    if (!CLOSE_KINDS.has(r.kind)) continue
    const weight = r.kind === 'partner' ? 2 : 1
    sum += r.value * weight
    w += weight
  }
  return w > 0 ? clamp((sum / w) * 0.15, -15, 15) : 0
}

/** Average teammate value (0 if none) — used by squadRole & dressing-room events. */
export function teammateAverage(life: Life): number {
  let s = 0
  let n = 0
  for (const r of Object.values(life.relationships)) if (r.kind === 'teammate') { s += r.value; n++ }
  return n > 0 ? s / n : 0
}

// ───────────────────────── Match → relationships (fairness) ─────────────────────────

/** The hero's line from a match, as far as relationships care. */
export interface MatchRelationInput {
  rating: number
  goals: number
  assists: number
  won: boolean
  drew: boolean
  red?: boolean
  motm?: boolean
  /** Teammate NPC ids who assisted the hero / were assisted by the hero. */
  assistedBy?: readonly string[]
  assistedTo?: readonly string[]
}

/** Rating that is "neutral" for relationship deltas. */
export const REL_NEUTRAL_RATING = 6.5

/** A standout individual display: 2+ goals, 7.5+ rating or player of the match. */
export const heroShone = (m: Pick<MatchRelationInput, 'rating' | 'goals' | 'motm'>): boolean =>
  m.goals >= 2 || m.rating >= 7.5 || !!m.motm

/**
 * Share of a defeat the hero is blamed for, 0..1, proportional to their own
 * rating: full blame at ≤ 5.5, none at ≥ 7.0. A hat-trick in a 5–3 loss is
 * nobody's idea of "your fault" (store-review complaint #37).
 */
export const lossBlame = (rating: number): number => clamp((7 - rating) / 1.5, 0, 1)

export interface MatchRelationDeltas {
  fans: number
  manager: number
  /** Applied to every teammate. */
  teammates: number
}

/**
 * Relationship deltas of a finished match (pure, no state). Rules:
 *  - fans: (rating − 6.5)·2 + goals·1.5 + assists·0.75, ±1 for the result
 *    where a defeat costs only `lossBlame` of that point; red card −4.
 *  - manager: (rating − 6.5) + goals·0.5 + assists·0.3, a defeat −0.5·blame; red −5.
 *  - a shining hero (see {@link heroShone}) without a red card NEVER loses fans
 *    or manager standing (floor +1), whatever the score.
 *  - teammates: shared joy +0.6 on a win; shared frustration −0.6 only when the
 *    hero was poor (< 5) in a defeat; a hero who shone in a defeat earns +0.3
 *    respect (they saw the fight).
 */
export function matchRelationDeltas(m: MatchRelationInput): MatchRelationDeltas {
  const rating = clamp(Number.isFinite(m.rating) ? m.rating : REL_NEUTRAL_RATING, 0, 10)
  const goals = Math.max(0, m.goals | 0)
  const assists = Math.max(0, m.assists | 0)
  const lost = !m.won && !m.drew
  const blame = lost ? lossBlame(rating) : 0
  const perf = rating - REL_NEUTRAL_RATING
  let fans = perf * 2 + goals * 1.5 + assists * 0.75 + (m.won ? 1 : lost ? -blame : 0) - (m.red ? 4 : 0)
  let manager = perf + goals * 0.5 + assists * 0.3 - blame * 0.5 - (m.red ? 5 : 0)
  const shone = heroShone({ rating, goals, motm: m.motm }) && !m.red
  if (shone) {
    fans = Math.max(fans, 1)
    manager = Math.max(manager, 1)
  }
  const teammates = m.won ? 0.6 : lost && shone ? 0.3 : lost && rating < 5 ? -0.6 : 0
  return { fans, manager, teammates }
}

/** Short ledger line for a match: "Maç: 3 gol · puan 8.4 · yenilgi". */
export function matchWhy(m: MatchRelationInput): LText {
  const res = m.won ? lt('galibiyet', 'win') : m.drew ? lt('beraberlik', 'draw') : lt('yenilgi', 'defeat')
  const parts: LText[] = []
  if (m.goals > 0) parts.push(fill(lt('{n} gol', '{n} goal(s)'), { n: m.goals }))
  if (m.assists > 0) parts.push(fill(lt('{n} asist', '{n} assist(s)'), { n: m.assists }))
  parts.push(fill(lt('puan {x}', 'rating {x}'), { x: m.rating.toFixed(1) }))
  if (m.red) parts.push(lt('kırmızı kart', 'red card'))
  parts.push(res)
  return { tr: `Maç: ${parts.map((p) => p.tr).join(' · ')}`, en: `Match: ${parts.map((p) => p.en).join(' · ')}` }
}

/**
 * Apply a match's relationship consequences (fans, manager, assist partners,
 * dressing room) with ledger entries, and remember the line in
 * `life.flags.last_match_rating/last_match_shone` so post-match event cards
 * can avoid blaming a hero who carried the team.
 */
export function applyMatchRelations(life: Life, hero: Pick<Hero, 'perks' | 'gender'>, m: MatchRelationInput, week: number): MatchRelationDeltas {
  const d = matchRelationDeltas(m)
  const why = matchWhy(m)
  const opts = { hero, week, cause: 'match' as const, why }
  changeRelation(life, 'fans', d.fans, {
    ...opts,
    memory: Math.abs(d.fans) >= 5 ? (d.fans > 0 ? lt('Muhteşem bir maç çıkardın.', 'You put on a show.') : lt('Kötü bir maç geçirdin.', 'You had a poor game.')) : undefined,
  })
  if (life.relationships.manager) changeRelation(life, 'manager', d.manager, { week, contact: true, cause: 'match', why })
  for (const npc of m.assistedBy ?? []) {
    changeRelation(life, teammateId(npc), 3, { ...opts, contact: true, memory: lt('Golüne asist yaptı.', 'Set up your goal.'), why: lt('Golüne asist yaptı', 'Set up your goal') })
  }
  for (const npc of m.assistedTo ?? []) {
    const mem = lt('Ona asist yaptın.', hero.gender === 'female' ? 'You assisted her goal.' : 'You assisted his goal.')
    changeRelation(life, teammateId(npc), 4, { ...opts, contact: true, memory: mem, why: mem })
  }
  if (d.teammates !== 0) {
    const teamWhy = d.teammates > 0 && !m.won
      ? lt('Yenilgide bile savaştığını gördüler', 'They saw you fight even in defeat')
      : d.teammates > 0 ? lt('Galibiyet sevinci', 'Shared joy of a win') : lt('Kötü maçın soyunma odasını gerdi', 'Your poor game frustrated the dressing room')
    for (const r of Object.values(life.relationships)) if (r.kind === 'teammate') changeRelation(life, r.id, d.teammates, { ...opts, why: teamWhy })
  }
  life.flags.last_match_rating = Math.round(m.rating * 10) / 10
  life.flags.last_match_shone = heroShone(m) && !m.red
  life.flags.last_match_result = m.won ? 'W' : m.drew ? 'D' : 'L'
  life.flags[REL_WEEK_FLAG] = week
  return d
}
