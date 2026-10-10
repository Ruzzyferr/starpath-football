/**
 * Decision-card odds (tester feedback, TestFlight build 5: "whatever I choose it
 * always says things went well").
 *
 * Every choice now has an honest success chance computed from the hero's whole
 * situation, shown on the card before choosing ("Şans: %64" + the top factors),
 * and the roll picks one of three outcome tiers:
 *
 * - `success` — the best authored outcome of the choice;
 * - `mixed`   — a middle authored branch, or the success with halved gains and a cost;
 * - `fail`    — the worst authored branch (when the choice has a real downside written),
 *               else a "backfire" built from the success: gains turn into losses with
 *               the people involved, costs stay.
 *
 * The probability = base by risk class + Σ factors (attributes, morale, form,
 * fatigue, stress, injury, money, fame, discipline, addiction, the relationship
 * with the NPC the card is about, and the track record of past cards with them).
 * A no-risk choice (explicit `noRisk`, or a deterministic, untagged choice whose
 * upside is small) always resolves as authored and says so ("Risksiz").
 *
 * Everything is deterministic: describing never touches the game rng (variants
 * are sampled with seeds hashed from the card), resolving draws from the seeded
 * game rng only.
 */
import type { AttributeKey, GameState, LText, RelationKind } from '../../../core/types'
import { Rng, clamp, hashString } from '../../../core/rng'
import { absWeek } from '../../career/common'
import { teammateId } from '../relationships'
import type { ChoiceDef, Delta, EffectResult, EventCategory, EventCtx, EventDef, StatKey } from './types'

export type OutcomeTier = 'success' | 'mixed' | 'fail'
export type RiskClass = 'safe' | 'low' | 'medium' | 'high'

export interface OddsFactor {
  key: string
  label: LText
  /** Change of the success chance in percentage points (signed, rounded). */
  pts: number
}

export interface ChoiceOdds {
  /** No roll: the choice always resolves as written (small, safe upside). */
  noRisk: boolean
  risk: RiskClass
  /** Success chance 0..1 (1 for no-risk). */
  success: number
  mixed: number
  fail: number
  /** Every non-zero factor, strongest first. */
  factors: OddsFactor[]
}

// ───────────────────────── Tunables ─────────────────────────

/** Success chance before factors, per risk class. */
export const BASE_SUCCESS: Record<RiskClass, number> = { safe: 0.77, low: 0.74, medium: 0.58, high: 0.5 }
/** Share of the non-success mass that lands as `mixed` (rest = `fail`). */
export const MIXED_SHARE: Record<RiskClass, number> = { safe: 0.5, low: 0.45, medium: 0.38, high: 0.32 }
/** Risky choices hinge more on who you are. */
export const FACTOR_GAIN: Record<RiskClass, number> = { safe: 1, low: 1, medium: 1.25, high: 1.4 }
export const MIN_SUCCESS = 0.06
export const MAX_SUCCESS = 0.95
/** A deterministic, untagged choice whose best outcome is worth at most this many points needs no roll. */
export const NO_RISK_CAP = 1
/** Valence spread (points) that makes a choice's authored branches a real gamble. */
export const BRANCH_SPREAD = 4
/** Seeds sampled per choice when looking for its authored branches. */
export const VARIANT_SEEDS = 8
export const FLAG_TRACK = 'ev:track'
export const FLAG_TALLY = 'ev:tally'
/** Track record halves every this many weeks. */
const TRACK_HALF_LIFE = 26

// ───────────────────────── Valence ─────────────────────────

const STAT_W: Record<StatKey, number> = {
  happiness: 1, health: 0.8, energy: 0.3, morale: 1, form: 0.8, sharpness: 0.4, managerTrust: 1.2, stress: -0.8, fatigue: -0.4, addiction: -2,
}

const wageOf = (s: GameState): number => Math.max(400, s.hero.contract?.wage ?? 400)

/** How good one delta is for the hero, in rough "happiness points". */
export function deltaValue(s: GameState, d: Delta): number {
  switch (d.kind) {
    case 'money': return clamp((d.amount / wageOf(s)) * 2, -20, 20)
    case 'stat': return STAT_W[d.key] * d.amount
    case 'attr': return 5 * d.amount
    case 'reputation': return 1.5 * d.amount
    case 'followers': return Math.sign(d.amount) * Math.min(4, Math.log10(Math.abs(d.amount) + 1))
    case 'discipline': return 0.6 * d.amount
    case 'relation': return 0.5 * d.amount * (d.target === 'teammate' && !d.npcId && !d.relId ? 1.5 : 1)
    case 'injury': return -4 * d.weeks
    case 'suspension': return -5 * d.matches
    case 'sponsorLoss': return -12 * d.level
    case 'endRelation': return -10
    case 'objective': return 0
    case 'brand': return 0.4 * d.amount + (d.boost ? (d.boost.mult - 1) * d.boost.weeks * 2 : 0)
  }
}

/** Total valence of an effect result (deltas + headline sentiment). */
export function resultValue(s: GameState, r: EffectResult): number {
  let v = 0
  for (const d of r.deltas) v += deltaValue(s, d)
  if (r.news) v += 3 * r.news.sentiment
  return v
}

// ───────────────────────── Variants ─────────────────────────

/** An Rng that always returns the same draw: explores the "every chance hits" / "every chance misses" branches. */
class FixedRng extends Rng {
  private readonly u: number
  constructor(u: number) {
    super(1)
    this.u = u
  }
  override nextUint(): number {
    return this.u
  }
}

interface Variant { r: EffectResult; v: number }

/** Run a (pure) effect function with several seeds and both extremes; distinct outcomes sorted best → worst. */
export function sampleVariants(ctx: EventCtx, choice: ChoiceDef, seed: number): Variant[] {
  const rngs: Rng[] = [new FixedRng(0), new FixedRng(Math.floor(0.985 * 4294967296))]
  for (let i = 0; i < VARIANT_SEEDS; i++) rngs.push(new Rng((seed + Math.imul(i + 1, 0x9e3779b1)) >>> 0))
  const seen = new Map<string, Variant>()
  for (const rng of rngs) {
    let r: EffectResult
    try {
      r = choice.effects(ctx, rng)
    } catch {
      continue
    }
    const key = JSON.stringify([r.text, r.deltas])
    if (!seen.has(key)) seen.set(key, { r, v: resultValue(ctx.state, r) })
  }
  return [...seen.values()].sort((a, b) => b.v - a.v)
}

const cardSeed = (def: EventDef, idx: number, vars: Record<string, unknown>): number =>
  hashString(`${def.id}#${idx}#${String(vars['mateId'] ?? '')}`)

// ───────────────────────── Who is involved ─────────────────────────

interface Npc { key: string; value: number; label: LText }

const relValue = (s: GameState, kind: RelationKind): number | null => {
  const r = Object.values(s.life.relationships).find((x) => x.kind === kind)
  return r ? r.value : null
}

function npcOf(s: GameState, cat: EventCategory, vars: Record<string, unknown>): Npc | null {
  // Person scenes name the exact relationship.
  const pid = typeof vars['personId'] === 'string' ? vars['personId'] : ''
  const person = pid ? s.life.relationships[pid] : undefined
  if (person) return { key: person.id, value: person.value, label: { tr: `${person.name} ile bağ`, en: `Bond with ${person.name}` } }
  const kind = ((): RelationKind | 'family' | 'teammate' | null => {
    switch (cat) {
      case 'manager': case 'national': return 'manager'
      case 'club': return 'chairman'
      case 'teammates': case 'nightlife': case 'mentor': return 'teammate'
      case 'family': return 'family'
      case 'romance': return 'partner'
      case 'friends': return 'bestFriend'
      case 'press': case 'awards': case 'rumour': case 'legal': return 'press'
      case 'fans': case 'social': case 'community': case 'charity': case 'rivals': case 'milestone': return 'fans'
      case 'transfer': case 'money': case 'business': case 'scam': return 'agent'
      default: return null
    }
  })()
  if (!kind) return null
  if (kind === 'manager') {
    const rel = relValue(s, 'manager') ?? 0
    // Trust (0..100) and the personal bond (-100..100) both count.
    return { key: 'manager', value: (rel + (s.hero.managerTrust - 50) * 2) / 2, label: { tr: 'Hocayla ilişki', en: 'Bond with the manager' } }
  }
  if (kind === 'family') {
    const vals = (['mother', 'father', 'sibling'] as const).map((k) => relValue(s, k)).filter((x): x is number => x !== null)
    return vals.length ? { key: 'family', value: vals.reduce((a, b) => a + b, 0) / vals.length, label: { tr: 'Aileyle bağ', en: 'Family bond' } } : null
  }
  if (kind === 'teammate') {
    const mateId = typeof vars['mateId'] === 'string' ? vars['mateId'] : ''
    const specific = mateId ? s.life.relationships[teammateId(mateId)] : undefined
    if (specific) return { key: specific.id, value: specific.value, label: { tr: `${specific.name} ile ilişki`, en: `Bond with ${specific.name}` } }
    const mates = Object.values(s.life.relationships).filter((r) => r.kind === 'teammate')
    if (!mates.length) return null
    return { key: 'teammates', value: mates.reduce((a, r) => a + r.value, 0) / mates.length, label: { tr: 'Soyunma odası', en: 'Dressing room' } }
  }
  const v = relValue(s, kind)
  if (v === null) return null
  const label: Record<string, LText> = {
    chairman: { tr: 'Başkanla ilişki', en: 'Bond with the chairman' },
    partner: { tr: 'Sevgilinle bağ', en: 'Bond with your partner' },
    bestFriend: { tr: 'Arkadaşınla bağ', en: 'Bond with your friend' },
    press: { tr: 'Basınla ilişki', en: 'Press relations' },
    fans: { tr: 'Taraftar sevgisi', en: 'Fan love' },
    agent: { tr: 'Menajerinle ilişki', en: 'Bond with your agent' },
  }
  return { key: kind, value: v, label: label[kind] ?? { tr: 'İlişki', en: 'Relationship' } }
}

// ───────────────────────── Category profiles ─────────────────────────

interface Profile {
  attrs: readonly AttributeKey[]
  form?: boolean
  fame?: boolean
  money?: boolean
  discipline?: boolean
  addiction?: boolean
  physical?: boolean
}

const P = (attrs: readonly AttributeKey[], o: Omit<Profile, 'attrs'> = {}): Profile => ({ attrs, ...o })
export const CATEGORY_PROFILE: Record<EventCategory, Profile> = {
  teammates: P(['leadership', 'composure', 'workRate'], { form: true }),
  manager: P(['leadership', 'composure', 'workRate'], { form: true, discipline: true }),
  club: P(['leadership', 'composure'], { form: true, discipline: true }),
  family: P(['composure'], { money: true }),
  romance: P(['composure']),
  friends: P(['composure', 'leadership'], { money: true }),
  press: P(['composure', 'vision'], { fame: true }),
  social: P(['composure'], { fame: true }),
  fans: P(['composure', 'leadership'], { fame: true, form: true }),
  nightlife: P(['composure'], { discipline: true, money: true }),
  money: P(['composure', 'vision', 'anticipation'], { money: true }),
  casino: P(['composure', 'anticipation'], { money: true, discipline: true, addiction: true }),
  health: P(['stamina', 'strength', 'balance'], { physical: true }),
  national: P(['composure', 'leadership'], { form: true, fame: true }),
  awards: P(['composure'], { fame: true, form: true }),
  rivals: P(['composure', 'aggression'], { form: true }),
  community: P(['leadership'], { fame: true }),
  transfer: P(['composure'], { fame: true, form: true }),
  milestone: P(['composure', 'leadership'], { form: true }),
  weird: P(['composure', 'anticipation']),
  legal: P(['composure'], { discipline: true, money: true }),
  scam: P(['anticipation', 'vision', 'composure'], { money: true }),
  rumour: P(['composure'], { fame: true }),
  business: P(['vision', 'anticipation'], { money: true, fame: true }),
  charity: P(['leadership'], { fame: true, money: true }),
  mentor: P(['leadership', 'vision'], { fame: true }),
}

const ATTR_LABEL: Partial<Record<AttributeKey, LText>> = {
  leadership: { tr: 'Liderlik', en: 'Leadership' }, composure: { tr: 'Soğukkanlılık', en: 'Composure' },
  workRate: { tr: 'Çalışkanlık', en: 'Work rate' }, vision: { tr: 'Vizyon', en: 'Vision' },
  anticipation: { tr: 'Önsezi', en: 'Anticipation' }, aggression: { tr: 'Agresiflik', en: 'Aggression' },
  stamina: { tr: 'Dayanıklılık', en: 'Stamina' }, strength: { tr: 'Güç', en: 'Strength' }, balance: { tr: 'Denge', en: 'Balance' },
}

// ───────────────────────── Track record ─────────────────────────

type Track = Record<string, { s: number; f: number; w: number }>

function readTrack(s: GameState): Track {
  const raw = s.life.flags[FLAG_TRACK]
  if (typeof raw !== 'string') return {}
  try {
    const t = JSON.parse(raw) as unknown
    return t && typeof t === 'object' ? (t as Track) : {}
  } catch {
    return {}
  }
}

const trackKey = (npc: Npc | null, cat: EventCategory): string => npc?.key ?? `cat:${cat}`

/** Record a resolved roll: successes build trust in your judgement, failures (a broken promise, a public flop) linger. */
export function recordOutcome(s: GameState, def: EventDef, vars: Record<string, unknown>, tier: OutcomeTier): void {
  const track = readTrack(s)
  const key = trackKey(npcOf(s, def.category, vars), def.category)
  const now = absWeek(s.calendar)
  const cur = track[key]
  const decay = cur ? Math.pow(0.5, Math.max(0, now - cur.w) / TRACK_HALF_LIFE) : 1
  const next = { s: (cur?.s ?? 0) * decay, f: (cur?.f ?? 0) * decay, w: now }
  if (tier === 'success') next.s += 1
  else if (tier === 'fail') next.f += 1
  else next.f += 0.4
  next.s = Math.round(next.s * 100) / 100
  next.f = Math.round(next.f * 100) / 100
  track[key] = next
  // Keep the ledger small: the 24 most recent keys.
  const keys = Object.keys(track).sort((a, b) => (track[b]!.w - track[a]!.w)).slice(0, 24)
  s.life.flags[FLAG_TRACK] = JSON.stringify(Object.fromEntries(keys.map((k) => [k, track[k]])))
  // Season tally for balance diagnostics: "s,m,f".
  const tally = String(s.life.flags[FLAG_TALLY] ?? '0,0,0').split(',').map(Number)
  const i = tier === 'success' ? 0 : tier === 'mixed' ? 1 : 2
  tally[i] = (tally[i] ?? 0) + 1
  s.life.flags[FLAG_TALLY] = tally.join(',')
}

// ───────────────────────── Odds ─────────────────────────

function riskOf(choice: ChoiceDef, variants: Variant[]): RiskClass {
  const spread = variants.length > 1 ? variants[0]!.v - variants[variants.length - 1]!.v : 0
  if (choice.risk === 'high') return 'high'
  if (choice.risk === 'medium') return 'medium'
  if (spread >= BRANCH_SPREAD) return 'medium'
  return choice.risk === 'low' ? 'low' : 'safe'
}

function isNoRisk(choice: ChoiceDef, variants: Variant[], risk: RiskClass): boolean {
  // No sampleable outcome at all: nothing to roll, so never show odds the roll would not use.
  if (variants.length === 0) return true
  if (choice.noRisk !== undefined) return choice.noRisk
  if (risk !== 'safe') return false
  return variants[0]!.v <= NO_RISK_CAP
}

/** Every situational factor for a card category, in probability points (unscaled, before the risk gain). */
export function situationFactors(s: GameState, cat: EventCategory, vars: Record<string, unknown>): OddsFactor[] {
  const prof = CATEGORY_PROFILE[cat]
  const h = s.hero
  const L = s.life
  const out: OddsFactor[] = []
  const add = (key: string, label: LText, p: number): void => {
    const pts = Math.round(p * 100)
    if (pts !== 0) out.push({ key, label, pts })
  }
  // Attributes / personality: the hero's mental make-up (body for health cards).
  const vals = prof.attrs.map((k) => h.attrs[k] ?? 50)
  const avg = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length)
  const lead = prof.attrs.reduce((best, k) => ((h.attrs[k] ?? 0) > (h.attrs[best] ?? 0) ? k : best), prof.attrs[0]!)
  const weak = prof.attrs.reduce((w, k) => ((h.attrs[k] ?? 0) < (h.attrs[w] ?? 0) ? k : w), prof.attrs[0]!)
  const attrP = clamp(((avg - 50) / 35) * 0.08, -0.09, 0.09)
  add('attr', ATTR_LABEL[attrP >= 0 ? lead : weak] ?? { tr: 'Karakter', en: 'Character' }, attrP)
  // State of mind and body.
  add('morale', { tr: 'Moral', en: 'Morale' }, clamp(((h.morale - 55) / 45) * 0.06, -0.07, 0.06))
  add('stress', { tr: 'Stres', en: 'Stress' }, -Math.max(0, L.stress - 40) / 60 * 0.07)
  add('fatigue', { tr: 'Yorgunluk', en: 'Fatigue' }, -Math.max(0, h.fatigue - 45) / 55 * (prof.physical ? 0.08 : 0.04))
  if (L.energy < 25) add('energy', { tr: 'Enerji düşük', en: 'Low energy' }, -0.03)
  if (h.injury && h.injury.weeksLeft > 0) add('injury', { tr: 'Sakatlık', en: 'Injury' }, prof.physical ? -0.08 : -0.03)
  if (prof.physical) add('health', { tr: 'Sağlık', en: 'Health' }, clamp(((L.health - 70) / 30) * 0.05, -0.06, 0.03))
  if (prof.form) add('form', { tr: 'Form', en: 'Form' }, clamp(((h.form - 50) / 50) * 0.05, -0.05, 0.05))
  if (prof.fame) add('fame', { tr: 'Şöhret', en: 'Fame' }, clamp(((h.reputation - 35) / 65) * 0.06, -0.04, 0.06))
  if (prof.money) {
    const weeks = (L.money + L.bank.savings) / wageOf(s)
    add('money', { tr: 'Para durumu', en: 'Finances' }, clamp(0.025 * Math.log2(Math.max(0.25, weeks) / 8), -0.05, 0.05))
  }
  if (prof.discipline) add('discipline', { tr: 'Disiplin sicili', en: 'Discipline record' }, clamp(((L.discipline - 65) / 35) * 0.06, -0.08, 0.04))
  if (prof.addiction) add('addiction', { tr: 'Kumar bağımlılığı', en: 'Gambling habit' }, -clamp(L.casino.addiction / 100, 0, 1) * 0.12)
  // The person the card is about.
  const npc = npcOf(s, cat, vars)
  if (npc) add('relation', npc.label, clamp((npc.value / 100) * 0.12, -0.12, 0.12))
  // Track record with them (a failed promise or a public flop lingers; good calls build credit).
  const t = readTrack(s)[trackKey(npc, cat)]
  if (t) {
    const decay = Math.pow(0.5, Math.max(0, absWeek(s.calendar) - t.w) / TRACK_HALF_LIFE)
    add('track', { tr: 'Geçmiş kararların', en: 'Your track record' }, clamp((t.s * 0.03 - t.f * 0.045) * decay, -0.1, 0.06))
  }
  return out
}

/** Odds of one choice of a card in the current state. Pure (no game rng). */
export function choiceOdds(s: GameState, def: EventDef, idx: number, vars: Record<string, string | number>): ChoiceOdds {
  const choice = def.choices[idx]
  if (!choice) return { noRisk: true, risk: 'safe', success: 1, mixed: 0, fail: 0, factors: [] }
  const ctx: EventCtx = { state: s, vars, absWeek: absWeek(s.calendar), tags: [] }
  const variants = sampleVariants(ctx, choice, cardSeed(def, idx, vars))
  return oddsFrom(s, def, choice, variants, vars)
}

function oddsFrom(s: GameState, def: EventDef, choice: ChoiceDef, variants: Variant[], vars: Record<string, unknown>): ChoiceOdds {
  const risk = riskOf(choice, variants)
  if (isNoRisk(choice, variants, risk)) return { noRisk: true, risk, success: 1, mixed: 0, fail: 0, factors: [] }
  const gain = FACTOR_GAIN[risk]
  const factors = situationFactors(s, def.category, vars)
    .map((f) => ({ ...f, pts: Math.round(f.pts * gain) }))
    .filter((f) => f.pts !== 0)
    .sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts))
  // Whole percentages: what the card shows is exactly what the roll uses (no hidden decimals).
  const S = Math.round(clamp(BASE_SUCCESS[risk] + factors.reduce((a, f) => a + f.pts, 0) / 100, MIN_SUCCESS, MAX_SUCCESS) * 100)
  const M = Math.round((100 - S) * MIXED_SHARE[risk])
  return { noRisk: false, risk, success: S / 100, mixed: M / 100, fail: (100 - S - M) / 100, factors }
}

/**
 * The band a roll in [0, 1) lands in: [0, success) works, [success, success + mixed)
 * half works, the rest backfires. Compared in whole percent so the boundaries are
 * exactly the numbers on the card (and on the wheel). No streak breaker, no pity
 * timer: every roll is a fresh, independent draw from the game rng.
 */
export function rollTier(o: Pick<ChoiceOdds, 'success' | 'mixed'>, roll: number): OutcomeTier {
  const x = roll * 100
  const S = Math.round(o.success * 100)
  const M = Math.round(o.mixed * 100)
  return x < S ? 'success' : x < S + M ? 'mixed' : 'fail'
}

// ───────────────────────── Outcome building ─────────────────────────

const GOOD_STATS: readonly StatKey[] = ['happiness', 'health', 'energy', 'morale', 'form', 'sharpness', 'managerTrust']

/** Turn a success into a backfire: gains become (smaller) losses, costs stay and bite harder. */
function backfireDeltas(s: GameState, deltas: readonly Delta[]): Delta[] {
  const out: Delta[] = []
  const flip = (a: number, k: number): number => -Math.max(1, Math.round(Math.abs(a) * k))
  const worse = (a: number): number => Math.round(a * 1.3)
  for (const d of deltas) {
    switch (d.kind) {
      case 'money':
        if (d.amount > 0) { const keep = Math.round(d.amount * 0.25); if (keep) out.push({ ...d, amount: keep }) } else out.push({ ...d, amount: worse(d.amount) })
        break
      case 'stat': {
        const good = GOOD_STATS.includes(d.key)
        const helps = good ? d.amount > 0 : d.amount < 0
        out.push({ ...d, amount: helps ? (good ? flip(d.amount, 0.6) : Math.max(1, Math.round(Math.abs(d.amount) * 0.5))) : worse(d.amount) })
        break
      }
      case 'attr': if (d.amount < 0) out.push(d); break // no growth from a flop
      case 'reputation': case 'discipline': case 'brand':
        if (d.kind === 'brand' && (d.boost || d.manager !== undefined || d.expand)) { out.push(d); break }
        out.push({ ...d, amount: d.amount > 0 ? flip(d.amount, 0.5) : worse(d.amount) })
        break
      case 'followers': out.push({ ...d, amount: d.amount > 0 ? -Math.round(d.amount * 0.3) : worse(d.amount) }); break
      case 'relation': {
        const exists = d.relId ? !!s.life.relationships[d.relId]
          : d.npcId ? !!s.life.relationships[teammateId(d.npcId)]
          : Object.values(s.life.relationships).some((r) => r.kind === d.target)
        // A brand-new bond (first date, new contact) just starts cooler; an existing one takes the hit.
        if (d.amount > 0) out.push({ ...d, amount: exists ? flip(d.amount, 0.6) : Math.max(1, Math.round(d.amount * 0.3)) })
        else out.push({ ...d, amount: worse(d.amount) })
        break
      }
      default: out.push(d) // injuries, bans, sponsor losses, break-ups, objectives: structural, keep as written
    }
  }
  return out
}

function mixedDeltas(deltas: readonly Delta[]): Delta[] {
  return deltas.map((d) => {
    if (d.kind === 'money' && d.amount > 0) return { ...d, amount: Math.round(d.amount * 0.5) }
    if (d.kind === 'stat') {
      const good = GOOD_STATS.includes(d.key)
      const helps = good ? d.amount > 0 : d.amount < 0
      return helps ? { ...d, amount: Math.sign(d.amount) * Math.max(1, Math.round(Math.abs(d.amount) * 0.5)) } : d
    }
    if ((d.kind === 'reputation' || d.kind === 'relation' || d.kind === 'discipline' || d.kind === 'followers') && d.amount > 0) {
      return { ...d, amount: Math.max(1, Math.round(d.amount * 0.5)) }
    }
    if (d.kind === 'attr' && d.amount > 0) return null
    return d
  }).filter((d): d is Delta => d !== null)
}

const BACKFIRE: Record<string, readonly LText[]> = {
  manager: [
    { tr: 'Plan tutmadı. {managerName} kaşlarını çattı; bu konuşma aranızda bir süre soğukluk bırakacak.', en: 'It did not land. {managerName} frowned; this will leave a chill between you for a while.' },
    { tr: '{managerName} pek etkilenmedi: "Sahada göster." Güven biraz sarsıldı.', en: '{managerName} was not impressed: "Show me on the pitch." Trust took a knock.' },
  ],
  teammate: [
    { tr: 'Ters tepti. {mate} yanlış anladı, soyunma odasında hava gerildi.', en: 'It backfired. {mate} took it the wrong way and the dressing room got tense.' },
    { tr: 'İyi niyetliydin ama zamanlama kötüydü; birkaç takım arkadaşın sana mesafeli.', en: 'Good intentions, bad timing; a few teammates are keeping their distance.' },
  ],
  family: [
    { tr: 'Konuşma istediğin gibi gitmedi. Evde bir süre sessizlik var.', en: 'The talk did not go the way you wanted. It is quiet at home for a while.' },
  ],
  partner: [
    { tr: '{partnerName} ile işler beklediğin gibi gitmedi; aranızda soğuk bir akşam.', en: 'Things did not go as hoped with {partnerName}; a cold evening between you.' },
  ],
  bestFriend: [
    { tr: '{friendName} kırıldı. "Bunu senden beklemezdim." Telefonlar bir süre seyrek.', en: '{friendName} is hurt. "Didn\'t expect that from you." The calls get rarer for a while.' },
  ],
  press: [
    { tr: 'Basın olayı tersinden okudu. Ertesi sabah manşetler senden yana değil.', en: 'The press read it the other way. The next morning the headlines are not on your side.' },
  ],
  fans: [
    { tr: 'Taraftar hoşlanmadı; sosyal medyada eleştiriler çoğaldı.', en: 'The fans did not like it; the criticism piled up online.' },
  ],
  agent: [
    { tr: 'Hesap tutmadı. {agentName} "bunu bir daha konuşalım" dedi; kaybın sana kaldı.', en: 'The numbers did not add up. {agentName} said "let\'s talk about this again"; the loss is yours.' },
  ],
  chairman: [
    { tr: 'Yönetim katında hoş karşılanmadı. {chairmanName} bunu not etti.', en: 'It was not welcome upstairs. {chairmanName} made a note of it.' },
  ],
  none: [
    { tr: 'Olmadı. Planladığın gibi gitmedi ve bedelini sen ödedin.', en: 'It did not work. Nothing went to plan and you paid the price.' },
    { tr: 'Şans bu sefer senden yana değildi; iş ters tepti.', en: 'Luck was not on your side this time; it backfired.' },
  ],
}

const MIXED_TAIL: readonly LText[] = [
  { tr: ' Yine de tam istediğin gibi olmadı; bir bedeli de oldu.', en: ' Still, it was not quite what you wanted, and it cost you something.' },
  { tr: ' Ama yarım kaldı: emeğinin karşılığını tam alamadın.', en: ' But it only half worked: you did not get the full reward.' },
  { tr: ' Sonuç idare eder; kafanda soru işaretleri kaldı.', en: ' The result was so-so; it left you with doubts.' },
]

function npcGroup(cat: EventCategory): string {
  switch (cat) {
    case 'manager': case 'national': return 'manager'
    case 'teammates': case 'nightlife': case 'mentor': return 'teammate'
    case 'family': return 'family'
    case 'romance': return 'partner'
    case 'friends': return 'bestFriend'
    case 'press': case 'awards': case 'rumour': case 'legal': return 'press'
    case 'fans': case 'social': case 'community': case 'charity': case 'rivals': case 'milestone': return 'fans'
    case 'transfer': case 'money': case 'business': case 'scam': return 'agent'
    case 'club': return 'chairman'
    default: return 'none'
  }
}

/** The relationship that takes the hit of a backfire when the choice itself names nobody. */
function npcHit(cat: EventCategory, vars: Record<string, unknown>, amount: number): Delta | null {
  const g = npcGroup(cat)
  if (g === 'teammate') {
    const id = typeof vars['mateId'] === 'string' ? vars['mateId'] : ''
    return id ? { kind: 'relation', target: 'teammate', amount, npcId: id, name: String(vars['mate'] ?? '') } : { kind: 'relation', target: 'teammate', amount: Math.round(amount / 2) }
  }
  if (g === 'family') return { kind: 'relation', target: 'mother', amount }
  if (g === 'none') return null
  return { kind: 'relation', target: g as RelationKind, amount }
}

export interface RolledOutcome {
  tier: OutcomeTier
  result: EffectResult
  odds: ChoiceOdds
  /** The raw draw in [0, 1) that decided the tier (the wheel lands exactly here). */
  roll: number
}

/**
 * Roll a choice: odds from the state, the tier from the seeded game rng, the
 * concrete outcome from the choice's own authored branches where they exist.
 */
export function rollChoice(ctx: EventCtx, def: EventDef, idx: number, rng: Rng): RolledOutcome {
  const choice = def.choices[idx]!
  const roll = rng.next()
  // The same card-seeded variants the odds on the card were computed from.
  const variants = sampleVariants(ctx, choice, cardSeed(def, idx, ctx.vars))
  const o = oddsFrom(ctx.state, def, choice, variants, ctx.vars)
  if (variants.length === 0) return { tier: 'success', result: choice.effects(ctx, rng), odds: o, roll }
  const best = variants[0]!
  if (o.noRisk) {
    // As written (keep the choice's own small randomness).
    const pickIdx = Math.floor(rng.next() * variants.length)
    return { tier: 'success', result: variants[pickIdx]!.r, odds: o, roll }
  }
  const tier = rollTier(o, roll)
  if (tier === 'success') return { tier, result: best.r, odds: o, roll }
  const worst = variants[variants.length - 1]!
  const branchy = best.v - worst.v >= BRANCH_SPREAD
  const pick = (pool: readonly LText[]): LText => pool[Math.floor(rng.next() * pool.length)]!
  if (tier === 'fail') {
    if (branchy) return { tier, result: worst.r, odds: o, roll }
    const deltas = backfireDeltas(ctx.state, best.r.deltas)
    if (!deltas.some((d) => d.kind === 'relation' && d.amount < 0)) {
      const hit = npcHit(def.category, ctx.vars, -4)
      if (hit) deltas.push(hit)
    }
    deltas.push({ kind: 'stat', key: 'morale', amount: -3 }, { kind: 'stat', key: 'stress', amount: 4 })
    const { news, ...rest } = best.r
    const result: EffectResult = { ...rest, text: pick(BACKFIRE[npcGroup(def.category)] ?? BACKFIRE['none']!), deltas, ...(news && news.sentiment < 0 ? { news } : {}) }
    return { tier, result, odds: o, roll }
  }
  // Mixed: a middle authored branch if there is one, else the success at half strength with a cost.
  const middle = variants.find((x) => x.v < best.v - 1 && x.v > worst.v + 1)
  if (middle) return { tier, result: middle.r, odds: o, roll }
  const deltas = mixedDeltas(best.r.deltas)
  deltas.push(rng.next() < 0.5 ? { kind: 'stat', key: 'stress', amount: 3 } : { kind: 'stat', key: 'energy', amount: -6 })
  const tail = pick(MIXED_TAIL)
  return { tier, result: { ...best.r, text: { tr: best.r.text.tr + tail.tr, en: best.r.text.en + tail.en }, deltas }, odds: o, roll }
}
