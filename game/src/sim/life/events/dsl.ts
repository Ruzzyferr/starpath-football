/**
 * Tiny authoring helpers for event content. Everything here is pure: it reads
 * GameState and builds data (LText, Delta, EffectResult). Nothing mutates.
 *
 * Example:
 * ```ts
 * effects: (ctx, rng) => rng.chance(0.5)
 *   ? fx(t('Kazandın.', 'You won.'), money(500), happy(4))
 *   : fx(t('Kaybettin.', 'You lost.'), money(-500), stress(6), { followUps: [chain('casino.chaser', 1)] })
 * ```
 */
import type { AttributeKey, BusinessKind, GameState, LText, RelationKind, Relationship } from '../../../core/types'
import { heroGender } from '../../../core/gender'
import type { Rng } from '../../../core/rng'
import type { Delta, EffectResult, EventCtx, FlagValue, FollowUp, StatKey } from './types'

// ───────────────────────── Text ─────────────────────────

/**
 * Bilingual text: Turkish first, English second.
 *
 * Placeholders: `{var}` / `{amount:money}` (see engine.formatText) and the
 * gender alternative `{g:male text|female text}`, chosen by the hero's
 * gender. Use it for the hero and for players (teammates, rivals, academy
 * kids — the world's players share the hero's gender), e.g.
 * `t('{g:Oğlum|Kızım}, …', '"{rivalPlayer}? {g:He|She} won't get past me."')`.
 * Staff, family, strangers and partners keep fixed or neutral wording.
 */
export const t = (tr: string, en: string): LText => ({ tr, en })

// ───────────────────────── Deltas ─────────────────────────

export const money = (amount: number): Delta => ({ kind: 'money', amount: Math.round(amount) })
export const stat = (key: StatKey, amount: number): Delta => ({ kind: 'stat', key, amount })
export const happy = (n: number): Delta => stat('happiness', n)
export const stress = (n: number): Delta => stat('stress', n)
export const health = (n: number): Delta => stat('health', n)
export const energy = (n: number): Delta => stat('energy', n)
export const morale = (n: number): Delta => stat('morale', n)
export const form = (n: number): Delta => stat('form', n)
export const fatigue = (n: number): Delta => stat('fatigue', n)
export const sharp = (n: number): Delta => stat('sharpness', n)
export const trust = (n: number): Delta => stat('managerTrust', n)
export const addiction = (n: number): Delta => stat('addiction', n)
export const attr = (key: AttributeKey, n: number): Delta => ({ kind: 'attr', key, amount: n })
export const rep = (n: number): Delta => ({ kind: 'reputation', amount: n })
export const disc = (n: number): Delta => ({ kind: 'discipline', amount: n })
export const fol = (n: number): Delta => ({ kind: 'followers', amount: Math.round(n) })
/** Followers change as a percentage of the current count (min ±50 so it is felt early on). */
export const folPct = (ctx: EventCtx, pct: number): Delta => {
  const base = Math.abs(ctx.state.life.followers * pct) / 100
  return fol(Math.sign(pct) * Math.max(50, base))
}
export const injury = (weeks: number, name: LText): Delta => ({ kind: 'injury', weeks, name })
/** Scandal that triggers sponsors' morality clauses (level 4 = every deal is terminated). */
export const sponsorLoss = (level: 1 | 2 | 3 | 4): Delta => ({ kind: 'sponsorLoss', level })
export const objective = (preset: 'prove_yourself' | 'dev_focus'): Delta => ({ kind: 'objective', preset })
export const ban = (matches: number): Delta => ({ kind: 'suspension', matches })

/** Relationship change by kind (`'teammate'` alone = every teammate a bit). */
export const rel = (target: RelationKind, amount: number, name?: string): Delta =>
  name === undefined ? { kind: 'relation', target, amount } : { kind: 'relation', target, amount, name }
/** Relationship change with one specific NPC (teammate or rival player); created if missing. */
export const relNpc = (npcId: string | number | undefined, name: string | number | undefined, amount: number): Delta =>
  npcId ? { kind: 'relation', target: 'teammate', amount, npcId: String(npcId), name: String(name ?? '') } : { kind: 'relation', target: 'teammate', amount: Math.round(amount / 3) }
/** Relationship change for one exact relationship id (used by person scenes). */
export const relId = (id: string, amount: number): Delta => ({ kind: 'relation', target: 'teammate', amount, relId: id })
export const fans = (n: number): Delta => rel('fans', n)
export const press = (n: number): Delta => rel('press', n)
export const boss = (n: number): Delta => rel('manager', n)
export const chairman = (n: number): Delta => rel('chairman', n)
export const endRel = (target: RelationKind): Delta => ({ kind: 'endRelation', target })

// ───────────────────────── Results ─────────────────────────

type Extras = Omit<EffectResult, 'text' | 'deltas'>
const isExtras = (x: Delta | Extras): x is Extras => !('kind' in x)

/** Build an EffectResult. Last argument may be an extras object (followUps, flags, news). */
export function fx(text: LText, ...parts: (Delta | Extras)[]): EffectResult {
  const deltas: Delta[] = []
  let extras: Extras = {}
  for (const p of parts) {
    if (isExtras(p)) extras = { ...extras, ...p }
    else deltas.push(p)
  }
  return { ...extras, text, deltas }
}

/** Follow-up shorthand. */
export const chain = (eventId: string, inWeeks: number, vars?: Record<string, string | number>): FollowUp =>
  vars ? { eventId, inWeeks, vars } : { eventId, inWeeks }

/** Extras shorthands to pass into fx(). */
export const flags = (setFlags: Record<string, FlagValue | null>): Extras => ({ setFlags })
export const follow = (...followUps: FollowUp[]): Extras => ({ followUps })
export const news = (headline: LText, sentiment: -1 | 0 | 1, body?: LText): Extras => ({
  news: body ? { headline, body, sentiment } : { headline, sentiment },
})

// ───────────────────────── State queries ─────────────────────────

export const getFlag = (s: GameState, key: string): FlagValue | undefined => s.life.flags[key]
export const hasFlag = (s: GameState, key: string): boolean => {
  const v = s.life.flags[key]
  return v !== undefined && v !== false && v !== 0 && v !== ''
}
export const flagNum = (s: GameState, key: string): number => {
  const v = s.life.flags[key]
  return typeof v === 'number' ? v : 0
}
export const relOf = (s: GameState, kind: RelationKind): Relationship | undefined =>
  Object.values(s.life.relationships).find((r) => r.kind === kind)
export const hasRel = (s: GameState, kind: RelationKind): boolean => relOf(s, kind) !== undefined
/** Relationship value by kind (0 when missing). */
export const relVal = (s: GameState, kind: RelationKind): number => relOf(s, kind)?.value ?? 0
export const age = (s: GameState): number => s.calendar.season - s.hero.birthYear
export const hasClub = (s: GameState): boolean => !!s.hero.contract && !!s.world.clubs[s.hero.contract.clubId]
export const isInjured = (s: GameState): boolean => !!s.hero.injury && s.hero.injury.weeksLeft > 0
/** Weekly wage (fallback 400 for clubless/youth). */
export const wage = (s: GameState): number => Math.max(400, s.hero.contract?.wage ?? 400)
/** Amount scaled to the hero's weekly wage, rounded to a "nice" number. */
export const wageX = (s: GameState, weeks: number, min = 100): number => nice(Math.max(min, wage(s) * weeks))
export const canAfford = (s: GameState, amount: number): boolean => s.life.money >= amount
/** Number var from ctx.vars (0 if missing). */
export const num = (ctx: EventCtx, key: string): number => {
  const v = ctx.vars[key]
  return typeof v === 'number' ? v : Number(v) || 0
}

/** Brand reputation change for an owned business (first one, or of a given kind). */
export const brand = (amount: number, business?: BusinessKind): Delta => (business ? { kind: 'brand', amount, business } : { kind: 'brand', amount })
/** Marketing push (mult > 1) or crisis (mult < 1) on a business for `weeks` weeks, plus a brand change. */
export const bizBoost = (amount: number, mult: number, weeks: number, business?: BusinessKind): Delta =>
  ({ kind: 'brand', amount, boost: { mult, weeks }, ...(business ? { business } : {}) })
/** Hire / dismiss the general manager of a business (brand change optional). */
export const bizManager = (hire: boolean, amount = 0, business?: BusinessKind): Delta =>
  ({ kind: 'brand', amount, manager: hire, ...(business ? { business } : {}) })
/** Expand a business one level; the caller charges the cash with money(); `invest` raises the resale basis. */
export const bizExpand = (invest: number, amount = 0, business?: BusinessKind): Delta =>
  ({ kind: 'brand', amount, expand: { invest: Math.round(invest) }, ...(business ? { business } : {}) })
/** The hero owns at least one business (of a kind). */
export const hasBusiness = (s: GameState, kind?: BusinessKind): boolean =>
  (s.life.businesses ?? []).some((b) => !kind || b.kind === kind)
/** Name of the hero's (first / given kind) business, with a fallback for previews. */
export const businessName = (s: GameState, kind?: BusinessKind): string =>
  (s.life.businesses ?? []).find((b) => !kind || b.kind === kind)?.name ?? 'Köşe Lokanta'
/**
 * The hero carried the team in the last match (2+ goals, 7.5+ rating or MOTM,
 * no red card). Blame-themed post-defeat cards must not fire then.
 */
export const heroShoneLastMatch = (s: GameState): boolean => s.life.flags['last_match_shone'] === true
/** The hero plays abroad (club country ≠ nationality). */
export const playsAbroad = (s: GameState): boolean => {
  const c = s.hero.contract ? s.world.clubs[s.hero.contract.clubId] : undefined
  return !!c && c.countryId !== s.hero.nationality
}

/** Round to 2 significant-ish digits so amounts read naturally (12 500, not 12 487). */
export function nice(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1))
  return Math.round(n / mag) * mag
}

// ───────────────────────── Name pools ─────────────────────────

/** Gender-neutral usage: content should avoid gendered pronouns for these names. */
export const FIRST_NAMES = [
  'Deniz', 'Ece', 'Selin', 'Zeynep', 'Elif', 'Defne', 'Aylin', 'Cansu', 'Melis', 'Ada',
  'Emre', 'Kerem', 'Baran', 'Mert', 'Arda', 'Can', 'Burak', 'Onur', 'Tolga', 'Kaan',
  'Sofia', 'Lena', 'Maya', 'Clara', 'Nora', 'Luca', 'Marco', 'Tom', 'Jonas', 'Rafa',
] as const
/** Partners can be of any gender; content refers to them by name or "they". */
export const PARTNER_NAMES = [
  'Deniz', 'Ece', 'Selin', 'Zeynep', 'Elif', 'Defne', 'Aylin', 'Melis', 'Sofia', 'Lena', 'Maya', 'Clara', 'Nora', 'İpek', 'Su',
  'Kerem', 'Arda', 'Can', 'Emir', 'Ozan', 'Luca', 'Marco', 'Jonas', 'Mateo', 'Noah',
] as const
/** Footballers share the hero's gender (the world follows the hero). */
export const PLAYER_FIRST_MALE = ['Efe', 'Yusuf', 'Mirza', 'Tuna', 'Alp', 'Noah', 'Emre', 'Kerem', 'Baran', 'Mert', 'Luca', 'Marco', 'Jonas', 'Rafa'] as const
export const PLAYER_FIRST_FEMALE = ['Elif', 'Zeynep', 'Defne', 'Duru', 'Ela', 'Mira', 'Ece', 'Selin', 'Lena', 'Sofia', 'Maya', 'Clara', 'Nora', 'Alba'] as const
export const LAST_NAMES = [
  'Yıldız', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Koç',
  'Moreau', 'Rossi', 'Novak', 'Silva', 'Becker', 'Walsh', 'Ortega', 'Larsen', 'Costa', 'Varga',
] as const
export const BRANDS = ['Volta', 'Nordline', 'Kairo', 'Meridyen', 'Strada', 'Orbis', 'Fennec', 'Zirve'] as const
export const pickFirst = (rng: Rng): string => rng.pick(FIRST_NAMES)
export const pickFull = (rng: Rng): string => `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`
export const pickBrand = (rng: Rng): string => rng.pick(BRANDS)
/** First name of a footballer in the hero's world (gender follows the hero). */
export const pickPlayerFirst = (s: GameState, rng: Rng): string =>
  rng.pick(heroGender(s.hero) === 'female' ? PLAYER_FIRST_FEMALE : PLAYER_FIRST_MALE)
/** Full name of a footballer in the hero's world. */
export const pickPlayerFull = (s: GameState, rng: Rng): string => `${pickPlayerFirst(s, rng)} ${rng.pick(LAST_NAMES)}`
