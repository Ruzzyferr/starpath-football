/**
 * Casino & betting (GDD 4.5): real game logic for Blackjack, European
 * Roulette, a 3×3 slot machine, horse racing and dice, plus a bookkeeping
 * layer (money, addiction meter, stress, responsible-gaming loss limit,
 * discipline/news risk when gambling during the season).
 *
 * Design rules
 * ------------
 *  - Every game is honest maths with a real house edge; no hidden rigging.
 *    Tests in casino.test.ts verify each return-to-player (RTP).
 *  - All randomness goes through {@link Rng}; all state (shoe, round, race) is
 *    plain serializable data so a game can be saved mid-hand.
 *  - Game functions never touch Life. The UI runs a game, then calls
 *    {@link settleBet} once with the total stake and total payout
 *    (payout = amount returned to the player INCLUDING the stake; 0 = lost).
 *
 * Expected RTPs (house edge):
 *  Blackjack 6-deck S17, DAS, 3:2, basic strategy ≈ 99.5% (0.5%)
 *  Roulette single zero, any bet = 36/37 ≈ 97.3% (2.7%)
 *  Slots ≈ 94.2% (exact, see {@link slotExactRtp})
 *  Horses = 1/1.15 ≈ 87% (15% overround, like a real tote)
 *  Craps pass line ≈ 98.6% · Over/Under 7 ≈ 83.3%
 */
import type { Calendar, Hero, Life } from '../../core/types'
import type { Rng } from '../../core/rng'
import { absWeek, clamp, fill, fmtMoney, lt, meter, pushNews, type Lines } from '../career/common'
import type { LText } from '../../core/types'
import { perkValue } from '../career/perks'
import { addHappiness, addStress } from './wellbeing'

// ═════════════════════════════ Blackjack ═════════════════════════════

/** Card id 0..51: rank = id % 13 + 1 (1 = Ace, 11–13 = J/Q/K), suit = floor(id / 13) (♠♥♦♣). */
export type Card = number

export const cardRank = (c: Card): number => (c % 13) + 1
export const cardSuit = (c: Card): number => Math.floor(c / 13)
/** Blackjack value of a card: Ace = 11 (soft), face = 10. */
export const cardValue = (c: Card): number => {
  const r = cardRank(c)
  return r === 1 ? 11 : r >= 10 ? 10 : r
}
const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
/** Short label like "A♠", "10♥". */
export const cardLabel = (c: Card): string => RANKS[cardRank(c) - 1] + SUITS[cardSuit(c)]

/** Multi-deck shoe; serializable. */
export interface Shoe {
  cards: Card[]
  pos: number
  decks: number
  /** Reshuffle before a new round once `pos` passes this (cut card). */
  cutAt: number
}

/** Standard casino shoe size. */
export const SHOE_DECKS = 6
/** Cut card at 75% penetration: realistic, keeps card counting weak. */
export const SHOE_PENETRATION = 0.75

/** Create and shuffle a fresh shoe. */
export function createShoe(rng: Rng, decks = SHOE_DECKS): Shoe {
  const cards: Card[] = []
  for (let d = 0; d < decks; d++) for (let i = 0; i < 52; i++) cards.push(i)
  rng.shuffle(cards)
  return { cards, pos: 0, decks, cutAt: Math.floor(cards.length * SHOE_PENETRATION) }
}

function reshuffle(rng: Rng, shoe: Shoe): void {
  rng.shuffle(shoe.cards)
  shoe.pos = 0
}

/** Draw one card (reshuffles if the shoe is physically exhausted). */
export function drawCard(rng: Rng, shoe: Shoe): Card {
  if (shoe.pos >= shoe.cards.length) reshuffle(rng, shoe)
  return shoe.cards[shoe.pos++]
}

/** Hand total with soft-ace handling. `soft` = an ace is still counted as 11. */
export function handValue(cards: readonly Card[]): { total: number; soft: boolean } {
  let total = 0
  let aces = 0
  for (const c of cards) {
    total += cardValue(c)
    if (cardRank(c) === 1) aces++
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return { total, soft: aces > 0 }
}

export const isBlackjack = (cards: readonly Card[]): boolean => cards.length === 2 && handValue(cards).total === 21

export interface BlackjackHand {
  cards: Card[]
  stake: number
  doubled: boolean
  done: boolean
  /** Split aces receive exactly one card and cannot act. */
  splitAces: boolean
  /** Hand came from a split (21 is not a natural). */
  fromSplit: boolean
}

export type BlackjackAction = 'hit' | 'stand' | 'double' | 'split'

export type BlackjackOutcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust'

export interface BlackjackRound {
  shoe: Shoe
  dealer: Card[]
  hands: BlackjackHand[]
  /** Index of the hand currently acting. */
  active: number
  finished: boolean
  /** Per-hand outcome once finished. */
  outcomes: BlackjackOutcome[]
  /** Total returned to the player (incl. stakes) once finished. */
  payout: number
}

/**
 * Amount returned for one settled hand (incl. its stake): natural 3:2,
 * win 1:1, push refunds, lose/bust nothing.
 */
export function handReturn(outcome: BlackjackOutcome, stake: number): number {
  return outcome === 'blackjack' ? stake * (1 + BLACKJACK_PAYS) : outcome === 'win' ? stake * 2 : outcome === 'push' ? stake : 0
}

/** Net result of one settled hand (return − stake). */
export const handNet = (outcome: BlackjackOutcome, stake: number): number => handReturn(outcome, stake) - stake

/** Max hands after splitting (one split). */
export const MAX_SPLIT_HANDS = 2
/** Natural blackjack pays 3:2 (returns 2.5× stake). */
export const BLACKJACK_PAYS = 1.5

/**
 * Deal a new round. Reshuffles at the cut card. Dealer peeks with an Ace or
 * ten-value up card: a dealer natural ends the round immediately (player
 * natural pushes). Player natural vs no dealer natural pays 3:2 at once.
 */
export function startBlackjack(rng: Rng, shoe: Shoe, stake: number): BlackjackRound {
  if (shoe.pos >= shoe.cutAt) reshuffle(rng, shoe)
  const p1 = drawCard(rng, shoe)
  const d1 = drawCard(rng, shoe)
  const p2 = drawCard(rng, shoe)
  const d2 = drawCard(rng, shoe)
  const round: BlackjackRound = {
    shoe,
    dealer: [d1, d2],
    hands: [{ cards: [p1, p2], stake, doubled: false, done: false, splitAces: false, fromSplit: false }],
    active: 0,
    finished: false,
    outcomes: [],
    payout: 0,
  }
  const dealerBJ = isBlackjack(round.dealer)
  const playerBJ = isBlackjack(round.hands[0].cards)
  // Peek: only possible to have a natural with A or 10-value up card, so this is equivalent.
  if (dealerBJ || playerBJ) {
    round.hands[0].done = true
    finishRound(rng, round, /* dealerPlays */ false)
  }
  return round
}

/** Total amount staked in the round (initial + doubles + splits). */
export const blackjackTotalStake = (round: BlackjackRound): number => round.hands.reduce((s, h) => s + h.stake, 0)

/**
 * Legal actions for the active hand. `extraFunds` = money the player can still
 * put on the table (double/split need one more initial stake).
 */
export function availableActions(round: BlackjackRound, extraFunds = Infinity): BlackjackAction[] {
  if (round.finished) return []
  const h = round.hands[round.active]
  if (!h || h.done) return []
  const acts: BlackjackAction[] = ['hit', 'stand']
  const two = h.cards.length === 2
  if (two && extraFunds >= h.stake) acts.push('double') // double after split allowed (DAS)
  if (
    two &&
    round.hands.length < MAX_SPLIT_HANDS &&
    cardValue(h.cards[0]) === cardValue(h.cards[1]) &&
    extraFunds >= h.stake
  ) acts.push('split')
  return acts
}

function advance(rng: Rng, round: BlackjackRound): void {
  while (round.active < round.hands.length && round.hands[round.active].done) round.active++
  if (round.active >= round.hands.length) {
    const anyLive = round.hands.some((h) => handValue(h.cards).total <= 21)
    finishRound(rng, round, anyLive)
  }
}

/**
 * Apply a player action to the active hand. Illegal actions are ignored
 * (returns false). The round finishes automatically after the last hand.
 */
export function blackjackAction(rng: Rng, round: BlackjackRound, action: BlackjackAction): boolean {
  if (round.finished) return false
  const h = round.hands[round.active]
  if (!h || h.done) return false
  const legal = availableActions(round)
  if (!legal.includes(action)) return false
  const shoe = round.shoe
  switch (action) {
    case 'hit': {
      h.cards.push(drawCard(rng, shoe))
      if (handValue(h.cards).total >= 21) h.done = true
      break
    }
    case 'stand':
      h.done = true
      break
    case 'double':
      h.stake *= 2
      h.doubled = true
      h.cards.push(drawCard(rng, shoe))
      h.done = true
      break
    case 'split': {
      const aces = cardRank(h.cards[0]) === 1
      const second: BlackjackHand = {
        cards: [h.cards[1], drawCard(rng, shoe)], stake: h.stake, doubled: false, done: false, splitAces: aces, fromSplit: true,
      }
      h.cards = [h.cards[0], drawCard(rng, shoe)]
      h.fromSplit = true
      h.splitAces = aces
      round.hands.splice(round.active + 1, 0, second)
      for (const x of [h, second]) {
        if (aces || handValue(x.cards).total >= 21) x.done = true
      }
      break
    }
  }
  advance(rng, round)
  return true
}

/** Dealer draws to 17 and stands on all 17s (S17), then settles every hand. */
function finishRound(rng: Rng, round: BlackjackRound, dealerPlays: boolean): void {
  if (dealerPlays) {
    while (handValue(round.dealer).total < 17) round.dealer.push(drawCard(rng, round.shoe))
  }
  const dealerBJ = isBlackjack(round.dealer)
  const dTotal = handValue(round.dealer).total
  let payout = 0
  round.outcomes = round.hands.map((h) => {
    const pBJ = !h.fromSplit && isBlackjack(h.cards)
    const total = handValue(h.cards).total
    let o: BlackjackOutcome
    if (pBJ && dealerBJ) o = 'push'
    else if (pBJ) o = 'blackjack'
    else if (dealerBJ) o = 'lose'
    else if (total > 21) o = 'bust'
    else if (dTotal > 21 || total > dTotal) o = 'win'
    else if (total === dTotal) o = 'push'
    else o = 'lose'
    payout += handReturn(o, h.stake)
    return o
  })
  round.payout = payout
  round.finished = true
  round.active = round.hands.length
}

/**
 * Basic strategy for 4–8 decks, dealer stands on soft 17, double after split.
 * Used by tests to verify the house edge and by an optional "advisor" hint.
 * @param upCard dealer up card
 * @param canDouble / canSplit whether those actions are currently legal
 */
export function basicStrategyAction(cards: readonly Card[], upCard: Card, canDouble: boolean, canSplit: boolean): BlackjackAction {
  const d = cardValue(upCard) // 2..11
  if (canSplit && cards.length === 2 && cardValue(cards[0]) === cardValue(cards[1])) {
    const v = cardValue(cards[0])
    const split =
      v === 11 || v === 8 ||
      (v === 9 && d !== 7 && d !== 10 && d !== 11) ||
      ((v === 7 || v === 3 || v === 2) && d <= 7) ||
      (v === 6 && d <= 6) ||
      (v === 4 && (d === 5 || d === 6))
    if (split) return 'split'
  }
  const { total, soft } = handValue(cards)
  const dbl = (cond: boolean, fallback: BlackjackAction): BlackjackAction => (cond ? (canDouble ? 'double' : fallback) : fallback)
  if (soft && cards.length >= 2) {
    if (total >= 20) return 'stand'
    if (total === 19) return d === 6 ? dbl(true, 'stand') : 'stand'
    if (total === 18) {
      if (d <= 6) return dbl(true, 'stand')
      return d <= 8 ? 'stand' : 'hit'
    }
    if (total === 17) return d >= 3 && d <= 6 ? dbl(true, 'hit') : 'hit'
    if (total >= 15) return d >= 4 && d <= 6 ? dbl(true, 'hit') : 'hit'
    return d >= 5 && d <= 6 ? dbl(true, 'hit') : 'hit'
  }
  if (total >= 17) return 'stand'
  if (total >= 13) return d <= 6 ? 'stand' : 'hit'
  if (total === 12) return d >= 4 && d <= 6 ? 'stand' : 'hit'
  if (total === 11) return d !== 11 ? dbl(true, 'hit') : 'hit'
  if (total === 10) return d <= 9 ? dbl(true, 'hit') : 'hit'
  if (total === 9) return d >= 3 && d <= 6 ? dbl(true, 'hit') : 'hit'
  return 'hit'
}

// ═════════════════════════════ Roulette ═════════════════════════════

export type RouletteBetType =
  | 'straight' | 'split' | 'street' | 'corner' | 'sixline' | 'dozen' | 'column'
  | 'red' | 'black' | 'odd' | 'even' | 'low' | 'high'

export interface RouletteBet {
  type: RouletteBetType
  /** Pockets covered by the bet. */
  numbers: number[]
  stake: number
}

/** Profit multiple on a win ("35 to 1"). Return on win = stake × (payout + 1). */
export const ROULETTE_PAYOUT: Readonly<Record<RouletteBetType, number>> = {
  straight: 35, split: 17, street: 11, corner: 8, sixline: 5, dozen: 2, column: 2,
  red: 1, black: 1, odd: 1, even: 1, low: 1, high: 1,
}

export const RED_NUMBERS: readonly number[] = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
const RED_SET = new Set(RED_NUMBERS)
/** European wheel order (for the spinning animation). */
export const WHEEL_ORDER: readonly number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]

export type PocketColor = 'green' | 'red' | 'black'
export const pocketColor = (n: number): PocketColor => (n === 0 ? 'green' : RED_SET.has(n) ? 'red' : 'black')

const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i)

/**
 * Build a validated roulette bet. `selection` meaning per type:
 *  straight: the number (0..36) · split: [a, b] adjacent on the layout (0 may split with 1–3)
 *  street/sixline: first number of the (first) row (1,4,…) · corner: top-left number
 *  dozen/column: 1..3 · outside bets: ignored.
 * Returns null when the selection is not a legal table position.
 */
export function makeRouletteBet(type: RouletteBetType, stake: number, selection?: number | readonly number[]): RouletteBet | null {
  const sel = Array.isArray(selection) ? selection : selection === undefined ? [] : [selection as number]
  const s0 = sel[0] ?? -1
  let numbers: number[] | null = null
  switch (type) {
    case 'straight':
      if (Number.isInteger(s0) && s0 >= 0 && s0 <= 36) numbers = [s0]
      break
    case 'split': {
      if (sel.length !== 2) break
      const [a, b] = [Math.min(sel[0], sel[1]), Math.max(sel[0], sel[1])]
      const ok =
        a >= 0 && b <= 36 && a !== b &&
        ((a === 0 && b <= 3) || (a > 0 && (b - a === 3 || (b - a === 1 && a % 3 !== 0))))
      if (ok) numbers = [a, b]
      break
    }
    case 'street':
      if (s0 >= 1 && s0 <= 34 && (s0 - 1) % 3 === 0) numbers = range(s0, s0 + 2)
      break
    case 'corner':
      if (s0 >= 1 && s0 <= 32 && s0 % 3 !== 0) numbers = [s0, s0 + 1, s0 + 3, s0 + 4]
      break
    case 'sixline':
      if (s0 >= 1 && s0 <= 31 && (s0 - 1) % 3 === 0) numbers = range(s0, s0 + 5)
      break
    case 'dozen':
      if (s0 >= 1 && s0 <= 3) numbers = range((s0 - 1) * 12 + 1, s0 * 12)
      break
    case 'column':
      if (s0 >= 1 && s0 <= 3) numbers = range(1, 36).filter((n) => (n - s0) % 3 === 0)
      break
    case 'red': numbers = [...RED_NUMBERS]; break
    case 'black': numbers = range(1, 36).filter((n) => !RED_SET.has(n)); break
    case 'odd': numbers = range(1, 36).filter((n) => n % 2 === 1); break
    case 'even': numbers = range(1, 36).filter((n) => n % 2 === 0); break
    case 'low': numbers = range(1, 18); break
    case 'high': numbers = range(19, 36); break
  }
  if (!numbers || !(stake > 0)) return null
  return { type, numbers, stake }
}

/** Spin the single-zero wheel. */
export function spinRoulette(rng: Rng): { pocket: number; color: PocketColor } {
  const pocket = rng.int(0, 36)
  return { pocket, color: pocketColor(pocket) }
}

/** Total returned (incl. stakes of winning bets) for a set of bets on a pocket. */
export function settleRoulette(bets: readonly RouletteBet[], pocket: number): number {
  let ret = 0
  for (const b of bets) if (b.numbers.includes(pocket)) ret += b.stake * (ROULETTE_PAYOUT[b.type] + 1)
  return ret
}

/** Exact expected value per unit staked for a bet (−1/37 for every legal bet). */
export const rouletteExpectedValue = (bet: Pick<RouletteBet, 'type' | 'numbers'>): number =>
  (bet.numbers.length * (ROULETTE_PAYOUT[bet.type] + 1)) / 37 - 1

// ═════════════════════════════ Slots ═════════════════════════════

export type SlotSymbol = 'cherry' | 'lemon' | 'orange' | 'bell' | 'star' | 'seven' | 'ball'

export const SLOT_ICONS: Readonly<Record<SlotSymbol, string>> = {
  cherry: '🍒', lemon: '🍋', orange: '🍊', bell: '🔔', star: '⭐', seven: '7️⃣', ball: '⚽',
}

/**
 * Stops per symbol on every reel (32 stops). Rare symbols are spread so the
 * reels look natural. Changing these changes the RTP — re-run the tests.
 */
export const SLOT_REEL_WEIGHTS: Readonly<Record<SlotSymbol, number>> = {
  cherry: 7, lemon: 7, orange: 6, bell: 5, star: 4, seven: 2, ball: 1,
}

/** Three-of-a-kind pays (× line bet). The ⚽⚽⚽ "golden boot" jackpot is 1000×. */
export const SLOT_PAYTABLE: Readonly<Record<SlotSymbol, number>> = {
  cherry: 10, lemon: 16, orange: 20, bell: 40, star: 80, seven: 200, ball: 1000,
}
/** Two cherries on reels 1–2 of a line (third not a cherry) pay 4× line bet. */
export const SLOT_TWO_CHERRY = 4

/** 5 paylines over the 3×3 window: three rows + two diagonals. [reel] → row. */
export const SLOT_PAYLINES: readonly (readonly [number, number, number])[] = [
  [0, 0, 0], [1, 1, 1], [2, 2, 2], [0, 1, 2], [2, 1, 0],
]

/** Build one reel strip by interleaving symbols (deterministic, no RNG needed). */
function buildStrip(offset: number): SlotSymbol[] {
  const counts = { ...SLOT_REEL_WEIGHTS }
  const order: SlotSymbol[] = ['cherry', 'lemon', 'orange', 'bell', 'star', 'seven', 'ball']
  const total = order.reduce((s, k) => s + counts[k], 0)
  const strip: SlotSymbol[] = []
  let i = offset
  while (strip.length < total) {
    const k = order[i % order.length]
    if (counts[k] > 0) {
      strip.push(k)
      counts[k]--
    }
    i++
  }
  return strip
}

/** The three reel strips (slightly different orders so lines don't mirror). */
export const SLOT_STRIPS: readonly (readonly SlotSymbol[])[] = [buildStrip(0), buildStrip(2), buildStrip(5)]

/** Window [reel][row] for given stop positions (row 1 = the stop, rows 0/2 neighbours). */
export function slotWindow(stops: readonly number[]): SlotSymbol[][] {
  return SLOT_STRIPS.map((strip, r) => {
    const n = strip.length
    const p = stops[r]
    return [strip[(p - 1 + n) % n], strip[p % n], strip[(p + 1) % n]]
  })
}

/** Pay of one line in multiples of the line bet. */
function linePay(a: SlotSymbol, b: SlotSymbol, c: SlotSymbol): number {
  if (a === b && b === c) return SLOT_PAYTABLE[a]
  if (a === 'cherry' && b === 'cherry') return SLOT_TWO_CHERRY
  return 0
}

export interface SlotSpin {
  stops: number[]
  window: SlotSymbol[][]
  /** Paying line indices. */
  wins: { line: number; symbol: SlotSymbol; multiplier: number }[]
  /** Amount returned (0 if nothing). */
  payout: number
}

/** Evaluate a window for a total stake spread evenly over all paylines. */
export function evaluateSlot(window: SlotSymbol[][], stake: number): Pick<SlotSpin, 'wins' | 'payout'> {
  const lineBet = stake / SLOT_PAYLINES.length
  const wins: SlotSpin['wins'] = []
  let payout = 0
  SLOT_PAYLINES.forEach((rows, li) => {
    const m = linePay(window[0][rows[0]], window[1][rows[1]], window[2][rows[2]])
    if (m > 0) {
      wins.push({ line: li, symbol: window[0][rows[0]], multiplier: m })
      payout += m * lineBet
    }
  })
  return { wins, payout }
}

/** Spin the slot machine for `stake` (all 5 lines). */
export function spinSlot(rng: Rng, stake: number): SlotSpin {
  const stops = SLOT_STRIPS.map((s) => rng.int(0, s.length - 1))
  const window = slotWindow(stops)
  return { stops, window, ...evaluateSlot(window, stake) }
}

/**
 * Exact RTP by enumerating every stop combination (32³ = 32 768 windows).
 * Tuned to ≈ 0.942 — in line with real-world machines (92–96%).
 */
export function slotExactRtp(): number {
  const [a, b, c] = SLOT_STRIPS
  let total = 0
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++)
      for (let k = 0; k < c.length; k++) total += evaluateSlot(slotWindow([i, j, k]), 1).payout
  return total / (a.length * b.length * c.length)
}

// ═════════════════════════════ Horse racing ═════════════════════════════

export interface Horse {
  name: LText
  /** Hidden strength 45..80. */
  strength: number
  /** Visible form hint 1..5 (noisy view of strength). */
  formStars: number
  /** True win probability (hidden from the player; used for odds). */
  winProb: number
  /** Decimal odds (return per unit incl. stake). */
  odds: number
}

export interface RaceCard {
  horses: Horse[]
}

/** Field size. */
export const HORSE_COUNT = 8
/** Ticks simulated per race (also UI animation frames). */
export const RACE_TICKS = 40
/** Per-tick speed noise: high enough for upsets (favourite wins ~30–40%). */
export const RACE_NOISE_SD = 0.15
/** Speed gain per strength point. */
const SPEED_PER_STRENGTH = 0.004
/** Bookmaker margin: Σ(1/odds) ≈ 1.15. */
export const RACE_OVERROUND = 0.15

const HORSE_NAMES: readonly LText[] = [
  lt('Kara Şimşek', 'Black Lightning'), lt('Rüzgârın Oğlu', 'Son of the Wind'), lt('Gece Yıldızı', 'Night Star'),
  lt('Altın Nal', 'Golden Horseshoe'), lt('Deli Tayfun', 'Wild Typhoon'), lt('Sultan Bey', 'Sultan Bey'),
  lt('Fırtına Kızı', 'Storm Girl'), lt('Gümüş Ok', 'Silver Arrow'), lt('Bozkır Prensi', 'Prince of the Steppe'),
  lt('Mavi Duman', 'Blue Smoke'), lt('Son Düdük', 'Final Whistle'), lt('Penaltı Kralı', 'Penalty King'),
  lt('Ateş Topu', 'Fireball'), lt('Sessiz Dev', 'Silent Giant'),
]

const speedOf = (strength: number): number => 1 + SPEED_PER_STRENGTH * (strength - 60)

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf, |err| < 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf)
}

/**
 * Exact win probabilities for the race model: final distance of horse i is
 * Normal(T·vᵢ, σ√T); P(i wins) = ∫ φᵢ(x) Πⱼ≠ᵢ Φⱼ(x) dx (numerical integration).
 */
export function raceWinProbabilities(strengths: readonly number[]): number[] {
  const sd = RACE_NOISE_SD * Math.sqrt(RACE_TICKS)
  const means = strengths.map((s) => RACE_TICKS * speedOf(s))
  const lo = Math.min(...means) - 7 * sd
  const hi = Math.max(...means) + 7 * sd
  const steps = 3000
  const dx = (hi - lo) / steps
  const probs = strengths.map(() => 0)
  for (let k = 0; k <= steps; k++) {
    const x = lo + k * dx
    const w = k === 0 || k === steps ? 0.5 : 1
    const cdfs = means.map((m) => normalCdf((x - m) / sd))
    for (let i = 0; i < means.length; i++) {
      const z = (x - means[i]) / sd
      const pdf = Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI))
      let prod = 1
      for (let j = 0; j < means.length; j++) if (j !== i) prod *= cdfs[j]
      probs[i] += w * pdf * prod * dx
    }
  }
  const s = probs.reduce((a, b) => a + b, 0)
  return probs.map((p) => p / s)
}

/** Longest odds offered (bookmakers cap outsiders; extra edge on no-hopers). */
export const RACE_MAX_ODDS = 150

/** Decimal odds with overround, rounded DOWN to 0.05 (house-favourable), within 1.05..{@link RACE_MAX_ODDS}. */
export const oddsFromProbability = (p: number): number =>
  clamp(Math.floor((1 / (Math.max(1e-9, p) * (1 + RACE_OVERROUND))) * 20) / 20, 1.05, RACE_MAX_ODDS)

/** Create a race card: 8 named horses with hidden strength, form hint and odds. */
export function createRace(rng: Rng): RaceCard {
  const names = rng.shuffle([...HORSE_NAMES]).slice(0, HORSE_COUNT)
  // SD 6: a competitive field (most horses 5–25% to win), the odd clear favourite.
  const strengths = names.map(() => clamp(Math.round(rng.normal(60, 6)), 45, 80))
  const probs = raceWinProbabilities(strengths)
  return {
    horses: names.map((name, i) => ({
      name,
      strength: strengths[i],
      formStars: clamp(Math.round((strengths[i] + rng.normal(0, 6) - 35) / 10), 1, 5),
      winProb: probs[i],
      odds: oddsFromProbability(probs[i]),
    })),
  }
}

export interface RaceResult {
  /** frames[t][horse] = progress 0..1 (leader reaches exactly 1 at the last frame). */
  frames: number[][]
  /** Horse indices in finishing order. */
  order: number[]
  winner: number
}

/** Simulate the race tick by tick; the winner is decided by the simulation. */
export function runRace(rng: Rng, race: RaceCard): RaceResult {
  const n = race.horses.length
  const dist = new Array<number>(n).fill(0)
  const raw: number[][] = [dist.slice()]
  for (let t = 0; t < RACE_TICKS; t++) {
    for (let i = 0; i < n; i++) dist[i] += Math.max(0, speedOf(race.horses[i].strength) + rng.normal(0, RACE_NOISE_SD))
    raw.push(dist.slice())
  }
  const best = Math.max(...dist)
  const order = range(0, n - 1).sort((a, b) => dist[b] - dist[a])
  return { frames: raw.map((f) => f.map((d) => (best > 0 ? d / best : 0))), order, winner: order[0] }
}

/** Return for a win bet on `horse` (0 if it lost). */
export const settleHorseBet = (race: RaceCard, result: RaceResult, horse: number, stake: number): number =>
  result.winner === horse ? stake * race.horses[horse].odds : 0

// ═════════════════════════════ Dice ═════════════════════════════

const roll2 = (rng: Rng): [number, number] => [rng.int(1, 6), rng.int(1, 6)]

export interface CrapsResult {
  rolls: [number, number][]
  point: number | null
  win: boolean
}

/**
 * Craps pass line (even money): come-out 7/11 wins, 2/3/12 loses, otherwise
 * the point must repeat before a 7. P(win) = 244/495 → house edge 1.41%.
 */
export function playPassLine(rng: Rng): CrapsResult {
  const rolls: [number, number][] = []
  const first = roll2(rng)
  rolls.push(first)
  const s = first[0] + first[1]
  if (s === 7 || s === 11) return { rolls, point: null, win: true }
  if (s === 2 || s === 3 || s === 12) return { rolls, point: null, win: false }
  for (let i = 0; i < 1000; i++) {
    const r = roll2(rng)
    rolls.push(r)
    const t = r[0] + r[1]
    if (t === s) return { rolls, point: s, win: true }
    if (t === 7) return { rolls, point: s, win: false }
  }
  return { rolls, point: s, win: false }
}

/** Exact pass-line win probability. */
export const PASS_LINE_WIN_P = 244 / 495

export type SevensBet = 'under' | 'over' | 'seven'

/**
 * "Over/Under 7" street-fair game on 2d6: under (2–6) and over (8–12) pay 1:1,
 * exactly seven pays 4:1. Edge 16.7% on every bet — the fast, nasty one.
 */
export const SEVENS_PAYOUT: Readonly<Record<SevensBet, number>> = { under: 1, over: 1, seven: 4 }

export function playSevens(rng: Rng, bet: SevensBet, stake: number): { dice: [number, number]; win: boolean; payout: number } {
  const dice = roll2(rng)
  const s = dice[0] + dice[1]
  const win = bet === 'under' ? s < 7 : bet === 'over' ? s > 7 : s === 7
  return { dice, win, payout: win ? stake * (SEVENS_PAYOUT[bet] + 1) : 0 }
}

// ═════════════════════════════ Bookkeeping ═════════════════════════════

/** life.flags keys used by the casino. */
export const CASINO_FLAGS = {
  /** Daily net-loss limit chosen by the player (0/absent = none). */
  lossLimit: 'casino_loss_limit',
  /** Net loss so far today (negative when up). */
  lostToday: 'casino_lost_today',
  /** Consecutive losing bets (loss chasing). */
  lossStreak: 'casino_loss_streak',
} as const

const numFlag = (life: Life, k: string): number => {
  const v = life.flags[k]
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** Set (or clear with 0) the responsible-gaming daily loss limit. */
export function setLossLimit(life: Life, amount: number): Lines {
  const a = Math.max(0, Math.round(Number.isFinite(amount) ? amount : 0))
  life.flags[CASINO_FLAGS.lossLimit] = a
  return [a > 0
    ? fill(lt('Günlük kayıp limitin {m} olarak ayarlandı.', 'Daily loss limit set to {m}.'), { m: fmtMoney(a) })
    : lt('Günlük kayıp limiti kaldırıldı.', 'Daily loss limit removed.')]
}

/** Can the hero place this stake now? Respects cash and the daily loss limit. */
export function canBet(life: Life, stake: number): { ok: boolean; reason: LText | null } {
  if (!(stake > 0) || !Number.isFinite(stake)) return { ok: false, reason: lt('Geçersiz bahis tutarı.', 'Invalid stake.') }
  if (stake > life.money) return { ok: false, reason: lt('Bu bahis için yeterli nakdin yok.', "You don't have enough cash for this bet.") }
  const limit = numFlag(life, CASINO_FLAGS.lossLimit)
  if (limit > 0 && numFlag(life, CASINO_FLAGS.lostToday) + stake > limit) {
    return { ok: false, reason: fill(lt('Günlük kayıp limitine ({m}) ulaştın. Bugünlük bu kadar.', 'You have hit your daily loss limit ({m}). That is enough for today.'), { m: fmtMoney(limit) }) }
  }
  return { ok: true, reason: null }
}

/**
 * Addiction tuning (0..100 meter):
 *  - every bet +0.15 (habit), losing streak adds +0.1 per consecutive loss (chasing, cap 10)
 *  - big win (≥5× stake profit) +2: the rush is what hooks people
 *  - stake share of bankroll: betting 50% of your cash adds +1
 *  - each visit +1.5, +2 more for every visit beyond the 2nd in a week
 *  - weekly decay −5 with no visits, −1 otherwise
 *  - `addiction_resist` perk (Poker Face) scales all gains down
 */
function addAddiction(life: Life, hero: Pick<Hero, 'perks'> | null, amount: number): void {
  const resist = hero ? clamp(perkValue(hero, 'addiction_resist'), 0, 0.8) : 0
  life.casino.addiction = meter(life.casino.addiction + amount * (1 - resist), 0)
}

/** Thresholds that produce warnings when crossed upward. */
const ADDICTION_WARNINGS: readonly [number, LText][] = [
  [50, lt('Kumar artık bir alışkanlığa dönüşüyor. Kendine bir limit koymayı düşün.', 'Gambling is becoming a habit. Consider setting a limit.')],
  [80, lt('⚠️ Kumar bağımlılığın ciddi boyutta. Stres artıyor, kulüp de fark edebilir.', '⚠️ Your gambling addiction is serious. Stress is rising and the club may notice.')],
]

/**
 * Settle a finished bet/round: moves money, updates won/lost totals, daily net
 * loss, addiction and stress/happiness. `payout` = amount returned incl. stake.
 */
export function settleBet(life: Life, hero: Pick<Hero, 'perks'> | null, stake: number, payout: number): { net: number; lines: Lines } {
  const s = Math.max(0, Number.isFinite(stake) ? stake : 0)
  const p = Math.max(0, Number.isFinite(payout) ? payout : 0)
  const net = p - s
  const before = life.casino.addiction
  const bankroll = Math.max(1, life.money)
  life.money += net
  if (net > 0) life.casino.won += net
  else life.casino.lost += -net
  life.flags[CASINO_FLAGS.lostToday] = numFlag(life, CASINO_FLAGS.lostToday) - net

  const lines: Lines = []
  let streak = numFlag(life, CASINO_FLAGS.lossStreak)
  let add = 0.15 + Math.min(1, s / bankroll) * 2 * 0.5
  if (net < 0) {
    streak++
    add += 0.1 * Math.min(10, streak)
    // Losing a big share of your cash stings: 2 + up to 6 stress.
    addStress(life, hero, Math.min(8, 2 + (20 * -net) / Math.max(1000, bankroll)))
    lines.push(fill(lt('Kaybettin: {m}', 'You lost {m}'), { m: fmtMoney(-net) }))
  } else {
    streak = 0
    if (net >= 5 * s && s > 0) {
      add += 2
      addHappiness(life, 3)
      lines.push(fill(lt('🎉 Büyük vurgun! {m} kazandın.', '🎉 Big win! You won {m}.'), { m: fmtMoney(net) }))
    } else if (net > 0) {
      addHappiness(life, 1)
      lines.push(fill(lt('Kazandın: {m}', 'You won {m}'), { m: fmtMoney(net) }))
    } else lines.push(lt('Berabere, paran iade edildi.', 'Push, your stake is returned.'))
  }
  life.flags[CASINO_FLAGS.lossStreak] = streak
  addAddiction(life, hero, add)
  for (const [th, text] of ADDICTION_WARNINGS) if (before < th && life.casino.addiction >= th) lines.push(text)
  return { net, lines }
}

export interface CasinoContext {
  calendar: Calendar
  inSeason: boolean
  /** A match tomorrow makes being spotted much worse. */
  matchTomorrow?: boolean
}

export interface CasinoVisit {
  lines: Lines
  /** Tags for the event system: always 'casino' & 'nightlife'; 'gambling_seen' if spotted. */
  triggerTags: string[]
  spotted: boolean
}

/**
 * Enter the casino. Counts the visit (addiction), and during the season rolls
 * whether someone spots the hero:
 *   p = 0.10 + 0.05·(visits this week − 1) + 0.25 if match tomorrow, × fame (0.5..1.5)
 * Spotted → discipline −5 (−12 before a match), press −3, a negative headline.
 */
export function visitCasino(rng: Rng, life: Life, hero: Hero, ctx: CasinoContext): CasinoVisit {
  life.casino.visitsThisWeek++
  const v = life.casino.visitsThisWeek
  const lines: Lines = []
  const triggerTags = ['casino', 'nightlife']
  addAddiction(life, hero, 1.5 + Math.max(0, v - 2) * 2)
  lines.push(lt('🎰 Kumarhanenin ışıkları seni içeri çekti.', '🎰 The casino lights pull you inside.'))
  let spotted = false
  if (ctx.inSeason) {
    const fame = 0.5 + clamp(hero.reputation, 0, 100) / 100
    const p = clamp((0.1 + 0.05 * Math.max(0, v - 1) + (ctx.matchTomorrow ? 0.25 : 0)) * fame, 0, 0.9)
    if (rng.chance(p)) {
      spotted = true
      triggerTags.push('gambling_seen')
      const hit = ctx.matchTomorrow ? 12 : 5
      life.discipline = meter(life.discipline - hit)
      const press = life.relationships.press
      if (press) press.value = clamp(press.value - 3, -100, 100)
      lines.push(fill(lt('📸 Kumarhanede görüntülendin! Disiplin -{d}.', '📸 You were photographed at the casino! Discipline -{d}.'), { d: hit }))
      const name = `${hero.firstName} ${hero.lastName}`
      pushNews(
        life, rng, ctx.calendar,
        ctx.matchTomorrow
          ? fill(lt('Maç öncesi gece {n} kumarhanede!', '{n} at the casino the night before a match!'), { n: name })
          : fill(lt('{n} rulet masasında görüntülendi', '{n} spotted at the roulette table'), { n: name }),
        -1, 'Gece Bekçisi',
      )
    }
  }
  return { lines, triggerTags, spotted }
}

/** Reset the daily net-loss counter (call each morning). */
export function resetCasinoDay(life: Life): void {
  life.flags[CASINO_FLAGS.lostToday] = 0
}

/** Weekly casino tick: addiction decay and visit counter reset. */
export function weeklyCasinoTick(life: Life): Lines {
  const visits = life.casino.visitsThisWeek
  life.casino.addiction = meter(life.casino.addiction - (visits === 0 ? 5 : 1), 0)
  life.casino.visitsThisWeek = 0
  if (life.casino.addiction >= 70) {
    return [lt('Kumar düşüncesi aklından çıkmıyor. Belki birinden yardım almalısın.', "You can't stop thinking about gambling. Maybe you should get help.")]
  }
  return []
}

/** Absolute-week helper re-exported for callers that store casino cooldowns. */
export const casinoWeek = absWeek
