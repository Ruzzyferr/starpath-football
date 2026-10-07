/**
 * Contracts (GDD 2.4): offer generation, offer evaluation, the negotiation
 * mini-game state machine, renewals and signing.
 *
 * Money scale (weekly wages, currency units):
 *   - "Star wage" a club pays its best player grows exponentially with club
 *     reputation: 400 × e^(0.072·rep) → rep 20 ≈ 1.7K, rep 50 ≈ 14.6K,
 *     rep 80 ≈ 127K, rep 95 ≈ 373K.
 *   - A squad-average player earns 35% of that; the hero's standing in the
 *     squad (OVR − squad average) multiplies it by e^(0.08·diff)
 *     (+10 OVR ≈ ×2.2, −10 ≈ ×0.45), fame adds up to +50%, teenagers sign
 *     youth deals (×0.6).
 *   → 17-year-old reserve at a small club ≈ 300–600/wk, established star at a
 *     top club ≈ 250–450K/wk.
 *
 * Contract seasons: an offer starting in season S for N years covers seasons
 * S..S+N−1, so `untilSeason = S + N − 1` (the last season under contract).
 */
import type { Agent, Calendar, Contract, Hero, LText, Life, Position, SquadRole } from '../../core/types'
import type { Rng } from '../../core/rng'
import { clamp, fill, fmtMoney, heroAge, lt, pushLog, type Lines } from './common'
import { heroOvr, potentialStars } from './progression'
import { perkValue } from './perks'

// ───────────────────────── Types ─────────────────────────

/** Plain description of the club making an offer (no world dependency). */
export interface ClubContext {
  clubId: string
  clubName: string
  /** 1..100 */
  reputation: number
  /** Average OVR of the club's squad (determines the hero's standing). */
  squadAvgOvr: number
  /** Weekly wage budget (total). Optional cap: one player never gets > 30% of it. */
  wageBudget?: number
}

/** Negotiable terms. */
export interface ContractTerms {
  /** Weekly wage. */
  wage: number
  /** Contract length in seasons (1..5). */
  years: number
  signingBonus: number
  goalBonus: number
  assistBonus: number
  releaseClause: number | null
  role: SquadRole
}

export type OfferKind = 'new' | 'renewal' | 'transfer' | 'loan' | 'freeAgent'

/** A contract offer (serializable). */
export interface ContractOffer {
  clubId: string
  clubName: string
  kind: OfferKind
  /** First season covered. */
  startSeason: number
  loan: boolean
  terms: ContractTerms
}

/** Context for offer generation. */
export interface OfferContext {
  club: ClubContext
  season: number
  agent?: Agent | null
  kind?: OfferKind
}

// ───────────────────────── Helpers ─────────────────────────

/** Role ladder (index = rank). */
const ROLE_ORDER: readonly SquadRole[] = ['youth', 'reserve', 'rotation', 'starter', 'star', 'captain']
const roleRank = (r: SquadRole): number => ROLE_ORDER.indexOf(r)

/** Localized role names. */
export const ROLE_NAMES: Readonly<Record<SquadRole, LText>> = {
  youth: lt('Altyapı', 'Youth'),
  reserve: lt('Yedek', 'Reserve'),
  rotation: lt('Rotasyon', 'Rotation'),
  starter: lt('İlk 11', 'Starter'),
  star: lt('Yıldız', 'Star'),
  captain: lt('Kaptan', 'Captain'),
}

/** Round money to "contract-looking" numbers (no 12,347.81 wages). */
export function roundNice(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0
  const step = n < 1000 ? 10 : n < 10_000 ? 50 : n < 100_000 ? 500 : n < 1_000_000 ? 5000 : 50_000
  return Math.max(step, Math.round(n / step) * step)
}

/** Weekly wage a club pays its best-paid regular player. See module doc for the curve. */
export const clubStarWage = (reputation: number): number => 400 * Math.exp(0.072 * clamp(reputation, 1, 100))

/** Minimum weekly wage of any professional contract. */
export const MIN_WAGE = 300

/**
 * Market-fair weekly wage for this hero at this club, before negotiation.
 * Capped at 1.3× the club's star wage (nobody breaks the wage structure by
 * more than that) and at 30% of the club's total weekly wage budget.
 */
export function fairWage(hero: Hero, club: ClubContext, season: number): number {
  const ovr = heroOvr(hero)
  const typical = clubStarWage(club.reputation) * 0.35
  const standing = Math.exp(clamp(ovr - club.squadAvgOvr, -20, 20) * 0.08)
  const fame = 1 + clamp(hero.reputation, 0, 100) / 200
  const age = heroAge(hero, season)
  // Teenagers sign youth deals; veterans 33+ get a modest discount (short-term risk).
  const ageF = age <= 19 ? 0.6 : age <= 21 ? 0.8 : age >= 33 ? 0.85 : 1
  let w = typical * standing * fame * ageF
  w = Math.min(w, clubStarWage(club.reputation) * 1.3)
  if (club.wageBudget && club.wageBudget > 0) w = Math.min(w, club.wageBudget * 0.3)
  return roundNice(Math.max(MIN_WAGE, w))
}

/**
 * Transfer market value (currency units).
 *   base 500K × e^(0.18·(OVR−60)) → 50 ≈ 83K, 60 = 500K, 70 ≈ 3M, 80 ≈ 18M,
 *   90 ≈ 110M (capped 250M). Young players with headroom are worth more
 *   (+4% per point of potential gap until 23), veterans lose 15%/year after 29,
 *   fame adds up to +50%, and an expiring deal halves the fee (Bosman effect).
 */
export function heroMarketValue(hero: Hero, season: number): number {
  const ovr = heroOvr(hero)
  let v = Math.min(250e6, 500_000 * Math.exp(0.18 * (ovr - 60)))
  const age = heroAge(hero, season)
  if (age <= 23) v *= 1 + Math.max(0, hero.potential - ovr) * 0.04
  if (age >= 30) v *= Math.max(0.2, 1 - (age - 29) * 0.15)
  v *= 1 + clamp(hero.reputation, 0, 100) / 200
  if (hero.contract && hero.contract.untilSeason <= season) v *= 0.5
  return roundNice(v)
}

/** Role a club offers from the hero's OVR vs. their squad average. */
export function roleForStanding(ovr: number, squadAvgOvr: number, age: number): SquadRole {
  const d = ovr - squadAvgOvr
  if (d >= 10) return 'star'
  if (d >= 3) return 'starter'
  if (d >= -3) return 'rotation'
  if (d >= -8 || age > 20) return 'reserve'
  return 'youth'
}

/** Goal-bonus fraction of weekly wage per goal, by position (strikers live off goals). */
const GOAL_BONUS_FACTOR: Readonly<Record<Position, number>> = {
  GK: 0, CB: 0.04, LB: 0.04, RB: 0.04, DM: 0.05, CM: 0.06, AM: 0.07, LW: 0.07, RW: 0.07, ST: 0.08,
}

/** Contract length range in seasons by age (clubs avoid long deals for veterans). */
function lengthRange(age: number): [number, number] {
  if (age <= 21) return [3, 5]
  if (age <= 29) return [2, 5]
  if (age <= 32) return [1, 3]
  return [1, 2]
}

/** Convert an offer into the hero's Contract record. */
export function toContract(offer: ContractOffer): Contract {
  const t = offer.terms
  return {
    clubId: offer.clubId,
    wage: t.wage,
    untilSeason: offer.startSeason + t.years - 1,
    signingBonus: t.signingBonus,
    goalBonus: t.goalBonus,
    assistBonus: t.assistBonus,
    releaseClause: t.releaseClause,
    role: t.role,
    ...(offer.loan ? { loan: true } : {}),
  }
}

// ───────────────────────── Offer generation ─────────────────────────

/**
 * Generate a contract offer.
 *  - Wage: {@link fairWage} × N(1, 0.07) noise × (1 + 2% per agent level above 1).
 *  - Signing bonus: 4–12 weeks of wages (more for prestigious clubs); free
 *    agents get double because the club saves a transfer fee.
 *  - Release clause: smaller clubs (rep < 75) insert one 50% of the time at
 *    1.8–3× market value; elite clubs rarely (15%).
 */
export function generateContractOffer(rng: Rng, hero: Hero, ctx: OfferContext): ContractOffer {
  const kind = ctx.kind ?? 'new'
  const age = heroAge(hero, ctx.season)
  const q = ctx.agent?.quality ?? 1
  const ovr = heroOvr(hero)
  let wage = fairWage(hero, ctx.club, ctx.season) * clamp(rng.normal(1, 0.07), 0.85, 1.15) * (1 + 0.02 * (q - 1))
  wage = roundNice(Math.max(MIN_WAGE, wage))
  const [lo, hi] = lengthRange(age)
  const years = kind === 'loan' ? 1 : rng.int(lo, hi)
  const bonusWeeks = 4 + 8 * (clamp(ctx.club.reputation, 1, 100) / 100) * rng.range(0.6, 1)
  const signingBonus = kind === 'loan' ? 0 : roundNice(wage * bonusWeeks * (kind === 'freeAgent' ? 2 : 1))
  const goalBonus = roundNice(wage * GOAL_BONUS_FACTOR[hero.position])
  const assistBonus = roundNice(goalBonus * 0.6)
  const clauseChance = ctx.club.reputation < 75 ? 0.5 : 0.15
  const releaseClause = kind !== 'loan' && rng.chance(clauseChance)
    ? roundNice(Math.max(heroMarketValue(hero, ctx.season), 100_000) * rng.range(1.8, 3))
    : null
  return {
    clubId: ctx.club.clubId,
    clubName: ctx.club.clubName,
    kind,
    startSeason: ctx.season,
    loan: kind === 'loan',
    terms: { wage, years, signingBonus, goalBonus, assistBonus, releaseClause, role: roleForStanding(ovr, ctx.club.squadAvgOvr, age) },
  }
}

// ───────────────────────── Evaluation ─────────────────────────

export interface OfferEvaluation {
  /** 0..100 desirability for the hero. */
  score: number
  verdict: LText
  reasons: LText[]
}

/**
 * Advisor-style evaluation of an offer (the agent's "what I think" panel).
 * score = 50 + wage vs fair (±30) + role (+6/−8 per rank) + prestige (±10)
 *         + raise/cut vs current wage + security/flexibility bonuses.
 */
export function evaluateOffer(
  offer: ContractOffer, hero: Hero, ctx: { club: ClubContext; season: number; currentWage?: number },
): OfferEvaluation {
  const reasons: LText[] = []
  const t = offer.terms
  let score = 50
  const fair = fairWage(hero, ctx.club, ctx.season)
  const ratio = t.wage / Math.max(1, fair)
  score += clamp((ratio - 1) * 60, -30, 30)
  if (ratio >= 1.1) reasons.push(lt('Maaş piyasa değerinin üzerinde.', 'Wage is above your market rate.'))
  else if (ratio <= 0.9) reasons.push(lt('Maaş piyasa değerinin altında.', 'Wage is below your market rate.'))
  else reasons.push(lt('Maaş piyasaya uygun.', 'Wage is in line with the market.'))

  const age = heroAge(hero, ctx.season)
  const expected = roleForStanding(heroOvr(hero), ctx.club.squadAvgOvr, age)
  const rd = roleRank(t.role) - roleRank(expected)
  score += rd > 0 ? rd * 6 : rd * 8
  reasons.push(fill(lt('Önerilen rol: {r}.', 'Offered role: {r}.'), { r: ROLE_NAMES[t.role] }))
  if (roleRank(t.role) <= roleRank('reserve')) reasons.push(lt('Forma şansın az olabilir.', 'You may struggle for minutes.'))

  const prestige = clamp((ctx.club.reputation - hero.reputation) * 0.15, -10, 10)
  score += prestige
  if (prestige >= 5) reasons.push(lt('Kariyerin için büyük bir basamak.', 'A big step up for your career.'))
  else if (prestige <= -5) reasons.push(lt('Bu kulüp senin seviyenin altında.', 'This club is below your level.'))

  if (ctx.currentWage && ctx.currentWage > 0) {
    if (t.wage >= ctx.currentWage * 1.2) { score += 5; reasons.push(lt('Ciddi bir maaş artışı.', 'A significant pay rise.')) }
    else if (t.wage < ctx.currentWage) { score -= 10; reasons.push(lt('Şu anki maaşından düşük.', 'Lower than your current wage.')) }
  }
  if (age <= 24 && t.years >= 4) { score += 3; reasons.push(lt('Uzun vadeli güven.', 'Long-term security.')) }
  if (age >= 30 && t.years >= 3) { score += 5; reasons.push(lt('Kariyerinin sonuna kadar güvence.', 'Security to the end of your career.')) }
  if (t.releaseClause !== null) { score += 2; reasons.push(lt('Serbest kalma maddesi sana esneklik sağlar.', 'A release clause keeps your options open.')) }
  if (offer.loan) reasons.push(lt('Kiralık: bir sezon düzenli forma fırsatı.', 'Loan: a season of regular football.'))

  score = Math.round(clamp(score, 0, 100))
  const verdict = score >= 70 ? lt('Harika teklif', 'Excellent offer')
    : score >= 55 ? lt('İyi teklif', 'Good offer')
      : score >= 40 ? lt('Ortalama teklif', 'Average offer')
        : lt('Zayıf teklif', 'Poor offer')
  return { score, verdict, reasons }
}

// ───────────────────────── Negotiation ─────────────────────────

export type NegotiationStatus = 'open' | 'agreed' | 'walkedAway' | 'expired' | 'rejected'

/** Club's hidden limits (the UI never shows these; the agent may hint). */
export interface HiddenLimits {
  maxWage: number
  maxSigningBonus: number
  maxGoalBonus: number
  maxAssistBonus: number
  minYears: number
  maxYears: number
  /** Lowest release clause the club will accept (hero wants it low / none). */
  minReleaseClause: number
  maxRoleRank: number
}

export interface NegotiationRound {
  round: number
  ask: Partial<ContractTerms>
  response: 'agree' | 'counter' | 'walk' | 'expired'
  patienceAfter: number
}

/** Full negotiation state (plain data → safe to store in the save). */
export interface NegotiationState {
  status: NegotiationStatus
  round: number
  maxRounds: number
  /** 0..100. 0 → club walks away. */
  patience: number
  /** Patience drain divisor from agent quality and the negotiator perk. */
  drainDivisor: number
  offer: ContractOffer
  hidden: HiddenLimits
  history: NegotiationRound[]
}

/** Max rounds before the club declares its last offer final. */
export const MAX_ROUNDS = 6

/**
 * Open talks on an offer.
 *  - Hidden wage headroom: +10..25% over the opening offer, +4% per agent level
 *    above 1 (a 5★ agent unlocks up to +41%).
 *  - Patience: 60..80 +5 per agent level, capped at 100.
 *  - Drain divisor: (1 + negotiator perk) × (1 + 6% per agent level above 1).
 */
export function startNegotiation(rng: Rng, offer: ContractOffer, hero: Hero, ctx: { agent?: Agent | null; season: number }): NegotiationState {
  const q = ctx.agent?.quality ?? 1
  const t = offer.terms
  const head = rng.range(0.1, 0.25) + 0.04 * (q - 1)
  const age = heroAge(hero, ctx.season)
  const [lo, hi] = offer.loan ? [1, 1] : lengthRange(age)
  const roleBump = rng.chance(0.35 + 0.05 * q) ? 1 : 0
  return {
    status: 'open',
    round: 0,
    maxRounds: MAX_ROUNDS,
    patience: Math.min(100, 60 + rng.int(0, 20) + 5 * (q - 1)),
    drainDivisor: (1 + perkValue(hero, 'negotiation_patience')) * (1 + 0.06 * (q - 1)),
    offer: { ...offer, terms: { ...t } },
    hidden: {
      maxWage: roundNice(t.wage * (1 + head)),
      maxSigningBonus: roundNice(Math.max(t.signingBonus, t.wage * 2) * (1.3 + 0.1 * q)),
      maxGoalBonus: roundNice(Math.max(t.goalBonus, 10) * 1.5),
      maxAssistBonus: roundNice(Math.max(t.assistBonus, 10) * 1.5),
      minYears: lo,
      maxYears: hi,
      minReleaseClause: t.releaseClause !== null
        ? roundNice(t.releaseClause * rng.range(0.65, 0.8))
        : roundNice(Math.max(heroMarketValue(hero, ctx.season), 100_000) * 1.5),
      maxRoleRank: Math.min(roleRank('star'), roleRank(t.role) + roleBump),
    },
    history: [],
  }
}

type MoneyKey = 'wage' | 'signingBonus' | 'goalBonus' | 'assistBonus'
const MONEY_KEYS: readonly MoneyKey[] = ['wage', 'signingBonus', 'goalBonus', 'assistBonus']
const maxKey = (k: MoneyKey): keyof HiddenLimits =>
  k === 'wage' ? 'maxWage' : k === 'signingBonus' ? 'maxSigningBonus' : k === 'goalBonus' ? 'maxGoalBonus' : 'maxAssistBonus'

/** Result of a negotiation step. */
export interface NegotiationStep {
  state: NegotiationState
  lines: Lines
}

/**
 * Submit the hero's counter-proposal.
 *
 * Per asked term the club computes either a *headroom fraction* (how much of
 * its hidden room the ask uses, 0..1) or an *excess* (ask beyond the hidden
 * limit, e.g. 0.3 = 30% too much). Then:
 *  - nothing asked above the current offer → instant agreement on the ask;
 *  - patience −= (4 + 18·fraction + 100·excess) / drainDivisor
 *    (a 2× wage demand ≈ −100: they walk away on the spot);
 *  - within limits: agree with probability 1 − 0.6·fraction, otherwise meet
 *    60% of the way;
 *  - beyond limits: concede half of the remaining room up to the limit;
 *  - after {@link MAX_ROUNDS} the current offer becomes final ('expired').
 */
export function counterOffer(rng: Rng, state: NegotiationState, ask: Partial<ContractTerms>): NegotiationStep {
  const s: NegotiationState = { ...state, offer: { ...state.offer, terms: { ...state.offer.terms } }, history: [...state.history] }
  if (s.status !== 'open') return { state: s, lines: [lt('Görüşmeler artık kapandı.', 'Talks are already closed.')] }
  s.round++
  const cur = s.offer.terms
  const h = s.hidden
  let fraction = 0
  let excess = 0
  let wantsMore = false

  for (const k of MONEY_KEYS) {
    const a = ask[k]
    if (a === undefined || !Number.isFinite(a) || a <= cur[k]) continue
    wantsMore = true
    const max = h[maxKey(k)] as number
    if (a <= max) fraction = Math.max(fraction, max > cur[k] ? (a - cur[k]) / (max - cur[k]) : 1)
    else { fraction = 1; excess += a / Math.max(1, max) - 1 }
  }
  if (ask.years !== undefined && ask.years !== cur.years) {
    wantsMore = true
    const off = ask.years < h.minYears ? h.minYears - ask.years : ask.years > h.maxYears ? ask.years - h.maxYears : 0
    excess += off * 0.3 // each year outside their comfort zone ≈ a 30% wage over-ask
  }
  if (ask.role !== undefined && roleRank(ask.role) > roleRank(cur.role)) {
    wantsMore = true
    const over = roleRank(ask.role) - h.maxRoleRank
    if (over > 0) excess += over * 0.4
    else fraction = Math.max(fraction, 0.5)
  }
  if (ask.releaseClause !== undefined && ask.releaseClause !== cur.releaseClause) {
    const a = ask.releaseClause
    if (a === null) {
      if (cur.releaseClause !== null) { wantsMore = true; excess += 0.5 } // removing a clause is a big ask
    } else if (cur.releaseClause === null || a < cur.releaseClause) {
      wantsMore = true
      if (a < h.minReleaseClause) excess += h.minReleaseClause / Math.max(1, a) - 1
      else fraction = Math.max(fraction, 0.3)
    }
  }

  const lines: Lines = []
  const record = (response: NegotiationRound['response']) =>
    s.history.push({ round: s.round, ask: { ...ask }, response, patienceAfter: s.patience })

  if (!wantsMore) {
    applyAsk(s, ask)
    s.status = 'agreed'
    record('agree')
    lines.push(fill(lt('{c} şartlarını hemen kabul etti!', '{c} accepted your terms straight away!'), { c: s.offer.clubName }))
    return { state: s, lines }
  }

  const drain = (4 + 18 * fraction + 100 * excess) / s.drainDivisor
  s.patience = Math.max(0, Math.round(s.patience - drain))
  if (s.patience <= 0) {
    s.status = 'walkedAway'
    record('walk')
    lines.push(fill(lt('{c} masadan kalktı. "Bu talepler gerçekçi değil."', '{c} walked away. "These demands are unrealistic."'), { c: s.offer.clubName }))
    return { state: s, lines }
  }

  if (excess === 0 && rng.chance(1 - 0.6 * fraction)) {
    applyAsk(s, ask)
    s.status = 'agreed'
    record('agree')
    lines.push(fill(lt('Anlaşma sağlandı! {c} talebini kabul etti.', 'Deal! {c} accepted your request.'), { c: s.offer.clubName }))
    return { state: s, lines }
  }

  // Counter-offer.
  for (const k of MONEY_KEYS) {
    const a = ask[k]
    if (a === undefined || !Number.isFinite(a) || a <= cur[k]) continue
    const max = h[maxKey(k)] as number
    cur[k] = roundNice(a <= max ? cur[k] + (a - cur[k]) * 0.6 : cur[k] + (max - cur[k]) * 0.5)
  }
  if (ask.years !== undefined) cur.years = clamp(ask.years, h.minYears, h.maxYears)
  if (ask.role !== undefined && roleRank(ask.role) > roleRank(cur.role)) {
    cur.role = ROLE_ORDER[Math.min(roleRank(ask.role), h.maxRoleRank)]
  }
  if (ask.releaseClause !== undefined && ask.releaseClause !== null && cur.releaseClause !== null) {
    cur.releaseClause = roundNice(Math.max(h.minReleaseClause, (ask.releaseClause + cur.releaseClause) / 2))
  }

  if (s.round >= s.maxRounds) {
    s.status = 'expired'
    record('expired')
    lines.push(fill(lt('{c}: "Bu son teklifimiz, ya kabul edersin ya da etmezsin."', '{c}: "This is our final offer. Take it or leave it."'), { c: s.offer.clubName }))
  } else {
    record('counter')
    lines.push(fill(lt('{c} karşı teklif yaptı: haftalık {w}.', '{c} made a counter-offer: {w} per week.'), { c: s.offer.clubName, w: fmtMoney(cur.wage) }))
    if (s.patience < 30) lines.push(lt('Menajerin uyarıyor: "Sabırları tükenmek üzere."', 'Your agent warns: "They are running out of patience."'))
  }
  return { state: s, lines }
}

/** Merge the asked terms into the offer (used on agreement). */
function applyAsk(s: NegotiationState, ask: Partial<ContractTerms>): void {
  const t = s.offer.terms
  for (const k of MONEY_KEYS) {
    const v = ask[k]
    if (v !== undefined && Number.isFinite(v) && v >= 0) t[k] = roundNice(v) || 0
  }
  if (ask.years !== undefined) t.years = clamp(Math.round(ask.years), 1, 5)
  if (ask.role !== undefined) t.role = ask.role
  if (ask.releaseClause !== undefined) t.releaseClause = ask.releaseClause
}

/** Accept the club's current offer (valid while open or after it became final). */
export function acceptOffer(state: NegotiationState): NegotiationStep {
  if (state.status !== 'open' && state.status !== 'expired') {
    return { state, lines: [lt('Bu teklif artık geçerli değil.', 'This offer is no longer valid.')] }
  }
  return {
    state: { ...state, status: 'agreed' },
    lines: [fill(lt('{c} ile anlaştın!', 'You agreed terms with {c}!'), { c: state.offer.clubName })],
  }
}

/** Reject the offer and end talks. */
export function rejectOffer(state: NegotiationState): NegotiationStep {
  if (state.status === 'agreed') return { state, lines: [lt('Zaten anlaşma imzalandı.', 'The deal is already done.')] }
  return {
    state: { ...state, status: 'rejected' },
    lines: [fill(lt('{c} teklifini reddettin.', 'You rejected the offer from {c}.'), { c: state.offer.clubName })],
  }
}

// ───────────────────────── Renewal & signing ─────────────────────────

export interface RenewalResult {
  offer: ContractOffer | null
  lines: Lines
}

/**
 * Club-initiated renewal. Triggered when the deal ends within a season or the
 * hero's fair wage exceeds his current wage by 30% (outperforming his deal).
 * Clubs only renew players the manager trusts (≥ 30); otherwise they let the
 * contract run down. New wage ≥ current × 1.05 (nobody renews for a pay cut
 * unless they are 33+, when ×0.9 of fair is acceptable).
 */
export function renewalOffer(rng: Rng, hero: Hero, ctx: OfferContext): RenewalResult {
  const c = hero.contract
  if (!c || c.loan || c.clubId !== ctx.club.clubId) return { offer: null, lines: [] }
  const fair = fairWage(hero, ctx.club, ctx.season)
  const expiring = c.untilSeason - ctx.season <= 1
  const underpaid = fair > c.wage * 1.3
  if (!expiring && !underpaid) return { offer: null, lines: [] }
  if (hero.managerTrust < 30) {
    return expiring
      ? { offer: null, lines: [lt('Kulüp sözleşmeni uzatmayı düşünmüyor gibi görünüyor.', 'The club does not seem keen to extend your contract.')] }
      : { offer: null, lines: [] }
  }
  const offer = generateContractOffer(rng, hero, { ...ctx, kind: 'renewal' })
  const age = heroAge(hero, ctx.season)
  const floor = age >= 33 ? Math.min(c.wage, fair * 0.9) : c.wage * 1.05
  offer.terms.wage = roundNice(Math.max(offer.terms.wage, floor))
  offer.startSeason = expiring ? c.untilSeason + 1 : ctx.season
  if (!expiring) offer.terms.years = Math.max(offer.terms.years, c.untilSeason - ctx.season + 1)
  // Big clubs protect their stars with a higher clause on renewal.
  if (c.releaseClause !== null && offer.terms.releaseClause !== null) {
    offer.terms.releaseClause = Math.max(offer.terms.releaseClause, c.releaseClause)
  }
  return {
    offer,
    lines: [fill(lt('{c} sözleşmeni yenilemek istiyor: haftalık {w}.', '{c} wants to renew your contract: {w} per week.'), { c: offer.clubName, w: fmtMoney(offer.terms.wage) })],
  }
}

/**
 * Sign an agreed offer: sets `hero.contract`, pays the signing bonus into
 * `life.money` (minus the agent's commission on it) and logs the event.
 */
export function applyContract(hero: Hero, life: Life, offer: ContractOffer, calendar: Calendar): Lines {
  hero.contract = toContract(offer)
  const bonus = offer.terms.signingBonus
  const commission = life.agent ? Math.round(bonus * clamp(life.agent.commission, 0, 0.3)) : 0
  const net = Math.max(0, bonus - commission)
  life.money += net
  const lines: Lines = []
  const until = hero.contract.untilSeason
  const head = offer.loan
    ? fill(lt('{c} ile {s} sezonu sonuna kadar kiralık sözleşme imzaladın.', 'You joined {c} on loan until the end of the {s} season.'), { c: offer.clubName, s: until })
    : fill(lt('{c} ile {s} yılına kadar sözleşme imzaladın (haftalık {w}).', 'You signed with {c} until {s} ({w} per week).'), { c: offer.clubName, s: until, w: fmtMoney(offer.terms.wage) })
  lines.push(pushLog(life, calendar, head, 'career', '✍️'))
  if (net > 0) {
    lines.push(pushLog(life, calendar, fill(lt('İmza parası hesabına yattı: {m}.', 'Signing bonus paid: {m}.'), { m: fmtMoney(net) }), 'money', '💰'))
  }
  return lines
}

/** Scout-style potential readout for offer screens (re-exported for convenience). */
export const potentialReadout = (hero: Hero): number => potentialStars(hero.potential)
