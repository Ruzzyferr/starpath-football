/**
 * Relationships (GDD 4.2): values −100..100 with a 5-line memory, weekly
 * neglect decay toward neutral, teammate roster sync, and gameplay effect
 * helpers (pass frequency in matches, family happiness).
 */
import type { Hero, LText, Life, RelationKind, Relationship } from '../../core/types'
import { clamp, fill, lt, signed, type Lines } from '../career/common'
import { makeRelation } from '../career/createHero'
import { perkValue } from '../career/perks'

/** Max memory lines kept per relationship (GDD: "son 5 olay"). */
export const MEMORY_SIZE = 5

/** Relationship id for a teammate NPC. */
export const teammateId = (npcId: string): string => `tm_${npcId}`

/** Kinds treated as family/close circle for happiness & decay rules. */
const CLOSE_KINDS: ReadonlySet<RelationKind> = new Set(['mother', 'father', 'sibling', 'partner', 'bestFriend'])

/**
 * Change a relationship value.
 * Diminishing returns near the extremes: a +10 gift to someone already at +90
 * yields about +4, so maxing a relationship takes sustained effort, while
 * damage to a great relationship still lands in full (trust is easy to break).
 *
 * @param contact   true when this was an interaction (resets neglect timer)
 * @param hero      optional: applies perk multipliers (`teammate_bond`, `fan_gain`, `family_bond`)
 * @returns the applied (rounded) delta
 */
export function changeRelation(
  life: Life,
  id: string,
  delta: number,
  opts: { memory?: LText; week?: number; contact?: boolean; hero?: Pick<Hero, 'perks'> } = {},
): number {
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
  return r.value - before
}

/** Feedback line for a relation change, e.g. "Annen ile ilişki +5". */
export function relationLine(life: Life, id: string, applied: number): LText | null {
  const r = life.relationships[id]
  if (!r || applied === 0) return null
  return fill(lt('{name} ile ilişki {d}', 'Relationship with {name} {d}'), { name: r.name, d: signed(applied) })
}

/** Change + produce a feedback line in one call. */
export function changeRelationWithLine(
  life: Life, id: string, delta: number, opts: Parameters<typeof changeRelation>[3] = {},
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

/** Fraction of the value fans/press lose per week (toward 0). */
const PUBLIC_DRIFT = 0.02

/**
 * Weekly decay tick. Only *positive* close relations decay with neglect
 * (grudges are handled by events, not by time); public opinion drifts both
 * ways toward neutral. Returns warning lines when a close bond crosses
 * below +20 because of neglect.
 */
export function weeklyRelationDecay(life: Life, week: number, hero?: Pick<Hero, 'perks'>): Lines {
  const lines: Lines = []
  const familySlow = hero ? clamp(perkValue(hero, 'family_bond'), 0, 0.9) : 0
  for (const r of Object.values(life.relationships)) {
    if (r.kind === 'fans' || r.kind === 'press') {
      r.value = Math.round(r.value * (1 - PUBLIC_DRIFT) * 100) / 100
      continue
    }
    const rule = DECAY_RULES[r.kind]
    if (!rule || r.value <= 0) continue
    const idle = week - r.lastContactWeek
    if (idle <= rule.grace) continue
    let d = rule.perWeek
    if (CLOSE_KINDS.has(r.kind) && r.kind !== 'partner') d *= 1 - familySlow
    const before = r.value
    r.value = Math.max(0, Math.round((r.value - d) * 10) / 10)
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
