/**
 * GameActions over the real simulation (sim/game façade).
 *
 * Every action mutates the live state in place, then publishes with
 * `commit()`. Actions never navigate: the season review is requested through
 * `pendingNav`. Time-moving actions schedule a debounced, non-blocking
 * autosave and record the weekly history snapshot.
 */
import type { AttributeGroup, AttributeKey, GameState, LText, RelationKind } from '../../core/types'
import { Rng, clamp, hashString } from '../../core/rng'
import { ADULT_AGE, absWeek, isAdult } from '../../sim/career/common'
import type { ContractTerms, NegotiationState } from '../../sim/career/contract'
import { renewalOffer } from '../../sim/career/contract'
import { heroOvr } from '../../sim/career/progression'
import type { TrainingType } from '../../sim/career/training'
import { TRAINING_TYPES } from '../../sim/career/training'
import {
  cardRank, cardSuit, availableActions, blackjackTotalStake, handNet, handValue,
  type BlackjackOutcome, type BlackjackRound, type Card, type RouletteBetType,
} from '../../sim/life/casino'
import { netWorth } from '../../sim/life/economy'
import type { TrainingReport } from '../../sim/life/activities'
import { changeRelation } from '../../sim/life/relationships'
import type { PostType } from '../../sim/life/social'
import * as G from '../../sim/game'
import { GFLAG, absDayOf, clubContextOf, log, readJson, withRng, writeJson } from '../../sim/game/internal'
import { getOffers, setOffers } from '../../sim/game/season'
import type { AdvanceReport } from '../../sim/game'
import {
  blackjack, negotiation, pendingNav,
  type BlackjackHandView, type BlackjackView, type CardView, type Delta, type EventOutcomeView, type GameActions, type InteractionKind, type NegotiationView,
  type OfferTerms, type PostKind, type TrainingOutcomeView, type Rank, type SocialPostView, type Suit,
} from '../store'
import { eventDeltas, diffSnapshots, snapshot, teamViewOr } from './mapping'
import { slotSpinView } from './casinoView'
import { markDone, plannedSlots, doneSlots, setPlanned } from './plan'
import { readHistory, recordWeek } from './history'
import * as live from './liveMatch'
import {
  deleteAll, deleteSlot, exportSlot, flushAutosave, importSlot, loadState, pickSlotForNewCareer, saveState, scheduleAutosave,
} from './persistence'
import { POSTS_FLAG, REVIEW_FLAG, handleOf, raceCardFor, type ReviewExtras, type StoredPost } from './realData'
import { commit, current, get, notify, replaceState } from './session'
import { careerLocked } from '../../store-iap'

const L = (tr: string, en: string): LText => ({ tr, en })

// ───────────────────────── Time ─────────────────────────

/** Bookkeeping after time moved: history, season review, publish, autosave. */
function afterTime(s: GameState, reports: (AdvanceReport | undefined)[]): void {
  for (const r of reports) {
    if (r?.newSeason && careerLocked(s.calendar.season)) pendingNav.value = 'paywall'
    if (!r?.seasonEnded) continue
    const h = readHistory(s)
    const st = h.start
    const extras: ReviewExtras = {
      season: s.calendar.season,
      ovrStart: st?.ovr ?? heroOvr(s.hero),
      ovrEnd: heroOvr(s.hero),
      moneyEarned: earnedThisSeason(s) ?? Math.max(0, Math.round(netWorth(s.life, s.calendar) - (st?.netWorth ?? 0))),
      followersGained: Math.max(0, s.life.followers - (st?.followers ?? s.life.followers)),
    }
    writeJson(s.life, REVIEW_FLAG, extras)
    pendingNav.value = 'seasonEnd'
  }
  recordWeek(s)
  commit(s)
  scheduleAutosave()
}

function earnedThisSeason(s: GameState): number | null {
  const e = readJson<{ season: number; total: number } | null>(s.life, GFLAG.earned, null)
  return e && e.season === s.calendar.season ? e.total : null
}

/** Today's hero match is due now (afternoon slot or later, unplayed, hero available). */
const matchDueNow = (s: GameState): boolean => G.isHeroMatchday(s) && s.calendar.slot >= 1

/**
 * Trial paywall (WP-12): after the free first season the calendar is read-only until the
 * Full Career unlock. Lives here (UI backend), never in the sim, so results are identical.
 */
function lockedOut(s: GameState): boolean {
  if (!careerLocked(s.calendar.season)) return false
  notify(L("Kariyerin duraklatıldı: devam etmek için Tam Kariyer kilidini aç.", 'Your career is paused: unlock the Full Career to continue.'), 'info')
  pendingNav.value = 'paywall'
  return true
}

function advance(): void {
  const s = get()
  if (lockedOut(s)) return
  if (s.hero.retired) {
    notify(L('Kariyerin sona erdi.', 'Your career is over.'), 'info')
    return
  }
  if (live.liveActive()) {
    notify(L('Önce maçını tamamla.', 'Finish your match first.'), 'info')
    return
  }
  const reports: (AdvanceReport | undefined)[] = []
  if (matchDueNow(s) || (s.activeMatchId && G.isHeroMatchday(s))) {
    // Skipping the match: the sim plays it with auto-resolved highlights.
    live.clearLive()
    const rep = G.autoPlayHeroMatch(s)
    if (rep) notify(L(`Maç simüle edildi: ${rep.result.home}-${rep.result.away}`, `Match simulated: ${rep.result.home}-${rep.result.away}`), 'info')
    afterTime(s, reports)
    return
  }
  const slot = s.calendar.slot
  const planned = plannedSlots(s)[slot]
  const done = doneSlots(s)[slot]
  if (planned && !done) {
    const day = absDayOf(s)
    const res = G.doActivity(s, planned)
    if (res.ok) {
      if (absDayOf(s) === day) markDone(s, slot, slotsOf(planned), planned)
      reports.push(res.advance)
      if (planned === 'casino') notify(L('Kumarhanedesin: oyunlar Yaşam › Kumarhane bölümünde.', 'You are at the casino: games are under Life › Casino.'), 'info')
      afterTime(s, reports)
      return
    }
    notify(res.error)
  }
  reports.push(G.advanceSlot(s))
  afterTime(s, reports)
}

function slotsOf(activityId: string): number {
  return activityId.startsWith('train_') ? 1 : ['charity', 'sponsor_shoot', 'hobby_golf'].includes(activityId) ? 2 : activityId === 'travel' ? 3 : 1
}

function advanceToMatch(): void {
  const s = get()
  if (lockedOut(s)) return
  if (live.liveActive()) return
  if (G.isHeroMatchday(s)) {
    // Already matchday: just move to the match slot.
    if (s.calendar.slot === 0) {
      const r = G.advanceSlot(s)
      afterTime(s, [r])
    }
    return
  }
  const rep = G.advanceToNextMatch(s, { maxDays: 30 })
  // Morning of matchday: go straight to kick-off time.
  if (rep.stoppedBy === 'match' && s.calendar.slot === 0) G.advanceSlot(s)
  if (rep.stoppedBy === 'offer') notify(L('Yeni bir teklif var! Dünya › İlgi bölümüne bak.', 'A new offer arrived! Check World › Interest.'), 'info')
  if (rep.stoppedBy === 'limit') notify(L('Yakında maç yok.', 'No match coming up soon.'), 'info')
  afterTime(s, [rep])
}

// ───────────────────────── Activities ─────────────────────────

function runActivity(s: GameState, id: string, fn: () => G.ActionResult<unknown>): Delta[] {
  const before = snapshot(s)
  const slot = s.calendar.slot
  const day = absDayOf(s)
  const res = fn()
  if (!res.ok) {
    notify(res.error)
    return []
  }
  if (absDayOf(s) === day) {
    markDone(s, slot, slotsOf(id), id)
    if (plannedSlots(s)[slot] === id) setPlanned(s, slot as 0 | 1 | 2, null)
  }
  const deltas = diffSnapshots(before, snapshot(s))
  afterTime(s, [res.advance])
  return deltas
}

// ───────────────────────── Casino ─────────────────────────

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS: Suit[] = ['S', 'H', 'D', 'C']
const cardView = (c: Card, faceDown = false): CardView => ({ rank: RANKS[cardRank(c) - 1], suit: SUITS[cardSuit(c)], ...(faceDown ? { faceDown: true } : {}) })

function bjView(s: GameState, r: BlackjackRound): BlackjackView {
  const done = r.finished
  const activeIdx = done ? r.hands.length : Math.min(r.active, r.hands.length - 1)
  const hand = r.hands[Math.min(activeIdx, r.hands.length - 1)] ?? r.hands[0]
  const stake = blackjackTotalStake(r)
  const legal = done ? [] : availableActions(r, s.life.money - stake)
  const hands: BlackjackHandView[] = r.hands.map((h, i) => {
    const hv = handValue(h.cards)
    const out = done ? (r.outcomes[i] ?? null) : null
    return {
      cards: h.cards.map((c) => cardView(c)),
      total: hv.total,
      ...(hv.soft && hv.total <= 21 ? { soft: true } : {}),
      stake: h.stake,
      doubled: h.doubled,
      result: out,
      payout: out ? Math.round(handNet(out, h.stake)) : 0,
    }
  })
  const v: BlackjackView = {
    bet: stake,
    player: hand.cards.map((c) => cardView(c)),
    dealer: r.dealer.map((c, i) => cardView(c, !done && i === 1)),
    playerTotal: handValue(hand.cards).total,
    dealerTotal: done ? handValue(r.dealer).total : null,
    phase: done ? 'done' : 'player',
    result: done ? overallResult(r.outcomes, Math.round(r.payout - stake)) : null,
    payout: done ? Math.round(r.payout - stake) : 0,
    canDouble: legal.includes('double'),
    hands,
    active: activeIdx,
    canSplit: legal.includes('split'),
  }
  blackjack.value = v
  return v
}

/** Headline result: the single hand's outcome, or a summary of a split by net result. */
function overallResult(outcomes: BlackjackOutcome[], net: number): BlackjackView['result'] {
  if (outcomes.length <= 1) return outcomes[0] ?? null
  if (net > 0) return 'win'
  if (net === 0) return 'push'
  return outcomes.every((o) => o === 'bust') ? 'bust' : 'lose'
}

const emptyBj = (): BlackjackView => ({ bet: 0, player: [], dealer: [], playerTotal: 0, dealerTotal: null, phase: 'done', result: null, payout: 0, canDouble: false, hands: [], active: 0, canSplit: false })

/** Games need a casino visit today (the evening activity); visit automatically when possible. */
function ensureCasino(s: GameState): boolean {
  if (!isAdult(s.hero, s.calendar.season)) {
    notify(L(`Kumarhane ${ADULT_AGE} yaş ve üzeri içindir.`, `The casino is strictly ${ADULT_AGE}+.`), 'info')
    return false
  }
  if (s.life.flags[GFLAG.casinoDay] === absDayOf(s)) return true
  if (s.calendar.slot < 2) {
    notify(L('Kumarhane akşam açılıyor. Günü akşama kadar ilerlet.', 'The casino opens in the evening. Advance the day to the evening first.'))
    return false
  }
  const res = G.doActivity(s, 'casino')
  if (!res.ok) {
    notify(res.error)
    return false
  }
  markDone(s, 2, 1, 'casino')
  return true
}

function casinoDone(s: GameState): void {
  commit(s)
  scheduleAutosave(2500)
}

const ROULETTE_TYPE: Record<string, RouletteBetType> = {
  number: 'straight', red: 'red', black: 'black', odd: 'odd', even: 'even', low: 'low', high: 'high', dozen: 'dozen',
}

// ───────────────────────── Relations ─────────────────────────

const INTERACT: Record<InteractionKind, { rel: number; money: number; energy: number; happiness?: number; stress?: number; discipline?: number; memory: LText }> = {
  call: { rel: 3, money: 0, energy: 2, memory: L('Telefonda uzun uzun konuştunuz', 'You had a long phone call') },
  dinner: { rel: 6, money: 250, energy: 8, happiness: 3, memory: L('Birlikte yemeğe çıktınız', 'You went out for dinner') },
  gift: { rel: 8, money: 1500, energy: 4, memory: L('Hediye aldın', 'You bought a gift') },
  train: { rel: 5, money: 0, energy: 15, memory: L('Birlikte antrenman yaptınız', 'You trained together') },
  party: { rel: 5, money: 600, energy: 15, happiness: 4, discipline: -2, memory: L('Partide eğlendiniz', 'You partied together') },
  holiday: { rel: 15, money: 9000, energy: 10, stress: -12, happiness: 6, memory: L('Birlikte tatile çıktınız', 'You went on holiday together') },
  apologize: { rel: 10, money: 0, energy: 3, memory: L('Özür diledin', 'You apologised') },
}
const INTERACT_FLAG = 'g:int'

// ───────────────────────── Social ─────────────────────────

const POST_TYPE: Record<PostKind, PostType> = {
  training: 'training', luxury: 'luxury', family: 'family', charity: 'charity', provocative: 'provocation', fans: 'training',
}
const POST_TEXT: Record<PostKind, LText> = {
  training: L('Ekstra mesai. Hedef: daha iyisi. ⚽', 'Extra hours. Target: better. ⚽'),
  luxury: L('Yeni oyuncak 🏎️', 'New toy 🏎️'),
  family: L('Her şey onlar için ❤️', 'All for them ❤️'),
  charity: L('Bugün çocuklarla harika bir gündü. Teşekkürler!', 'Amazing day with the kids today. Thank you!'),
  provocative: L('Bazıları konuşur, biz gol atarız. 🤫', 'Some talk, we score. 🤫'),
  fans: L('Bu armayı taşımak bir onur. Maçta görüşürüz! 🔥', 'Wearing this badge is an honour. See you at the game! 🔥'),
}

// ───────────────────────── Negotiation ─────────────────────────

let nego: { offerId: string; kind: NegotiationView['kind']; clubId: string } | null = null

function negoView(s: GameState, st: NegotiationState, lines: LText[]): NegotiationView {
  const t = st.offer.terms
  const q = s.life.agent?.quality ?? 0
  const status: NegotiationView['status'] =
    st.status === 'agreed' ? 'accepted' : st.status === 'walkedAway' ? 'walkedAway' : st.status === 'rejected' ? 'rejected' : 'open'
  const agentLine: LText = !s.life.agent
    ? L('Menajerin yok; kulüp seni zorlayacak.', 'No agent: the club will squeeze you.')
    : st.status === 'expired'
      ? L('Bu son teklifleri. Ya imzala ya da bırak.', 'That is their final offer. Sign it or leave it.')
      : st.patience < 35
        ? L('Sabırları tükeniyor. Şimdi imzalamak akıllıca olabilir.', 'They are losing patience. Signing now might be wise.')
        : q >= 3 && t.wage < st.hidden.maxWage * 0.95
          ? L(`Haftalık ${st.hidden.maxWage.toLocaleString('tr-TR')} €'ya kadar çıkabileceklerini duydum.`, `I hear they can stretch to €${st.hidden.maxWage.toLocaleString('en-GB')} a week.`)
          : L('İmza parası konusunda biraz daha zorlayabiliriz.', 'We can push a little more on the signing bonus.')
  const club = teamViewOr(s, st.offer.clubId)
  const rc = t.releaseClause ?? st.hidden.minReleaseClause
  return {
    club,
    kind: nego?.kind ?? (st.offer.kind === 'renewal' ? 'renewal' : st.offer.loan ? 'loan' : 'transfer'),
    clubOffer: { wage: t.wage, years: t.years, signingBonus: t.signingBonus, goalBonus: t.goalBonus, releaseClause: t.releaseClause, role: t.role, ...(t.formGuarantee ? { formGuarantee: true } : {}) },
    ranges: {
      wage: [Math.round(t.wage * 0.5), Math.max(Math.round(t.wage * 2.2), st.hidden.maxWage)],
      years: [1, 5],
      signingBonus: [0, Math.max(Math.round(t.wage * 30), st.hidden.maxSigningBonus * 2)],
      goalBonus: [0, Math.max(Math.round(t.wage * 0.6), st.hidden.maxGoalBonus * 2, 100)],
      releaseClause: [Math.round(rc * 0.4), Math.round(Math.max(rc * 2.5, 100_000))],
    },
    patience: Math.round(st.patience),
    round: st.round + 1,
    maxRounds: st.maxRounds,
    agentLine,
    agentEstimate: q >= 3 ? st.hidden.maxWage : null,
    status,
    lastResponse: lines.length ? lines[lines.length - 1] : null,
  }
}

// ───────────────────────── Actions ─────────────────────────

function resetTransient(): void {
  live.clearLive()
  negotiation.value = null
  blackjack.value = null
  nego = null
  pendingNav.value = null
}

export const realActions: GameActions = {
  newGame(input) {
    resetTransient()
    const slot = pickSlotForNewCareer()
    const seed = input.seed ?? (hashString(`${input.firstName}|${input.lastName}|${Date.now()}`) >>> 0)
    const s = G.newGame({ ...input, slot }, seed)
    s.meta.slot = slot
    recordWeek(s)
    replaceState(s)
    void saveState(s, slot).catch((e: unknown) => console.warn('[StarPath] initial save failed', e))
  },
  async save(slot) {
    const s = get()
    live.persistNow()
    await saveState(s, slot ?? s.meta.slot ?? 1)
    commit(s)
  },
  async load(slot) {
    await flushAutosave().catch(() => {})
    const r = await loadState(slot)
    if (!r.state) {
      if (r.newerVersion) notify(L('Bu kayıt daha yeni bir sürümden. Lütfen oyunu güncelleyin.', 'This save is from a newer version. Please update the game.'), 'error')
      return false
    }
    resetTransient()
    replaceState(r.state)
    live.resumeAfterLoad(r.state)
    if (r.recoveredFromBackup !== null) {
      notify(L('Kayıt dosyası bozuktu; yedekten kurtarıldı.', 'The save was damaged and has been restored from a backup.'), 'warning')
    }
    return true
  },
  async deleteSave(slot) {
    await deleteSlot(slot)
  },
  exportSave: (slot) => exportSlot(slot),
  importSave: (json, slot) => importSlot(json, slot),
  async resetAll() {
    resetTransient()
    await deleteAll()
    replaceState(null)
  },

  planSlot(slot, activityId) {
    const s = get()
    setPlanned(s, slot, activityId)
    commit(s)
  },
  doActivity(id) {
    const s = get()
    if (lockedOut(s)) return []
    if (live.liveActive()) return []
    if (id === 'social_post') return runActivity(s, id, () => G.socialPost(s, 'training'))
    return runActivity(s, id, () => G.doActivity(s, id))
  },
  advance,
  advanceToMatch,

  resolveEvent(index, choice): EventOutcomeView {
    const s = get()
    const res = G.resolveEventChoice(s, index, choice)
    if (!res.ok || !res.value) {
      commit(s)
      return { text: res.error ?? L('Olmadı.', 'That did not work.'), deltas: [], success: false }
    }
    const out: EventOutcomeView = { text: res.value.text, deltas: eventDeltas(s, res.value.deltas), success: true }
    commit(s)
    scheduleAutosave()
    return out
  },

  train(sessionId, performance) {
    return trainSession(sessionId, performance).deltas
  },
  trainSession,
  unlockPerk(perkId) {
    const s = get()
    const r = G.unlockPerk(s, perkId)
    if (!r.ok) notify(r.error)
    commit(s)
    return r.ok
  },
  hireTrainer(offerId) {
    const s = get()
    const [group, q] = offerId.split(':')
    const quality = clamp(Number(q) || 1, 1, 3) as 1 | 2 | 3
    if (!['physical', 'technical', 'mental', 'goalkeeping'].includes(group)) return false
    let ok = false
    runActivity(s, 'hire_trainer', () => {
      const r = G.hireTrainer(s, group as AttributeGroup, quality)
      ok = r.ok
      return r
    })
    return ok
  },
  fireTrainer() {
    const s = get()
    const r = G.fireTrainer(s)
    if (!r.ok) notify(r.error)
    commit(s)
  },

  interact(relationshipId, kind) {
    const s = get()
    const rel = s.life.relationships[relationshipId]
    const cfg = INTERACT[kind]
    if (!rel || !cfg) return []
    const day = absDayOf(s)
    const today = readJson<{ d: number; ids: string[] }>(s.life, INTERACT_FLAG, { d: -1, ids: [] })
    const ids = today.d === day ? today.ids : []
    if (ids.includes(relationshipId)) {
      notify(L(`Bugün ${rel.name} ile zaten vakit geçirdin.`, `You already spent time with ${rel.name} today.`), 'info')
      return []
    }
    if (s.life.money < cfg.money) {
      notify(L('Bunun için yeterli paran yok.', 'You cannot afford that.'))
      return []
    }
    if (s.life.energy < cfg.energy) {
      notify(L('Enerjin yetersiz.', 'Not enough energy.'))
      return []
    }
    const before = snapshot(s)
    const week = absWeek(s.calendar)
    const gain = kind === 'apologize' && rel.value >= 0 ? 2 : cfg.rel
    // Public figures (fans/press) and bosses respond less to private gestures.
    const scale: Partial<Record<RelationKind, number>> = { fans: 0.5, press: 0.6, manager: 0.6, chairman: 0.6 }
    changeRelation(s.life, relationshipId, gain * (scale[rel.kind] ?? 1), { memory: cfg.memory, week, contact: true, hero: s.hero, cause: 'activity' })
    s.life.money -= cfg.money
    s.life.energy = clamp(s.life.energy - cfg.energy, 0, 100)
    if (cfg.happiness) s.life.happiness = clamp(s.life.happiness + cfg.happiness, 0, 100)
    if (cfg.stress) s.life.stress = clamp(s.life.stress + cfg.stress, 0, 100)
    if (cfg.discipline) s.life.discipline = clamp(s.life.discipline + cfg.discipline, 0, 100)
    if (kind === 'train') s.hero.fatigue = clamp(s.hero.fatigue + 5, 0, 100)
    writeJson(s.life, INTERACT_FLAG, { d: day, ids: [...ids, relationshipId] })
    log(s, [], { tr: `${rel.name}: ${cfg.memory.tr.toLocaleLowerCase('tr-TR')}`, en: `${rel.name}: ${cfg.memory.en.toLowerCase()}` }, 'relation', '❤️')
    const deltas = diffSnapshots(before, snapshot(s))
    commit(s)
    return deltas
  },
  buy(assetId) {
    const s = get()
    const r = G.buyAsset(s, assetId)
    if (!r.ok) notify(r.error)
    commit(s)
    if (r.ok) scheduleAutosave()
    return r.ok
  },
  sell(assetIndex) {
    const s = get()
    const m0 = s.life.money
    const r = G.sellAsset(s, assetIndex)
    if (!r.ok) notify(r.error)
    commit(s)
    return Math.round(s.life.money - m0)
  },
  bankDeposit(amount) {
    const s = get()
    const r = G.bankDeposit(s, Math.round(amount))
    if (!r.ok) notify(r.error)
    commit(s)
  },
  bankWithdraw(amount) {
    const s = get()
    const r = G.bankWithdraw(s, Math.round(amount))
    if (!r.ok) notify(r.error)
    commit(s)
  },
  takeLoan(amount, weeks) {
    const s = get()
    const r = G.bankLoan(s, Math.round(amount), weeks)
    if (!r.ok) notify(r.error)
    commit(s)
    return r.ok
  },
  repayLoan(amount) {
    const s = get()
    const r = G.bankRepay(s, Math.round(amount))
    if (!r.ok) notify(r.error)
    commit(s)
  },
  invest(kind, amount) {
    const s = get()
    const r = G.bankInvest(s, kind, Math.round(amount))
    if (!r.ok) notify(r.error)
    recordWeekForce(s)
    commit(s)
  },
  divest(investmentId) {
    const s = get()
    const m0 = s.life.money
    const r = G.bankSellInvestment(s, investmentId)
    if (!r.ok) notify(r.error)
    commit(s)
    return Math.round(s.life.money - m0)
  },
  post(kind) {
    const s = get()
    const f0 = s.life.followers
    const h = s.hero
    const r = G.socialPost(s, POST_TYPE[kind])
    const gain = Math.max(0, s.life.followers - f0)
    const p: SocialPostView = {
      id: `hp${Date.now().toString(36)}`,
      author: `${h.firstName} ${h.lastName}`,
      handle: handleOf(h.firstName, h.lastName),
      isHero: true, verified: h.reputation > 30, kind, text: POST_TEXT[kind],
      likes: Math.round(gain * 2.2 + s.life.followers * 0.03), comments: Math.round(gain * 0.05 + 8), weekAgo: 0,
    }
    if (!r.ok) {
      notify(r.error)
      return p
    }
    const stored = readJson<StoredPost[]>(s.life, POSTS_FLAG, [])
    const { weekAgo: _w, ...rest } = p
    void _w
    writeJson(s.life, POSTS_FLAG, [{ ...rest, w: absWeek(s.calendar) }, ...stored].slice(0, 12))
    afterTime(s, [r.advance])
    return p
  },
  acceptSponsor(id) {
    const s = get()
    const r = G.acceptSponsor(s, id)
    if (!r.ok) notify(r.error)
    commit(s)
  },
  declineSponsor(id) {
    const s = get()
    G.declineSponsor(s, id)
    commit(s)
  },
  hireAgent(quality) {
    const s = get()
    const r = G.hireAgent(s, quality)
    if (!r.ok) notify(r.error)
    commit(s)
  },
  casino: {
    blackjackDeal(bet) {
      const s = get()
      if (!ensureCasino(s)) return emptyBj()
      const r = G.blackjackDeal(s, Math.round(bet))
      if (!r.ok || !r.value) {
        notify(r.error)
        commit(s)
        return blackjack.value ?? emptyBj()
      }
      const v = bjView(s, r.value)
      casinoDone(s)
      return v
    },
    blackjackHit: () => bjAct('hit'),
    blackjackStand: () => bjAct('stand'),
    blackjackDouble: () => bjAct('double'),
    blackjackSplit: () => bjAct('split'),
    rouletteSpin(bets) {
      const s = get()
      if (!ensureCasino(s)) return { number: 0, color: 'green', net: 0 }
      const input = bets.map((b) => ({ type: ROULETTE_TYPE[b.kind] ?? 'red', stake: Math.round(b.amount), ...(b.value !== undefined ? { selection: b.value } : {}) }))
      const total = input.reduce((a, b) => a + b.stake, 0)
      const r = G.playRoulette(s, input)
      if (!r.ok || !r.value) {
        notify(r.error)
        commit(s)
        return { number: 0, color: 'green', net: 0 }
      }
      const n = r.value.pocket
      const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n)
      casinoDone(s)
      return { number: n, color: n === 0 ? 'green' : red ? 'red' : 'black', net: Math.round(r.value.payout - total) }
    },
    slotsSpin(bet) {
      const s = get()
      const none = { reels: [0, 1, 2], window: [[1, 0, 2], [2, 1, 0], [0, 2, 1]], wins: [], net: 0, winLine: false }
      if (!ensureCasino(s)) return none
      const stake = Math.round(bet)
      const r = G.playSlots(s, stake)
      if (!r.ok || !r.value) {
        notify(r.error)
        commit(s)
        return none
      }
      casinoDone(s)
      return slotSpinView(r.value, stake)
    },
    horseRace(bet, horse) {
      const s = get()
      const none = { timeline: [Array.from({ length: 8 }, () => 0)], order: [0, 1, 2, 3, 4, 5, 6, 7], net: 0 }
      if (!ensureCasino(s)) return none
      // Bet on exactly the card the player saw.
      writeJson(s.life, GFLAG.race, raceCardFor(s))
      const r = G.playHorses(s, horse, Math.round(bet))
      if (!r.ok || !r.value) {
        notify(r.error)
        commit(s)
        return none
      }
      casinoDone(s)
      return { timeline: r.value.result.frames, order: r.value.result.order, net: Math.round(r.value.payout - bet) }
    },
  },

  openNegotiation(clubId) {
    const s = get()
    negotiation.value = null
    nego = null
    const own = s.hero.contract?.clubId === clubId
    let offer = getOffers(s).find((o) => o.clubId === clubId && (!own || o.contract.kind === 'renewal'))
    if (!offer && own && s.hero.contract && !s.hero.contract.loan) {
      const res = withRng(s, (rng) => renewalOffer(rng, s.hero, { club: clubContextOf(s, clubId), season: s.calendar.season, agent: s.life.agent }))
      if (res.offer) {
        offer = { id: new Rng(hashString(`rn${absDayOf(s)}`)).id('rn'), clubId, clubName: res.offer.clubName, fee: 0, isLoan: false, viaReleaseClause: false, contract: res.offer }
        setOffers(s, [...getOffers(s), offer])
      } else {
        notify(res.lines[0] ?? L('Kulüp şu an sözleşmeni yenilemeyi düşünmüyor. Sözleşmenin son yılında ya da performansınla tekrar dene.', 'The club is not looking to renew yet. Try again in the last year of your deal or after a strong run.'), 'info')
        commit(s)
        return
      }
    }
    if (!offer) {
      notify(L('Bu kulüp henüz resmî bir teklif yapmadı.', 'This club has not made a formal offer yet.'), 'info')
      return
    }
    const r = G.startNegotiation(s, offer.id)
    if (!r.ok || !r.value) {
      notify(r.error)
      commit(s)
      return
    }
    nego = { offerId: offer.id, clubId, kind: offer.contract.kind === 'renewal' ? 'renewal' : offer.isLoan ? 'loan' : 'transfer' }
    negotiation.value = negoView(s, r.value, [])
    commit(s)
  },
  proposeTerms(terms: OfferTerms) {
    const s = get()
    const cur = G.currentNegotiation(s)
    if (!cur) return
    const ask: Partial<ContractTerms> = {
      wage: Math.round(terms.wage), years: terms.years, signingBonus: Math.round(terms.signingBonus), goalBonus: Math.round(terms.goalBonus),
      releaseClause: terms.releaseClause === null ? null : Math.round(terms.releaseClause), role: terms.role,
      ...(terms.formGuarantee !== undefined ? { formGuarantee: terms.formGuarantee } : {}),
    }
    const r = G.counterNegotiation(s, ask)
    if (r.value) negotiation.value = negoView(s, r.value, r.lines)
    else notify(r.error)
    afterNegotiation(s, r.value)
  },
  acceptOffer() {
    const s = get()
    const r = G.acceptNegotiation(s)
    if (r.value) negotiation.value = negoView(s, r.value, r.lines)
    else notify(r.error)
    afterNegotiation(s, r.value)
  },
  walkAway() {
    const s = get()
    const cur = G.currentNegotiation(s)
    if (!cur) {
      if (negotiation.value) negotiation.value = { ...negotiation.value, status: 'walkedAway' }
      return
    }
    const r = G.rejectNegotiation(s)
    negotiation.value = negoView(s, { ...cur.state, status: 'walkedAway' }, r.lines)
    if (nego?.kind === 'renewal') s.hero.managerTrust = clamp(s.hero.managerTrust - 3, 0, 100)
    nego = null
    commit(s)
  },
  requestTransfer() {
    const s = get()
    const r = G.requestTransfer(s)
    notify(r.lines[0], r.ok ? 'info' : 'error')
    commit(s)
  },

  playMatch() {
    const s = get()
    if (lockedOut(s)) return
    if (live.startMatch()) return
    const h = s.hero
    notify(h.injury
      ? L('Sakatsın; maçı tribünden izleyeceksin. Günü ilerlet.', 'You are injured and will watch from the stands. Advance the day.')
      : h.suspendedMatches > 0
        ? L('Cezalısın; bu maçta oynayamazsın.', 'You are suspended for this match.')
        : L('Bugün oynayacağın bir maç yok.', 'You have no match to play today.'), 'info')
  },
  matchSetSpeed: (speed) => live.setSpeed(speed),
  matchPause: (paused) => live.setPaused(paused),
  simMoment: () => live.simMoment(),
  playMoment: () => live.playMoment(),
  matchSimToEnd: () => live.simToEnd(),
  answerInterview(optionId) {
    const d = live.answer(optionId)
    scheduleAutosave()
    return d
  },
  finishMatch() {
    live.finishMatch()
    const s = current()
    if (s) afterTime(s, [])
  },

  continueSeason() {
    const s = current()
    pendingNav.value = null
    if (s) commit(s)
  },
}

function afterNegotiation(s: GameState, st: NegotiationState | undefined): void {
  if (st && st.status !== 'open' && st.status !== 'expired') nego = null
  commit(s)
  if (st?.status === 'agreed') scheduleAutosave(300)
}

function bjAct(action: 'hit' | 'stand' | 'double' | 'split'): BlackjackView {
  const s = get()
  const r = G.blackjackAct(s, action)
  if (!r.ok || !r.value) {
    notify(r.error)
    return blackjack.value ?? emptyBj()
  }
  const v = bjView(s, r.value)
  casinoDone(s)
  return v
}

/**
 * One training session with an optional mini-game score. Returns what it gave:
 * XP (total and per attribute, as granted by the sim), attribute/stat chips.
 */
function trainSession(sessionId: string, performance?: number): TrainingOutcomeView {
  const s = get()
  const perf = performance === undefined || !Number.isFinite(performance) ? undefined : clamp(performance, 0, 1)
  const fail = (error: LText): TrainingOutcomeView => ({ ok: false, error, performance: perf ?? 0.6, xp: 0, attrXp: [], deltas: [], injured: false })
  if (!(sessionId in TRAINING_TYPES)) return fail(L('Bilinmeyen seans.', 'Unknown session.'))
  if (live.liveActive()) return fail(L('Önce maçını tamamla.', 'Finish your match first.'))
  const type = sessionId as TrainingType
  let report: TrainingReport | undefined
  let error: LText | undefined
  const deltas = runActivity(s, `train_${type}`, () => {
    const r = G.train(s, type, perf)
    report = r.value
    if (!r.ok) error = r.error
    return r
  })
  if (!report) return fail(error ?? L('Antrenman yapılamadı.', 'Training was not possible.'))
  const attrXp = (Object.entries(report.xp) as [AttributeKey, number | undefined][])
    .map(([key, xp]) => ({ key, xp: Math.round((xp ?? 0) * 10) / 10 }))
    .filter((x) => x.xp > 0)
    .sort((a, b) => b.xp - a.xp)
  const xp = Math.round(attrXp.reduce((a, b) => a + b.xp, 0))
  return { ok: true, performance: report.performance, xp, attrXp, deltas: [{ key: 'xp', value: xp }, ...deltas], injured: report.injured }
}

/** Re-record this week's snapshot (new investment appears in the charts). */
function recordWeekForce(s: GameState): void {
  const h = readHistory(s)
  if (h.w.length) {
    h.w = h.w.slice(0, -1)
    writeJson(s.life, 'g:hist', h)
  }
  recordWeek(s)
}
