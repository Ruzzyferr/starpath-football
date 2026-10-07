/** Casino games for the mock backend (real rules, seeded RNG). */
import type { Rng } from '../../core/rng'
import { blackjack } from '../store'
import type {
  BlackjackView, CardView, CasinoActions, HorseRaceResult, HorseView, Rank, RouletteBet, RouletteResult, SlotsResult, Suit,
} from '../store'
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
/** Slot symbols: index → weight & 3-of-a-kind multiplier. */
export const SLOT_WEIGHTS = [30, 24, 18, 12, 8, 5, 3]
export const SLOT_PAYS = [3, 5, 8, 12, 20, 40, 100]

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
  let hand: { bet: number; player: CardView[]; dealer: CardView[]; doubled: boolean; done: boolean } | null = null

  const draw = (faceDown = false): CardView => {
    if (deck.length < 15) {
      deck = []
      for (let d = 0; d < 4; d++) for (const s of SUITS) for (const r of RANKS) deck.push({ rank: r, suit: s })
      host.rng().shuffle(deck)
    }
    const c = deck.pop() as CardView
    return faceDown ? { ...c, faceDown: true } : { ...c }
  }

  const view = (result: BlackjackView['result'] = null, payout = 0): BlackjackView => {
    const h = hand as NonNullable<typeof hand>
    const v: BlackjackView = {
      bet: h.bet * (h.doubled ? 2 : 1),
      player: h.player.map((c) => ({ ...c })),
      dealer: h.dealer.map((c) => ({ ...c })),
      playerTotal: handTotal(h.player),
      dealerTotal: h.done ? handTotal(h.dealer) : null,
      phase: h.done ? 'done' : 'player',
      result,
      payout,
      canDouble: !h.done && h.player.length === 2 && host.canAfford(h.bet * 2),
    }
    blackjack.value = v
    return v
  }

  const finish = (): BlackjackView => {
    const h = hand as NonNullable<typeof hand>
    h.done = true
    h.dealer = h.dealer.map((c) => ({ ...c, faceDown: false }))
    const stake = h.bet * (h.doubled ? 2 : 1)
    const p = handTotal(h.player)
    if (p > 21) { host.settle(-stake); return view('bust', -stake) }
    while (handTotal(h.dealer) < 17) h.dealer.push(draw())
    const dl = handTotal(h.dealer)
    if (dl > 21 || p > dl) { host.settle(stake); return view('win', stake) }
    if (p === dl) return view('push', 0)
    host.settle(-stake)
    return view('lose', -stake)
  }

  return {
    blackjackDeal(bet) {
      hand = { bet, player: [draw(), draw()], dealer: [draw(), draw(true)], doubled: false, done: false }
      const pt = handTotal(hand.player)
      if (pt === 21) {
        hand.done = true
        hand.dealer = hand.dealer.map((c) => ({ ...c, faceDown: false }))
        if (handTotal(hand.dealer) === 21) return view('push', 0)
        const win = Math.round(bet * 1.5)
        host.settle(win)
        return view('blackjack', win)
      }
      return view()
    },
    blackjackHit() {
      if (!hand || hand.done) return blackjack.value as BlackjackView
      hand.player.push(draw())
      if (handTotal(hand.player) >= 21) return finish()
      return view()
    },
    blackjackStand() {
      if (!hand || hand.done) return blackjack.value as BlackjackView
      return finish()
    },
    blackjackDouble() {
      if (!hand || hand.done) return blackjack.value as BlackjackView
      hand.doubled = true
      hand.player.push(draw())
      return finish()
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
      const rng = host.rng()
      const idx = SLOT_WEIGHTS.map((_, i) => i)
      const reels = [0, 1, 2].map(() => rng.weighted(idx, (i) => SLOT_WEIGHTS[i]))
      let net = -bet
      let winLine = false
      if (reels[0] === reels[1] && reels[1] === reels[2]) {
        net = bet * SLOT_PAYS[reels[0]] - bet
        winLine = true
      } else if (reels[0] === reels[1] || reels[1] === reels[2]) {
        net = Math.round(bet * 0.5) - bet + (reels[1] >= 4 ? bet : 0)
      }
      host.settle(net)
      return { reels, net, winLine }
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
