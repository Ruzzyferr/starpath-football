/**
 * Transfers (GDD 2.4): scout interest, transfer & loan offers, free agency,
 * transfer requests and completing a move.
 *
 * The world module supplies candidate clubs as plain data
 * ({@link CandidateClub}); nothing here reads `World` directly. All offers are
 * returned as serializable data for the UI to present.
 */
import type { Agent, Calendar, Hero, LText, Life, SquadRole } from '../../core/types'
import type { Rng } from '../../core/rng'
import { absWeek, clamp, fameGain, fill, fmtMoney, heroAge, lt, meter, pushLog, pushNews, NEWS_SOURCES, type Lines } from './common'
import { heroOvr, potentialStars } from './progression'
import {
  applyContract, generateContractOffer, heroMarketValue, roundNice, type ClubContext, type ContractOffer,
} from './contract'
import { ensureRelation } from '../life/relationships'

export { heroMarketValue } from './contract'

/** A club that could be interested in the hero. */
export interface CandidateClub {
  clubId: string
  name: string
  /** 1..100 */
  reputation: number
  leagueTier?: number
  countryId?: string
  squadAvgOvr: number
  /** Weekly wage budget (total). */
  wageBudget?: number
  /** Transfer budget; clubs never bid more than this. */
  transferBudget?: number
}

export type InterestStage = 'watching' | 'interested' | 'bidding'

export interface ClubInterest {
  clubId: string
  name: string
  /** 0..100 */
  level: number
  stage: InterestStage
  label: LText
}

export type TransferWindow = 'summer' | 'winter' | null

/** A transfer (or loan / free-agent) offer as data. */
export interface TransferOffer {
  id: string
  clubId: string
  clubName: string
  /** Fee paid to the current club (0 for free agents; loan fee for loans). */
  fee: number
  isLoan: boolean
  /** True when the bid matches the release clause (current club cannot block). */
  viaReleaseClause: boolean
  contract: ContractOffer
}

/** Minimal info about the hero's current club. */
export interface CurrentClubInfo {
  clubId: string
  name: string
  reputation: number
}

const STAGE_LABEL: Readonly<Record<InterestStage, LText>> = {
  watching: lt('Scout\'ları seni izliyor', 'Scouts are watching you'),
  interested: lt('Ciddi şekilde ilgileniyor', 'Seriously interested'),
  bidding: lt('Teklif hazırlıyor', 'Preparing a bid'),
}

/** Interest thresholds. */
const WATCH_AT = 35
const INTEREST_AT = 55
const BID_AT = 75

/** Flag key set by {@link requestTransfer} (value = absolute week). */
export const TRANSFER_REQUEST_FLAG = 'transfer_requested'

const toClubContext = (c: CandidateClub): ClubContext => ({
  clubId: c.clubId, clubName: c.name, reputation: c.reputation, squadAvgOvr: c.squadAvgOvr, wageBudget: c.wageBudget,
})

/** OVR below a club's squad average at which its scouts are fully interested. */
export const SCOUT_FIT_MARGIN = 1

/**
 * Scout interest per candidate club (current club excluded), sorted by level.
 *
 * level = fit + fame + youth upside + form + request + noise, where
 *  - fit: clubs want players around their level: 60 when OVR ≈ squad avg − 1
 *    (balance pass: was − 3, which moved 17-year-olds up a tier every window),
 *    +2 per OVR above (max +25); −8 per OVR below (they don't need you);
 *  - fame: (hero rep − 0.6·club rep) × 0.3, ±15 — big clubs ignore unknowns;
 *  - youth: ≤ 21 → (scouted potential stars − 2.5) × 8 (wonderkid premium);
 *  - form: (form − 50) × 0.3; transfer request: +10; noise N(0, 6).
 */
export function scoutInterest(
  rng: Rng, hero: Hero, candidates: readonly CandidateClub[], ctx: { season: number; currentClubId?: string | null; life?: Life },
): ClubInterest[] {
  const ovr = heroOvr(hero)
  const age = heroAge(hero, ctx.season)
  const requested = ctx.life ? ctx.life.flags[TRANSFER_REQUEST_FLAG] !== undefined : false
  const out: ClubInterest[] = []
  for (const c of candidates) {
    if (c.clubId === (ctx.currentClubId ?? hero.contract?.clubId)) continue
    const d = ovr - (c.squadAvgOvr - SCOUT_FIT_MARGIN)
    let level = d >= 0 ? 60 + Math.min(25, d * 2) : 60 + d * 8
    level += clamp((hero.reputation - 0.6 * c.reputation) * 0.3, -15, 15)
    if (age <= 21) level += (potentialStars(hero.potential, rng.normal(0, 4)) - 2.5) * 8
    level += (hero.form - 50) * 0.3
    if (requested) level += 10
    level += rng.normal(0, 6)
    level = Math.round(clamp(level, 0, 100))
    if (level < WATCH_AT) continue
    const stage: InterestStage = level >= BID_AT ? 'bidding' : level >= INTEREST_AT ? 'interested' : 'watching'
    out.push({ clubId: c.clubId, name: c.name, level, stage, label: STAGE_LABEL[stage] })
  }
  return out.sort((a, b) => b.level - a.level)
}

/** Context for offer generation. */
export interface TransferContext {
  window: TransferWindow
  season: number
  currentClub?: CurrentClubInfo | null
  agent?: Agent | null
  /** Pre-computed interest (otherwise computed here). */
  interest?: ClubInterest[]
}

/** Max simultaneous offers presented (keeps the decision readable). */
const MAX_OFFERS = 4

/**
 * Transfer bids during an open window. Bidding clubs bid 50% of the time,
 * interested ones 15% (+25 points each after a transfer request). Fee =
 * market value × 0.8..1.2 (big clubs pay a premium, +0.2% per rep point).
 * A club clearly bigger than yours (+10 rep) that can afford the release
 * clause triggers it 30% of the time — those bids cannot be refused by the
 * current club. Free agents get no transfer offers (see {@link freeAgentOffers}).
 */
export function generateTransferOffers(
  rng: Rng, hero: Hero, life: Life, candidates: readonly CandidateClub[], ctx: TransferContext,
): TransferOffer[] {
  if (!ctx.window || !hero.contract) return []
  const interest = ctx.interest ?? scoutInterest(rng, hero, candidates, { season: ctx.season, currentClubId: hero.contract.clubId, life })
  const requested = life.flags[TRANSFER_REQUEST_FLAG] !== undefined
  const byId = new Map(candidates.map((c) => [c.clubId, c]))
  const value = heroMarketValue(hero, ctx.season)
  const clause = hero.contract.releaseClause
  const curRep = ctx.currentClub?.reputation ?? 0
  const offers: TransferOffer[] = []
  for (const i of interest) {
    if (offers.length >= MAX_OFFERS) break
    const c = byId.get(i.clubId)
    if (!c || i.stage === 'watching') continue
    const p = (i.stage === 'bidding' ? 0.5 : 0.15) + (requested ? 0.25 : 0)
    if (!rng.chance(p)) continue
    const budget = c.transferBudget ?? Infinity
    let fee = roundNice(value * rng.range(0.8, 1.2) * (1 + c.reputation * 0.002))
    let viaClause = false
    if (clause !== null && clause <= budget && c.reputation >= curRep + 10 && rng.chance(0.3)) {
      fee = clause
      viaClause = true
    }
    if (fee > budget) continue
    const contract = generateContractOffer(rng, hero, { club: toClubContext(c), season: ctx.season, agent: ctx.agent, kind: 'transfer' })
    offers.push({ id: rng.id('tr'), clubId: c.clubId, clubName: c.name, fee, isLoan: false, viaReleaseClause: viaClause, contract })
  }
  return offers
}

/** Role ladder rank. */
const RANK: Readonly<Record<SquadRole, number>> = { youth: 0, reserve: 1, rotation: 2, starter: 3, star: 4, captain: 5 }

/**
 * Loan offers for young (≤ 23) heroes who are not regulars (role ≤ rotation
 * or manager trust < 40). Loan clubs are smaller (rep ≤ current − 5) and the
 * hero would start there (OVR ≥ their squad avg − 2). Fee ≈ 5% of market value.
 * Up to 3 offers.
 */
export function generateLoanOffers(
  rng: Rng, hero: Hero, candidates: readonly CandidateClub[], ctx: TransferContext,
): TransferOffer[] {
  const c0 = hero.contract
  if (!ctx.window || !c0 || c0.loan) return []
  const age = heroAge(hero, ctx.season)
  if (age > 23) return []
  if (RANK[c0.role] > RANK.rotation && hero.managerTrust >= 40) return []
  const ovr = heroOvr(hero)
  const curRep = ctx.currentClub?.reputation ?? 100
  const pool = candidates.filter((c) => c.clubId !== c0.clubId && c.reputation <= curRep - 5 && ovr >= c.squadAvgOvr - 2)
  // Prefer the strongest club where he'd still play.
  pool.sort((a, b) => b.reputation - a.reputation)
  const offers: TransferOffer[] = []
  for (const c of pool) {
    if (offers.length >= 3) break
    if (!rng.chance(0.6)) continue
    const contract = generateContractOffer(rng, hero, { club: toClubContext(c), season: ctx.season, agent: ctx.agent, kind: 'loan' })
    // The parent club keeps paying at least the current wage.
    contract.terms.wage = Math.max(contract.terms.wage, c0.wage)
    contract.terms.goalBonus = c0.goalBonus
    contract.terms.assistBonus = c0.assistBonus
    offers.push({
      id: rng.id('ln'), clubId: c.clubId, clubName: c.name, fee: roundNice(heroMarketValue(hero, ctx.season) * 0.05),
      isLoan: true, viaReleaseClause: false, contract,
    })
  }
  return offers
}

/**
 * Free agency: offers when the hero has no contract or it has expired. Clubs
 * at 'watching' level or above may offer (35/60/90% by stage), with double
 * signing bonuses (no fee). Anti-soft-lock: if nobody bites, the weakest club
 * whose level the hero matches (OVR ≥ avg − 5) always makes an offer.
 * Works outside transfer windows (free agents can sign any time).
 */
export function freeAgentOffers(
  rng: Rng, hero: Hero, candidates: readonly CandidateClub[], ctx: { season: number; agent?: Agent | null; life?: Life },
): TransferOffer[] {
  if (hero.contract && hero.contract.untilSeason >= ctx.season) return []
  const interest = scoutInterest(rng, hero, candidates, { season: ctx.season, currentClubId: null, life: ctx.life })
  const byId = new Map(candidates.map((c) => [c.clubId, c]))
  const offers: TransferOffer[] = []
  const make = (c: CandidateClub): TransferOffer => ({
    id: rng.id('fa'), clubId: c.clubId, clubName: c.name, fee: 0, isLoan: false, viaReleaseClause: false,
    contract: generateContractOffer(rng, hero, { club: toClubContext(c), season: ctx.season, agent: ctx.agent, kind: 'freeAgent' }),
  })
  for (const i of interest) {
    if (offers.length >= 3) break
    const p = i.stage === 'bidding' ? 0.9 : i.stage === 'interested' ? 0.6 : 0.35
    const c = byId.get(i.clubId)
    if (c && rng.chance(p)) offers.push(make(c))
  }
  if (offers.length === 0 && candidates.length > 0) {
    const ovr = heroOvr(hero)
    const fits = candidates.filter((c) => ovr >= c.squadAvgOvr - 5)
    const pool = fits.length > 0 ? fits : [...candidates]
    pool.sort((a, b) => a.reputation - b.reputation)
    offers.push(make(fits.length > 0 ? pool[pool.length - 1] : pool[0]))
  }
  return offers
}

/**
 * Hand in a transfer request. Costs: manager trust −15, fans −10, manager
 * relationship −15. Benefit: +10 scout interest and +25% bid chance until a
 * move happens. Idempotent while a request is active.
 */
export function requestTransfer(hero: Hero, life: Life, calendar: Calendar): Lines {
  if (!hero.contract) return [lt('Sözleşmen yok; zaten serbestsin.', 'You have no contract; you are already free.')]
  if (life.flags[TRANSFER_REQUEST_FLAG] !== undefined) return [lt('Transfer talebin zaten masada.', 'Your transfer request is already on the table.')]
  life.flags[TRANSFER_REQUEST_FLAG] = absWeek(calendar)
  hero.managerTrust = meter(hero.managerTrust - 15)
  const fans = life.relationships.fans
  if (fans) fans.value = clamp(fans.value - 10, -100, 100)
  const mgr = life.relationships.manager
  if (mgr) mgr.value = clamp(mgr.value - 15, -100, 100)
  return [pushLog(life, calendar, lt('Transfer talebinde bulundun. Teknik direktör ve taraftarlar bundan hoşlanmadı.', 'You handed in a transfer request. The manager and fans are not pleased.'), 'career', '📝')]
}

/** Withdraw a transfer request (small trust recovery: +5). */
export function withdrawTransferRequest(hero: Hero, life: Life, calendar: Calendar): Lines {
  if (life.flags[TRANSFER_REQUEST_FLAG] === undefined) return []
  delete life.flags[TRANSFER_REQUEST_FLAG]
  hero.managerTrust = meter(hero.managerTrust + 5)
  return [pushLog(life, calendar, lt('Transfer talebini geri çektin.', 'You withdrew your transfer request.'), 'career', '↩️')]
}

/** Manager-trust baseline at a new club by role: stars arrive trusted, kids must earn it. */
export const ARRIVAL_TRUST: Readonly<Record<SquadRole, number>> = {
  youth: 35, reserve: 40, rotation: 45, starter: 55, star: 65, captain: 70,
}

/** Flag keys used to remember the parent contract during a loan. */
const LOAN_PARENT = 'loan_parent'

/**
 * Complete a move: signs the contract (signing bonus paid), resets manager
 * trust by role, resets the manager relationship (new person), cools fan
 * relations (a new crowd: 20% of the old value carries over), clears the
 * transfer request, logs and publishes a headline. For loans the parent
 * contract is stashed in `life.flags` so {@link endLoan} can restore it.
 * Teammates: the caller should run `ensureTeammates` with the new squad.
 */
export function acceptTransfer(
  rng: Rng, hero: Hero, life: Life, offer: TransferOffer, calendar: Calendar,
  opts: { managerName?: string; oldClubName?: string } = {},
): Lines {
  const lines: Lines = []
  const old = hero.contract
  if (offer.isLoan && old) {
    life.flags[LOAN_PARENT] = JSON.stringify(old)
  }
  delete life.flags[TRANSFER_REQUEST_FLAG]
  lines.push(...applyContract(hero, life, offer.contract, calendar))
  hero.managerTrust = ARRIVAL_TRUST[offer.contract.terms.role]
  // New club → new manager: always a fresh relationship.
  delete life.relationships.manager
  ensureRelation(life, 'manager', 'manager', opts.managerName ?? 'Teknik Direktör / Manager', 0, absWeek(calendar))
  const fans = life.relationships.fans
  if (fans) { fans.value = Math.round(fans.value * 0.2); fans.memory = [] }
  // A big move is news; the fee drives the headline and fame.
  const name = `${hero.firstName} ${hero.lastName}`
  let headline: LText
  if (offer.isLoan) {
    headline = fill(lt('{p}, {c} takımına kiralandı', '{p} joins {c} on loan'), { p: name, c: offer.clubName })
  } else if (offer.fee <= 0) {
    headline = fill(lt('{p} bonservissiz olarak {c} ile anlaştı', '{p} signs for {c} on a free transfer'), { p: name, c: offer.clubName })
  } else if (offer.viaReleaseClause) {
    headline = fill(lt('Bomba! {c}, {p} için serbest kalma bedeli olan {f}\'yu ödedi', 'Bombshell! {c} trigger {p}\'s {f} release clause'), { p: name, c: offer.clubName, f: fmtMoney(offer.fee) })
  } else {
    headline = fill(lt('{p}, {f} bonservisle {c} yolunda', '{p} completes {f} move to {c}'), { p: name, c: offer.clubName, f: fmtMoney(offer.fee) })
  }
  pushNews(life, rng, calendar, headline, 1, rng.pick(NEWS_SOURCES))
  // Fame: +1 per ~doubling of fee above 1M (a 64M move ≈ +6), less once already famous
  // (balance pass: frequent big moves pushed everyone to 100).
  if (offer.fee >= 1_000_000) hero.reputation = meter(hero.reputation + fameGain(hero.reputation, Math.min(8, Math.log2(offer.fee / 1_000_000))))
  lines.push(pushLog(life, calendar, headline, 'career', '🔁'))
  if (opts.oldClubName) {
    lines.push(fill(lt('{o} taraftarlarına veda ettin.', 'You said goodbye to the {o} fans.'), { o: opts.oldClubName }))
  }
  return lines
}

/**
 * End a loan: restores the stashed parent contract (if it is still valid),
 * otherwise leaves the hero without a contract (free agent).
 */
export function endLoan(hero: Hero, life: Life, calendar: Calendar): Lines {
  const raw = life.flags[LOAN_PARENT]
  delete life.flags[LOAN_PARENT]
  if (typeof raw !== 'string') return []
  try {
    const parent = JSON.parse(raw) as NonNullable<Hero['contract']>
    if (parent.untilSeason >= calendar.season) {
      hero.contract = parent
      hero.managerTrust = ARRIVAL_TRUST[parent.role]
      return [pushLog(life, calendar, lt('Kiralık dönemin bitti, kulübüne geri döndün.', 'Your loan has ended; you are back at your parent club.'), 'career', '🏠')]
    }
  } catch {
    // Corrupted flag: fall through to free agency.
  }
  hero.contract = null
  return [pushLog(life, calendar, lt('Kiralık dönemin bitti ve sözleşmen sona erdi: artık serbest oyuncusun.', 'Your loan has ended and so has your contract: you are a free agent.'), 'career', '🆓')]
}
