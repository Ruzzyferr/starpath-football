/**
 * Thin action functions the UI calls. Each mutates the GameState in place and
 * returns `{ ok, lines, error? }` (plus an optional typed `value`). No action
 * throws for a user mistake; invalid input yields `ok: false` + `error`.
 */
import type { AttributeGroup, GameState, Investment, LText, PendingEvent } from '../../core/types'
import { clamp } from '../../core/rng'
import type { Rng } from '../../core/rng'
import { SLOTS_PER_DAY } from '../../core/config'
import { ADULT_AGE, absWeek, fill, fmtMoney, isAdult, lt } from '../career/common'
import type { ContractTerms, NegotiationState } from '../career/contract'
import { acceptOffer as acceptNegotiated, applyContract, counterOffer, rejectOffer, startNegotiation as startNego } from '../career/contract'
import { unlockPerk as unlockPerkFn } from '../career/perks'
import { benchComplaint, type ComplaintApproach } from '../career/squadRole'
import type { TrainingIntensity, TrainingType } from '../career/training'
import { acceptTransfer, requestTransfer as requestTransferFn, withdrawTransferRequest as withdrawFn } from '../career/transfers'
import { hometownClubWelcome } from '../career/hometown'
import type { TransferOffer } from '../career/transfers'
import { performActivity, type ActivityOptions, type TrainingReport } from '../life/activities'
import {
  blackjackAction, canBet, createRace, createShoe, makeRouletteBet, playPassLine, playSevens, runRace, settleBet,
  settleHorseBet, settleRoulette, spinRoulette, spinSlot, startBlackjack, visitCasino,
} from '../life/casino'
import type { BlackjackAction, BlackjackRound, RaceCard, RaceResult, RouletteBetType, SevensBet, SlotSpin } from '../life/casino'
import * as eco from '../life/economy'
import { ensureRelation } from '../life/relationships'
import type { PostType } from '../life/social'
import { acceptSponsor as acceptSponsorFn } from '../life/sponsors'
import { clubStrength } from '../world/queries'
import { advanceDay, type AdvanceReport } from './calendar'
import { describeEvent, resolveEvent, rollEvents, type ResolvedEffect } from './eventsAdapter'
import { GFLAG, absDayOf, activityContext, clubContextOf, heroClub, log, logAll, readJson, withRng, writeJson } from './internal'
import { getOffers, getSponsorOffers, setOffers, setSponsorOffers, syncClubRelations, syncEventFlags } from './season'

export interface ActionResult<T = undefined> {
  ok: boolean
  lines: LText[]
  error?: LText
  value?: T
  /** Set when the action consumed the rest of the day and time advanced. */
  advance?: AdvanceReport
}

const fail = <T = undefined>(error: LText): ActionResult<T> => ({ ok: false, lines: [error], error })
const okr = <T = undefined>(lines: LText[], value?: T): ActionResult<T> => (value === undefined ? { ok: true, lines } : { ok: true, lines, value })

// ───────────────────────── Activities & training ─────────────────────────

/**
 * Do an activity in the current slot: applies effects, consumes its slots
 * (ending the day if the evening is used up), may fire event cards from the
 * activity's trigger tags. Casino visits unlock the casino games for today
 * and do NOT end the day: the UI calls `advanceDay` when the hero leaves.
 */
export function doActivity(state: GameState, activityId: string, opts: ActivityOptions = {}): ActionResult<TrainingReport> {
  if (state.hero.retired) return fail(lt('Emekli oldun.', 'You are retired.'))
  const res = withRng(state, (rng) => {
    const ctx = activityContext(state)
    const r = performActivity(rng, state.hero, state.life, activityId, ctx, opts)
    if (!r.ok) return { ...r, extra: [] as LText[] }
    const extra: LText[] = []
    let tags = r.triggerTags
    if (activityId === 'casino') {
      const v = visitCasino(rng, state.life, state.hero, { calendar: ctx.calendar, inSeason: ctx.inSeason, matchTomorrow: ctx.matchTomorrow })
      extra.push(...v.lines)
      tags = [...new Set([...tags, ...v.triggerTags])]
      state.life.flags[GFLAG.casinoDay] = absDayOf(state)
    }
    logAll(state, [], [...r.lines.slice(0, 1), ...extra], 'event')
    if (tags.length && rng.chance(clamp(r.eventChance, 0, 1))) rollEvents(state, rng, tags, 1)
    return { ...r, extra }
  })
  if (!res.ok) return fail(res.lines[0] ?? lt('Yapılamaz.', 'Not possible.'))
  const lines = [...res.lines, ...res.extra]
  const used = Math.max(1, res.slotsUsed)
  let advance: AdvanceReport | undefined
  // The casino keeps the evening open: games are played, then the UI ends the day (advanceDay).
  if (activityId === 'casino') state.calendar.slot = SLOTS_PER_DAY - 1
  else if (state.calendar.slot + used >= SLOTS_PER_DAY) advance = advanceDay(state)
  else state.calendar.slot += used
  lines.push(...syncEventFlags(state))
  return { ok: true, lines, ...(advance ? { advance } : {}), ...(res.training ? { value: res.training } : {}) }
}

/** Training session (mini-game score 0..1). */
export function train(state: GameState, type: TrainingType, performance?: number, intensity: TrainingIntensity = 'normal'): ActionResult<TrainingReport> {
  return doActivity(state, `train_${type}`, { trainingType: type, performance, intensity })
}

/** Social media post (uses the `social_post` activity slot). */
export function socialPost(state: GameState, type: PostType): ActionResult {
  return plain(doActivity(state, 'social_post', { postType: type }))
}

/** Hire a personal trainer (activity). */
export function hireTrainer(state: GameState, group: AttributeGroup, quality: 1 | 2 | 3 = 1): ActionResult {
  return plain(doActivity(state, 'hire_trainer', { trainerGroup: group, trainerQuality: quality }))
}

/** Drops the typed value of a result. */
function plain(r: ActionResult<unknown>): ActionResult {
  const { value: _value, ...rest } = r
  void _value
  return rest
}

/** Fire the personal trainer (no slot cost). */
export function fireTrainer(state: GameState): ActionResult {
  if (!state.life.trainer) return fail(lt('Özel antrenörün yok.', 'You have no personal trainer.'))
  const name = state.life.trainer.name
  state.life.trainer = null
  const out: LText[] = []
  log(state, out, fill(lt('{n} ile yollarını ayırdın.', 'You parted ways with {n}.'), { n: name }), 'career')
  return okr(out)
}

// ───────────────────────── Assets & bank ─────────────────────────

/** Run an economy function and report ok when money/savings/loan/assets changed. */
function moneyAction(state: GameState, fn: (rng: Rng) => LText[]): ActionResult {
  const l = state.life
  const fp = (): string => `${l.money}|${l.bank.savings}|${l.bank.loan?.remaining ?? -1}|${l.assets.length}|${l.bank.investments.length}`
  const before = fp()
  const lines = withRng(state, fn)
  if (fp() === before) return fail(lines[0] ?? lt('İşlem yapılamadı.', 'Transaction failed.'))
  logAll(state, [], lines, 'money', '💶')
  return okr(lines)
}

export const buyAsset = (state: GameState, defId: string): ActionResult =>
  moneyAction(state, () => eco.buyAsset(state.life, state.hero, defId, state.calendar))

export const sellAsset = (state: GameState, which: number | string): ActionResult =>
  moneyAction(state, () => eco.sellAsset(state.life, which, state.calendar).lines)

export const bankDeposit = (state: GameState, amount: number): ActionResult => moneyAction(state, () => eco.deposit(state.life, amount))
export const bankWithdraw = (state: GameState, amount: number): ActionResult => moneyAction(state, () => eco.withdraw(state.life, amount))
export const bankTermDeposit = (state: GameState, amount: number, weeks: number): ActionResult =>
  moneyAction(state, () => eco.openTermDeposit(state.life, amount, weeks, state.calendar))
export const bankBreakTerm = (state: GameState, id: string): ActionResult => moneyAction(state, () => eco.breakTermDeposit(state.life, id))
export const bankLoan = (state: GameState, amount: number, weeks: number): ActionResult =>
  moneyAction(state, () => eco.takeLoan(state.life, state.hero, amount, weeks, state.calendar))
export const bankRepay = (state: GameState, amount?: number): ActionResult => moneyAction(state, () => eco.repayLoan(state.life, amount))
export const bankInvest = (state: GameState, kind: Investment['kind'], amount: number): ActionResult =>
  moneyAction(state, (rng) => eco.invest(state.life, kind, amount, rng))
export const bankSellInvestment = (state: GameState, id: string): ActionResult =>
  moneyAction(state, () => eco.sellInvestment(state.life, id).lines)

// ───────────────────────── Casino ─────────────────────────

const atCasino = (state: GameState): boolean => state.life.flags[GFLAG.casinoDay] === absDayOf(state)
const notAtCasino = (): LText => lt('Önce kumarhaneye gitmelisin (akşam aktivitesi).', 'Visit the casino first (evening activity).')

function settle(state: GameState, stake: number, payout: number): LText[] {
  const r = settleBet(state.life, state.hero, stake, payout)
  logAll(state, [], r.lines, 'money', '🎰')
  return r.lines
}

/** Gambling is 18+: under-age heroes are turned away at the door. */
const underAge = (state: GameState): boolean => !isAdult(state.hero, state.calendar.season)
const underAgeText = (): LText => fill(lt('Kumarhaneye {a} yaşından küçükler giremez.', 'You must be {a} or older to gamble.'), { a: ADULT_AGE })

function checkBet(state: GameState, stake: number): LText | null {
  if (underAge(state)) return underAgeText()
  if (!atCasino(state)) return notAtCasino()
  const c = canBet(state.life, stake)
  return c.ok ? null : c.reason
}

/** Deal a blackjack round (stake is reserved until the round settles). */
export function blackjackDeal(state: GameState, stake: number): ActionResult<BlackjackRound> {
  const err = checkBet(state, stake)
  if (err) return fail(err)
  if (readJson<BlackjackRound | null>(state.life, GFLAG.blackjack, null)) return fail(lt('Önce eldeki eli bitir.', 'Finish the current hand first.'))
  return withRng(state, (rng) => {
    const round = startBlackjack(rng, createShoe(rng), stake)
    return finishBlackjackIfDone(state, round)
  })
}

/** Hit / stand / double / split on the current blackjack round. */
export function blackjackAct(state: GameState, action: BlackjackAction): ActionResult<BlackjackRound> {
  const round = readJson<BlackjackRound | null>(state.life, GFLAG.blackjack, null)
  if (!round) return fail(lt('Masada açık el yok.', 'No hand in play.'))
  const extra = action === 'double' || action === 'split' ? round.hands[round.active]?.stake ?? 0 : 0
  const committed = round.hands.reduce((s, h) => s + h.stake, 0)
  if (extra > 0 && committed + extra > state.life.money) return fail(lt('Bunun için paran yetmiyor.', 'Not enough cash for that.'))
  return withRng(state, (rng) => {
    if (!blackjackAction(rng, round, action)) return fail<BlackjackRound>(lt('Bu hamle şu an yapılamaz.', 'That move is not allowed now.'))
    return finishBlackjackIfDone(state, round)
  })
}

function finishBlackjackIfDone(state: GameState, round: BlackjackRound): ActionResult<BlackjackRound> {
  if (!round.finished) {
    writeJson(state.life, GFLAG.blackjack, round)
    return okr([], round)
  }
  writeJson(state.life, GFLAG.blackjack, null)
  const stake = round.hands.reduce((s, h) => s + h.stake, 0)
  return okr(settle(state, stake, round.payout), round)
}

export interface RouletteBetInput {
  type: RouletteBetType
  stake: number
  selection?: number | readonly number[]
}

/** Spin the roulette wheel with one or more bets. */
export function playRoulette(state: GameState, bets: readonly RouletteBetInput[]): ActionResult<{ pocket: number; payout: number }> {
  const made = bets.map((b) => makeRouletteBet(b.type, b.stake, b.selection))
  if (made.length === 0 || made.some((b) => !b)) return fail(lt('Geçersiz bahis.', 'Invalid bet.'))
  const total = bets.reduce((s, b) => s + b.stake, 0)
  const err = checkBet(state, total)
  if (err) return fail(err)
  return withRng(state, (rng) => {
    const spin = spinRoulette(rng)
    const payout = settleRoulette(made.filter((b) => b !== null), spin.pocket)
    return okr(settle(state, total, payout), { pocket: spin.pocket, payout })
  })
}

/** One slot-machine spin. */
export function playSlots(state: GameState, stake: number): ActionResult<SlotSpin> {
  const err = checkBet(state, stake)
  if (err) return fail(err)
  return withRng(state, (rng) => {
    const spin = spinSlot(rng, stake)
    return okr(settle(state, stake, spin.payout), spin)
  })
}

/** Race card for the next horse race (created once, shown before betting). */
export function horseRaceCard(state: GameState): ActionResult<RaceCard> {
  if (underAge(state)) return fail(underAgeText())
  if (!atCasino(state)) return fail(notAtCasino())
  const existing = readJson<RaceCard | null>(state.life, GFLAG.race, null)
  if (existing) return okr([], existing)
  return withRng(state, (rng) => {
    const card = createRace(rng)
    writeJson(state.life, GFLAG.race, card)
    return okr([], card)
  })
}

/** Bet on a horse of the current race card and run the race. */
export function playHorses(state: GameState, horse: number, stake: number): ActionResult<{ card: RaceCard; result: RaceResult; payout: number }> {
  const err = checkBet(state, stake)
  if (err) return fail(err)
  const card = readJson<RaceCard | null>(state.life, GFLAG.race, null) ?? horseRaceCard(state).value
  if (!card || !Number.isInteger(horse) || horse < 0 || horse >= card.horses.length) return fail(lt('Geçersiz at.', 'Invalid horse.'))
  return withRng(state, (rng) => {
    const result = runRace(rng, card)
    const payout = settleHorseBet(card, result, horse, stake)
    writeJson(state.life, GFLAG.race, null)
    return okr(settle(state, stake, payout), { card, result, payout })
  })
}

/** Dice: over/under/seven, or craps pass line (`bet = 'pass'`). */
export function playDice(state: GameState, bet: SevensBet | 'pass', stake: number): ActionResult<{ dice: [number, number][]; win: boolean; payout: number }> {
  const err = checkBet(state, stake)
  if (err) return fail(err)
  return withRng(state, (rng) => {
    if (bet === 'pass') {
      const r = playPassLine(rng)
      const payout = r.win ? stake * 2 : 0
      return okr(settle(state, stake, payout), { dice: r.rolls, win: r.win, payout })
    }
    const r = playSevens(rng, bet, stake)
    return okr(settle(state, stake, r.payout), { dice: [r.dice], win: r.win, payout: r.payout })
  })
}

// ───────────────────────── Sponsors & agent ─────────────────────────

export function acceptSponsor(state: GameState, offerId: string): ActionResult {
  const offers = getSponsorOffers(state)
  const o = offers.find((x) => x.deal.id === offerId)
  if (!o) return fail(lt('Teklif bulunamadı.', 'Offer not found.'))
  const r = acceptSponsorFn(state.life, o)
  if (!r.ok) return fail(r.lines[0])
  setSponsorOffers(state, offers.filter((x) => x !== o && x.deal.category !== o.deal.category))
  logAll(state, [], r.lines, 'money', '🤝')
  return okr(r.lines)
}

export function declineSponsor(state: GameState, offerId: string): ActionResult {
  const offers = getSponsorOffers(state)
  if (!offers.some((x) => x.deal.id === offerId)) return fail(lt('Teklif bulunamadı.', 'Offer not found.'))
  setSponsorOffers(state, offers.filter((x) => x.deal.id !== offerId))
  return okr([])
}

/** Agent tiers: commission and one-off fee by quality (1..5). Better agents want famous clients. */
export const AGENT_TIERS: Readonly<Record<number, { commission: number; fee: number; minReputation: number }>> = {
  1: { commission: 0.05, fee: 500, minReputation: 0 },
  2: { commission: 0.06, fee: 2500, minReputation: 10 },
  3: { commission: 0.08, fee: 10000, minReputation: 25 },
  4: { commission: 0.1, fee: 50000, minReputation: 45 },
  5: { commission: 0.12, fee: 250000, minReputation: 65 },
}
const AGENT_NAMES = ['Cem Kaya', 'Marco Bellini', 'Sarah Whitfield', 'Jorge Mendoza', 'Hakan Aydın', 'Lena Vogel', 'Pierre Dumas', 'Rui Costa Neto']

export function hireAgent(state: GameState, quality: number): ActionResult {
  const q = clamp(Math.round(quality), 1, 5)
  const tier = AGENT_TIERS[q]
  if (state.hero.reputation < tier.minReputation) return fail(lt('Bu menajer seninle çalışmak için henüz yeterince ünlü değilsin diyor.', 'This agent says you are not famous enough yet.'))
  if (state.life.money < tier.fee) return fail(fill(lt('Menajer ücreti için {m} gerekiyor.', 'You need {m} for the agent fee.'), { m: fmtMoney(tier.fee) }))
  return withRng(state, (rng) => {
    const name = rng.pick(AGENT_NAMES)
    state.life.money -= tier.fee
    state.life.agent = { name, quality: q, commission: tier.commission }
    ensureRelation(state.life, 'agent', 'agent', name, 10, absWeek(state.calendar))
    const out: LText[] = []
    log(state, out, fill(lt('{n} artık menajerin ({q}★, komisyon %{c}).', '{n} is now your agent ({q}★, {c}% commission).'), { n: name, q, c: Math.round(tier.commission * 100) }), 'career', '🕴️')
    return okr(out)
  })
}

export function fireAgent(state: GameState): ActionResult {
  if (!state.life.agent) return fail(lt('Menajerin yok.', 'You have no agent.'))
  const out: LText[] = []
  log(state, out, fill(lt('{n} ile çalışmayı bıraktın.', 'You stopped working with {n}.'), { n: state.life.agent.name }), 'career')
  state.life.agent = null
  delete state.life.relationships.agent
  return okr(out)
}

// ───────────────────────── Contracts & transfers ─────────────────────────

export const listOffers = (state: GameState): TransferOffer[] => getOffers(state)

interface StoredNegotiation {
  offerId: string
  state: NegotiationState
}

export const currentNegotiation = (state: GameState): StoredNegotiation | null => readJson<StoredNegotiation | null>(state.life, GFLAG.negotiation, null)

/** Sign an offer as is (or with negotiated terms). */
function signOffer(state: GameState, offer: TransferOffer): ActionResult {
  const h = state.hero
  const out: LText[] = []
  return withRng(state, (rng) => {
    if (offer.contract.kind === 'renewal') {
      if (!h.contract || h.contract.clubId !== offer.clubId) return fail(lt('Bu yenileme teklifi artık geçersiz.', 'This renewal offer is no longer valid.'))
      out.push(...applyContract(h, state.life, offer.contract, state.calendar))
    } else {
      const old = heroClub(state)
      const to = state.world.clubs[offer.clubId]
      if (!to) return fail(lt('Kulüp bulunamadı.', 'Club not found.'))
      out.push(...acceptTransfer(rng, h, state.life, offer, state.calendar, { managerName: to.managerName, oldClubName: old?.name }))
      out.push(...hometownClubWelcome(h, state.life, to.city, to.name, state.calendar))
      if (offer.fee > 0 && !offer.isLoan) {
        to.budget -= offer.fee
        if (old) old.budget += offer.fee
      }
      syncClubRelations(state)
    }
    setOffers(state, getOffers(state).filter((o) => o.contract.kind === 'renewal' && o.clubId === h.contract?.clubId && o.id !== offer.id))
    writeJson(state.life, GFLAG.negotiation, null)
    return okr(out)
  })
}

/** Accept an offer without negotiating. */
export function acceptOffer(state: GameState, offerId: string): ActionResult {
  const offer = getOffers(state).find((o) => o.id === offerId)
  if (!offer) return fail(lt('Teklif bulunamadı.', 'Offer not found.'))
  return signOffer(state, offer)
}

/** Decline an offer (renewal declines pause new renewal offers for 8 weeks). */
export function declineOffer(state: GameState, offerId: string): ActionResult {
  const offers = getOffers(state)
  const offer = offers.find((o) => o.id === offerId)
  if (!offer) return fail(lt('Teklif bulunamadı.', 'Offer not found.'))
  if (offer.contract.kind === 'renewal') state.life.flags[GFLAG.renewalDeclined] = absWeek(state.calendar)
  setOffers(state, offers.filter((o) => o.id !== offerId))
  const n = currentNegotiation(state)
  if (n?.offerId === offerId) writeJson(state.life, GFLAG.negotiation, null)
  return okr([fill(lt('{c} teklifini reddettin.', 'You declined the offer from {c}.'), { c: offer.clubName })])
}

/** Open contract talks on an offer. */
export function startNegotiation(state: GameState, offerId: string): ActionResult<NegotiationState> {
  const offer = getOffers(state).find((o) => o.id === offerId)
  if (!offer) return fail(lt('Teklif bulunamadı.', 'Offer not found.'))
  return withRng(state, (rng) => {
    const nego = startNego(rng, offer.contract, state.hero, { agent: state.life.agent, season: state.calendar.season })
    writeJson(state.life, GFLAG.negotiation, { offerId, state: nego } satisfies StoredNegotiation)
    return okr([fill(lt('{c} ile görüşmeler başladı.', 'Talks with {c} have started.'), { c: offer.clubName })], nego)
  })
}

/** Counter-propose terms. Agreement signs the contract immediately. */
export function counterNegotiation(state: GameState, ask: Partial<ContractTerms>): ActionResult<NegotiationState> {
  const cur = currentNegotiation(state)
  if (!cur) return fail(lt('Açık görüşme yok.', 'No open negotiation.'))
  const step = withRng(state, (rng) => counterOffer(rng, cur.state, ask))
  if (step.state.status === 'agreed') {
    const res = finalizeNegotiation(state, cur.offerId, step.state)
    return { ...res, lines: [...step.lines, ...res.lines], value: step.state }
  }
  if (step.state.status === 'walkedAway') {
    writeJson(state.life, GFLAG.negotiation, null)
    setOffers(state, getOffers(state).filter((o) => o.id !== cur.offerId))
    return { ok: true, lines: step.lines, value: step.state }
  }
  writeJson(state.life, GFLAG.negotiation, { offerId: cur.offerId, state: step.state } satisfies StoredNegotiation)
  return okr(step.lines, step.state)
}

/** Accept the club's current terms in an open negotiation. */
export function acceptNegotiation(state: GameState): ActionResult<NegotiationState> {
  const cur = currentNegotiation(state)
  if (!cur) return fail(lt('Açık görüşme yok.', 'No open negotiation.'))
  const step = acceptNegotiated(cur.state)
  if (step.state.status !== 'agreed') return fail(step.lines[0])
  const res = finalizeNegotiation(state, cur.offerId, step.state)
  return { ...res, lines: [...step.lines, ...res.lines], value: step.state }
}

/** Walk away from talks (offer removed). */
export function rejectNegotiation(state: GameState): ActionResult {
  const cur = currentNegotiation(state)
  if (!cur) return fail(lt('Açık görüşme yok.', 'No open negotiation.'))
  const step = rejectOffer(cur.state)
  writeJson(state.life, GFLAG.negotiation, null)
  declineOffer(state, cur.offerId)
  return okr(step.lines)
}

function finalizeNegotiation(state: GameState, offerId: string, nego: NegotiationState): ActionResult {
  const offer = getOffers(state).find((o) => o.id === offerId)
  if (!offer) return fail(lt('Teklif artık geçerli değil.', 'The offer is no longer valid.'))
  return signOffer(state, { ...offer, contract: nego.offer })
}

export function requestTransfer(state: GameState): ActionResult {
  const lines = requestTransferFn(state.hero, state.life, state.calendar)
  return { ok: state.life.flags.transfer_requested !== undefined, lines }
}

export function withdrawTransferRequest(state: GameState): ActionResult {
  const lines = withdrawFn(state.hero, state.life, state.calendar)
  return lines.length ? okr(lines) : fail(lt('Aktif transfer talebin yok.', 'You have no active transfer request.'))
}

/** Complain about playing time (only after a bench streak: `life.flags.can_complain`). */
export function complainAboutBench(state: GameState, approach: ComplaintApproach): ActionResult<string> {
  const club = heroClub(state)
  if (!club) return fail(lt('Bir kulübün yok.', 'You have no club.'))
  if (state.life.flags.can_complain !== true) return fail(lt('Şu an şikâyet etmen için bir sebep yok.', 'There is nothing to complain about right now.'))
  return withRng(state, (rng) => {
    const r = benchComplaint(rng, state.hero, state.life, approach, { squadAvgOvr: clubStrength(state.world, club.id).overall, season: state.calendar.season }, state.calendar)
    logAll(state, [], r.lines, 'career')
    return okr(r.lines, r.outcome)
  })
}

/** Contract-offer context helper for UI previews (fair-wage maths). */
export const offerClubContext = clubContextOf

// ───────────────────────── Perks, events, retirement ─────────────────────────

export function unlockPerk(state: GameState, perkId: string): ActionResult {
  const before = state.hero.perks.length
  const lines = unlockPerkFn(state.hero, perkId)
  return state.hero.perks.length > before ? okr(lines) : fail(lines[0])
}

/**
 * Resolve a pending decision card by index. Locked or invalid choices return
 * `ok: false` instead of throwing.
 */
export function resolveEventChoice(state: GameState, index: number, choice: number): ActionResult<ResolvedEffect> {
  const pending: PendingEvent | undefined = state.pendingEvents[index]
  if (!pending) return fail(lt('Karar kartı bulunamadı.', 'Decision card not found.'))
  try {
    const res = withRng(state, (rng) => resolveEvent(state, rng, pending, choice))
    const lines = [res.text, ...syncEventFlags(state)]
    return okr(lines, res)
  } catch {
    // Unknown definition → drop the card so the game can never soft-lock.
    const view = describeEvent(state, pending, 'en')
    if (!view) {
      state.pendingEvents.splice(index, 1)
      return fail(lt('Bu kart artık geçerli değil.', 'This card is no longer valid.'))
    }
    return fail(lt('Bu seçenek şu an kullanılamaz.', 'This choice is not available right now.'))
  }
}

/** Index of the first enabled choice of a pending card (autopilot / tests). */
export function firstEnabledChoice(state: GameState, index: number): number {
  const p = state.pendingEvents[index]
  const v = p ? describeEvent(state, p, 'en') : null
  if (!v) return 0
  const i = v.choices.findIndex((c) => c.enabled)
  return i < 0 ? 0 : i
}

/**
 * End the career (from 33+, or any age after a serious injury). The full flow
 * (decision card, testimonial, documentary, Hall of Fame) is sim/game/retirement;
 * `force` skips the age check for forced retirements decided there.
 */
export function retire(state: GameState, opts: { force?: boolean } = {}): ActionResult {
  const h = state.hero
  if (h.retired) return fail(lt('Zaten emeklisin.', 'You are already retired.'))
  const age = state.calendar.season - h.birthYear
  if (!opts.force && age < 33 && !(h.injury && h.injury.severity === 3)) return fail(lt('Emeklilik için henüz çok gençsin (33+).', 'You are too young to retire (33+).'))
  h.retired = true
  h.contract = null
  h.nationalTeam.called = false
  setOffers(state, [])
  syncClubRelations(state)
  const out: LText[] = []
  log(state, out, fill(lt('Kariyerine nokta koydun: {a} maç, {g} gol. Teşekkürler efsane!', 'You hung up your boots: {a} apps, {g} goals. Thanks, legend!'), { a: h.careerStats.apps, g: h.careerStats.goals }), 'career', '👋')
  return okr(out)
}
