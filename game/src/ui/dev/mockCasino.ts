/** Casino games for the mock backend (real rules, seeded RNG). */
import type { Rng } from '../../core/rng'
import { blackjack } from '../store'
import type {
  BlackjackView, CardView, CasinoActions, HorseRaceResult, HorseView, Rank, RouletteBet, RouletteResult, SlotsResult, Suit,
} from '../store'
import { spinSlot } from '../../sim/life/casino'
import { slotSpinView } from '../backend/casinoView'
import { HORSE_COLORS, HORSE_NAMES } from './mockContent'

export interface CasinoHost {
  rng(): Rng
  /** Apply net money change from a finished bet (positive = player won). */
  settle(net: number): void
  /** Take the stake up-front (returns false if not affordable). */
  canAfford(amount: number): boolean
}

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS: Suit[] = ['S', 'H', 'D', 'C']
export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

export function handTotal(cards: CardView[]): number {
  let t = 0
  let aces = 0
  for (const c of cards) {
    if (c.faceDown) continue
    if (c.rank === 'A') { aces++; t += 11 }
    else if (c.rank === 'J' || c.rank === 'Q' || c.rank === 'K') t += 10
    else t += Number(c.rank)
  }
  while (t > 21 && aces > 0) { t -= 10; aces-- }
  return t
}

export function makeHorses(rng: Rng): HorseView[] {
  return HORSE_NAMES.map((name, index) => {
    const odds = Math.round((1.8 + rng.next() * 9) * 10) / 10
    return { index, name, odds, color: HORSE_COLORS[index], form: [rng.int(1, 8), rng.int(1, 8), rng.int(1, 8)].join('-') }
  })
}

export function createCasino(host: CasinoHost, horses: () => HorseView[]): CasinoActions {
  let deck: CardView[] = []
  interface MockHand { cards: CardView[]; bet: number; doubled: boolean; done: boolean; result: BlackjackView['result']; net: number }
  let round: { hands: MockHand[]; dealer: CardView[]; active: number; done: boolean } | null = null

  const draw = (faceDown = false): CardView => {
    if (deck.length < 15) {
      deck = []
      for (let d = 0; d < 4; d++) for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s })
      host.rng().shuffle(deck)
    }
    const c = deck.pop() as CardView
    return faceDown ? { ...c, faceDown: true } : { ...c }
  }
  const cardVal = (c: CardView): number => (c.rank === 'A' ? 11 : ['J', 'Q', 'K'].includes(c.rank) ? 10 : Number(c.rank))
  const staked = (): number => (round ? round.hands.reduce((a, h) => a + h.bet, 0) : 0)

  const view = (): BlackjackView => {
    const r = round as NonNullable<typeof round>
    const act = r.hands[Math.min(r.active, r.hands.length - 1)]
    const net = r.hands.reduce((a, h) => a + h.net, 0)
    const free = !r.done && act.cards.length === 2 && host.canAfford(staked() + act.bet)
    const result: BlackjackView['result'] = !r.done ? null
      : r.hands.length === 1 ? r.hands[0].result
      : net > 0 ? 'win' : net === 0 ? 'push' : r.hands.every((h) => h.result === 'bust') ? 'bust' : 'lose'
    const v: BlackjackView = {
      bet: staked(),
      player: act.cards.map((c) => ({ ...c })),
      dealer: r.dealer.map((c) => ({ ...c })),
      playerTotal: handTotal(act.cards),
      dealerTotal: r.done ? handTotal(r.dealer) : null,
      phase: r.done ? 'done' : 'player',
      result,
      payout: r.done ? net : 0,
      canDouble: free,
      hands: r.hands.map((h) => ({ cards: h.cards.map((c) => ({ ...c })), total: handTotal(h.cards), stake: h.bet, doubled: h.doubled, result: r.done ? h.result : null, payout: r.done ? h.net : 0 })),
      active: r.done ? r.hands.length : r.active,
      canSplit: free && r.hands.length === 1 && cardVal(act.cards[0]) === cardVal(act.cards[1]),
    }
    blackjack.value = v
    return v
  }

  const finish = (): BlackjackView => {
    const r = round as NonNullable<typeof round>
    r.done = true
    r.dealer = r.dealer.map((c) => ({ ...c, faceDown: false }))
    if (r.hands.some((h) => handTotal(h.cards) <= 21)) while (handTotal(r.dealer) < 17) r.dealer.push(draw())
    const dl = handTotal(r.dealer)
    for (const h of r.hands) {
      const p = handTotal(h.cards)
      if (p > 21) { h.result = 'bust'; h.net = -h.bet }
      else if (dl > 21 || p > dl) { h.result = 'win'; h.net = h.bet }
      else if (p === dl) { h.result = 'push'; h.net = 0 }
      else { h.result = 'lose'; h.net = -h.bet }
      host.settle(h.net)
    }
    return view()
  }

  /** Mark the active hand done and move on (finishing the round after the last). */
  const next = (): BlackjackView => {
    const r = round as NonNullable<typeof round>
    while (r.active < r.hands.length && r.hands[r.active].done) r.active++
    return r.active >= r.hands.length ? finish() : view()
  }
  const live = (): MockHand | null => (round && !round.done ? round.hands[round.active] ?? null : null)

  return {
    blackjackDeal(bet) {
      const hand: MockHand = { cards: [draw(), draw()], bet, doubled: false, done: false, result: null, net: 0 }
      round = { hands: [hand], dealer: [draw(), draw(true)], active: 0, done: false }
      if (handTotal(hand.cards) === 21) {
        round.done = true
        round.dealer = round.dealer.map((c) => ({ ...c, faceDown: false }))
        if (handTotal(round.dealer) === 21) { hand.result = 'push'; return view() }
        hand.result = 'blackjack'
        hand.net = Math.round(bet * 1.5)
        host.settle(hand.net)
        return view()
      }
      return view()
    },
    blackjackHit() {
      const h = live()
      if (!h) return blackjack.value as BlackjackView
      h.cards.push(draw())
      if (handTotal(h.cards) >= 21) h.done = true
      return next()
    },
    blackjackStand() {
      const h = live()
      if (!h) return blackjack.value as BlackjackView
      h.done = true
      return next()
    },
    blackjackDouble() {
      const h = live()
      if (!h) return blackjack.value as BlackjackView
      h.doubled = true
      h.bet *= 2
      h.cards.push(draw())
      h.done = true
      return next()
    },
    blackjackSplit() {
      const h = live()
      if (!h || !round || !view().canSplit) return blackjack.value as BlackjackView
      const aces = h.cards[0].rank === 'A'
      const second: MockHand = { cards: [h.cards[1], draw()], bet: h.bet, doubled: false, done: aces, result: null, net: 0 }
      h.cards = [h.cards[0], draw()]
      h.done = aces
      round.hands.push(second)
      for (const x of round.hands) if (handTotal(x.cards) >= 21) x.done = true
      return next()
    },
    rouletteSpin(bets: RouletteBet[]): RouletteResult {
      const n = host.rng().int(0, 36)
      const color: RouletteResult['color'] = n === 0 ? 'green' : RED_NUMBERS.has(n) ? 'red' : 'black'
      let net = 0
      for (const b of bets) {
        let mult = -1
        switch (b.kind) {
          case 'number': mult = b.value === n ? 35 : -1; break
          case 'red': mult = color === 'red' ? 1 : -1; break
          case 'black': mult = color === 'black' ? 1 : -1; break
          case 'odd': mult = n !== 0 && n % 2 === 1 ? 1 : -1; break
          case 'even': mult = n !== 0 && n % 2 === 0 ? 1 : -1; break
          case 'low': mult = n >= 1 && n <= 18 ? 1 : -1; break
          case 'high': mult = n >= 19 ? 1 : -1; break
          case 'dozen': mult = n !== 0 && Math.ceil(n / 12) === b.value ? 2 : -1; break
        }
        net += b.amount * mult
      }
      host.settle(net)
      return { number: n, color, net }
    },
    slotsSpin(bet): SlotsResult {
      // Same machine as the real game: 3×3 window, 5 paylines, sim paytable.
      const res = slotSpinView(spinSlot(host.rng(), bet), bet)
      host.settle(res.net)
      return res
    },
    horseRace(bet, horse): HorseRaceResult {
      const rng = host.rng()
      const hs = horses()
      const strength = hs.map((h) => 1 / h.odds + rng.next() * 0.25)
      const pos = hs.map(() => 0)
      const timeline: number[][] = []
      const surge = hs.map(() => rng.int(10, 50))
      const raw: number[][] = []
      for (let f = 0; f < 60; f++) {
        for (let i = 0; i < hs.length; i++) {
          const base = 0.012 + strength[i] * 0.012
          const burst = f >= surge[i] && f < surge[i] + 8 ? 0.006 : 0
          pos[i] += Math.max(0.002, base + burst + (rng.next() - 0.4) * 0.008)
        }
        raw.push([...pos])
      }
      // Normalise so the winner crosses the line (1.0) exactly on the last frame.
      const k = 1 / Math.max(...pos)
      for (const fr of raw) timeline.push(fr.map((p) => Math.min(1, Math.round(p * k * 1000) / 1000)))
      const order = hs.map((h) => h.index).sort((a, b) => pos[b] - pos[a])
      const won = order[0] === horse
      const net = won ? Math.round(bet * (hs[horse].odds - 1)) : -bet
      host.settle(net)
      return { timeline, order, net }
    },
  }
}
