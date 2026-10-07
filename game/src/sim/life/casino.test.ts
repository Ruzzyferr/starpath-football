import { Rng } from '../../core/rng'
import type { Hero, Life } from '../../core/types'
import {
  PASS_LINE_WIN_P, RACE_OVERROUND, SEVENS_PAYOUT, availableActions, basicStrategyAction, blackjackAction,
  blackjackTotalStake, canBet, handNet, handReturn, cardValue, createRace, createShoe, handValue, isBlackjack, makeRouletteBet,
  playPassLine, playSevens, raceWinProbabilities, resetCasinoDay, rouletteExpectedValue, runRace, setLossLimit,
  settleBet, settleHorseBet, settleRoulette, slotExactRtp, spinRoulette, spinSlot, startBlackjack, visitCasino,
  weeklyCasinoTick, type RouletteBetType,
} from './casino'

function makeLife(money = 10_000): Life {
  return {
    money, bank: { savings: 0, loan: null, investments: [], creditScore: 600 }, assets: [], energy: 100, happiness: 60,
    health: 90, stress: 20, discipline: 70, followers: 0, relationships: {}, agent: null, sponsors: [], trainer: null,
    casino: { addiction: 0, won: 0, lost: 0, visitsThisWeek: 0 }, flags: {}, eventHistory: {}, log: [], news: [],
  }
}
const hero = { perks: [] as string[], firstName: 'Ali', lastName: 'Yıldız', reputation: 50 } as unknown as Hero

describe('blackjack', () => {
  it('hand values handle soft aces', () => {
    expect(handValue([0, 12])).toEqual({ total: 21, soft: true }) // A K
    expect(handValue([0, 0, 8])).toEqual({ total: 21, soft: true }) // A A 9
    expect(handValue([0, 8, 8])).toEqual({ total: 19, soft: false }) // A 9 9
    expect(isBlackjack([0, 9])).toBe(true)
  })

  it('shoe has 6 decks and is serializable', () => {
    const shoe = createShoe(new Rng(1))
    expect(shoe.cards.length).toBe(312)
    const copy = JSON.parse(JSON.stringify(shoe))
    expect(copy).toEqual(shoe)
  })

  it('dealer stands on soft 17 and pays 3:2 for naturals', () => {
    const rng = new Rng(5)
    let naturals = 0
    for (let i = 0; i < 4000; i++) {
      const r = startBlackjack(rng, createShoe(rng, 1), 10)
      while (!r.finished) blackjackAction(rng, r, 'stand')
      const d = handValue(r.dealer)
      if (r.outcomes[0] !== 'blackjack' && r.dealer.length > 2) {
        expect(d.total).toBeGreaterThanOrEqual(17)
        // Dealer never draws on any 17, soft or hard.
        expect(handValue(r.dealer.slice(0, -1)).total).toBeLessThan(17)
      }
      if (r.outcomes[0] === 'blackjack') { naturals++; expect(r.payout).toBe(25) }
    }
    expect(naturals).toBeGreaterThan(100)
  })

  it('split aces receive exactly one card each', () => {
    const rng = new Rng(9)
    const shoe = createShoe(rng, 1)
    // Rig the next deal: player A, dealer 5, player A, dealer 6.
    shoe.cards.splice(0, 4, 0, 4, 13, 5)
    shoe.pos = 0
    const r = startBlackjack(rng, shoe, 10)
    expect(availableActions(r)).toContain('split')
    blackjackAction(rng, r, 'split')
    expect(r.hands.length).toBe(2)
    expect(r.hands.every((h) => h.cards.length === 2 && h.done)).toBe(true)
    expect(r.finished).toBe(true)
    expect(blackjackTotalStake(r)).toBe(20)
  })

  it('split pairs play two independent hands settled per hand', () => {
    const rng = new Rng(11)
    const shoe = createShoe(rng, 1)
    // Player 8, dealer 6, player 8, dealer 10 → split eights against a 16.
    shoe.cards.splice(0, 4, 7, 5, 20, 9)
    shoe.pos = 0
    const r = startBlackjack(rng, shoe, 10)
    expect(availableActions(r)).toContain('split')
    expect(availableActions(r, 9)).not.toContain('split') // can't cover the second stake
    expect(blackjackAction(rng, r, 'split')).toBe(true)
    expect(r.hands).toHaveLength(2)
    expect(r.hands.map((h) => cardValue(h.cards[0]))).toEqual([8, 8])
    expect(r.hands.every((h) => h.fromSplit && h.stake === 10)).toBe(true)
    expect(r.active).toBe(0)
    // No re-split (max two hands) even if another eight comes.
    expect(availableActions(r)).not.toContain('split')
    expect(blackjackAction(rng, r, 'split')).toBe(false)
    while (!r.finished) blackjackAction(rng, r, 'stand')
    expect(r.outcomes).toHaveLength(2)
    const sum = r.hands.reduce((a, h, i) => a + handReturn(r.outcomes[i], h.stake), 0)
    expect(r.payout).toBe(sum)
  })

  it('21 on a split hand is not a natural', () => {
    const rng = new Rng(3)
    const shoe = createShoe(rng, 1)
    // Player K, dealer 6, player K, dealer 10, then A for the first split hand, 2 for the second.
    shoe.cards.splice(0, 6, 12, 5, 25, 9, 1, 0) // split deals the new hand's card first
    shoe.pos = 0
    const r = startBlackjack(rng, shoe, 10)
    blackjackAction(rng, r, 'split')
    expect(handValue(r.hands[0].cards).total).toBe(21)
    expect(r.hands[0].done).toBe(true)
    expect(r.active).toBe(1)
    while (!r.finished) blackjackAction(rng, r, 'stand')
    expect(r.outcomes[0]).not.toBe('blackjack')
  })

  it('double after split doubles only that hand', () => {
    const rng = new Rng(4)
    const shoe = createShoe(rng, 1)
    shoe.cards.splice(0, 4, 7, 5, 20, 9)
    shoe.pos = 0
    const r = startBlackjack(rng, shoe, 10)
    blackjackAction(rng, r, 'split')
    if (!r.hands[0].done) blackjackAction(rng, r, 'double')
    expect(r.hands[0].stake).toBe(20)
    expect(r.hands[1].stake).toBe(10)
  })

  it('handReturn / handNet pay 3:2, 1:1, push and loss', () => {
    expect(handReturn('blackjack', 10)).toBe(25)
    expect(handReturn('win', 10)).toBe(20)
    expect(handReturn('push', 10)).toBe(10)
    expect(handReturn('lose', 10)).toBe(0)
    expect(handReturn('bust', 10)).toBe(0)
    expect(handNet('win', 20)).toBe(20)
    expect(handNet('bust', 20)).toBe(-20)
  })

  it('basic strategy RTP is ~99.5% (house edge small but real)', () => {
    const rng = new Rng(2024)
    const shoe = createShoe(rng)
    let staked = 0
    let returned = 0
    const N = 120_000
    for (let i = 0; i < N; i++) {
      const r = startBlackjack(rng, shoe, 1)
      while (!r.finished) {
        const acts = availableActions(r)
        const h = r.hands[r.active]
        const a = basicStrategyAction(h.cards, r.dealer[0], acts.includes('double'), acts.includes('split'))
        blackjackAction(rng, r, acts.includes(a) ? a : 'hit')
      }
      staked += blackjackTotalStake(r)
      returned += r.payout
    }
    const rtp = returned / staked
    expect(rtp).toBeGreaterThan(0.97)
    expect(rtp).toBeLessThan(1.01)
  })

  it('cardValue maps faces to 10 and aces to 11', () => {
    expect(cardValue(0)).toBe(11)
    expect(cardValue(10)).toBe(10)
    expect(cardValue(12)).toBe(10)
  })
})

describe('roulette', () => {
  const sel: Record<RouletteBetType, number | number[] | undefined> = {
    straight: 17, split: [17, 20], street: 16, corner: 17, sixline: 16, dozen: 2, column: 3,
    red: undefined, black: undefined, odd: undefined, even: undefined, low: undefined, high: undefined,
  }
  const sizes: Record<RouletteBetType, number> = {
    straight: 1, split: 2, street: 3, corner: 4, sixline: 6, dozen: 12, column: 12, red: 18, black: 18, odd: 18, even: 18, low: 18, high: 18,
  }

  it('every bet type has exactly -1/37 expected value', () => {
    for (const t of Object.keys(sel) as RouletteBetType[]) {
      const b = makeRouletteBet(t, 1, sel[t])
      expect(b, t).not.toBeNull()
      expect(b!.numbers.length, t).toBe(sizes[t])
      expect(rouletteExpectedValue(b!)).toBeCloseTo(-1 / 37, 10)
      // Exhaustive check over all 37 pockets.
      let ret = 0
      for (let p = 0; p <= 36; p++) ret += settleRoulette([b!], p)
      expect(ret / 37 - 1).toBeCloseTo(-1 / 37, 10)
    }
  })

  it('rejects illegal layouts', () => {
    expect(makeRouletteBet('split', 1, [3, 4])).toBeNull() // not adjacent across rows
    expect(makeRouletteBet('corner', 1, 3)).toBeNull()
    expect(makeRouletteBet('street', 1, 2)).toBeNull()
    expect(makeRouletteBet('straight', 1, 37)).toBeNull()
    expect(makeRouletteBet('split', 1, [0, 2])).not.toBeNull()
  })

  it('Monte Carlo RTP on red ≈ 36/37', () => {
    const rng = new Rng(7)
    const bet = makeRouletteBet('red', 1)!
    let ret = 0
    const N = 200_000
    for (let i = 0; i < N; i++) ret += settleRoulette([bet], spinRoulette(rng).pocket)
    expect(Math.abs(ret / N - 36 / 37)).toBeLessThan(0.01)
  })
})

describe('slots', () => {
  it('exact RTP ≈ 94%', () => {
    const rtp = slotExactRtp()
    expect(rtp).toBeGreaterThan(0.93)
    expect(rtp).toBeLessThan(0.95)
  })

  it('Monte Carlo RTP over 200k spins agrees', () => {
    const rng = new Rng(77)
    let ret = 0
    const N = 200_000
    for (let i = 0; i < N; i++) ret += spinSlot(rng, 5).payout
    const rtp = ret / (N * 5)
    expect(rtp).toBeGreaterThan(0.9)
    expect(rtp).toBeLessThan(0.98)
  })
})

describe('horse racing', () => {
  it('probabilities sum to 1 and odds carry ~15% overround', () => {
    const race = createRace(new Rng(3))
    expect(race.horses.length).toBe(8)
    expect(race.horses.reduce((s, h) => s + h.winProb, 0)).toBeCloseTo(1, 6)
    const book = race.horses.reduce((s, h) => s + 1 / h.odds, 0)
    expect(book).toBeGreaterThan(1 + RACE_OVERROUND - 0.005)
    expect(book).toBeLessThan(1 + RACE_OVERROUND + 0.06)
  })

  it('simulated win frequencies match analytic probabilities; frames animate to 1', () => {
    const rng = new Rng(11)
    const race = createRace(rng)
    const wins = new Array(8).fill(0)
    const N = 15_000
    let returned = 0
    let staked = 0
    // Only horses with a real chance: no-hopers make the sample far too noisy.
    const contenders = race.horses.map((h, i) => (h.winProb > 0.05 ? i : -1)).filter((i) => i >= 0)
    for (let i = 0; i < N; i++) {
      const res = runRace(rng, race)
      wins[res.winner]++
      for (const h of contenders) { returned += settleHorseBet(race, res, h, 1); staked++ }
      if (i === 0) {
        expect(res.frames.length).toBe(41)
        expect(Math.max(...res.frames[40])).toBeCloseTo(1, 10)
        expect(res.order.length).toBe(8)
      }
    }
    for (let h = 0; h < 8; h++) expect(Math.abs(wins[h] / N - race.horses[h].winProb)).toBeLessThan(0.015)
    // Backing the contenders returns ≈ 1/1.15 of the stake.
    const rtp = returned / staked
    expect(rtp).toBeGreaterThan(0.8)
    expect(rtp).toBeLessThan(0.9)
  })

  it('stronger horses are more likely to win', () => {
    const p = raceWinProbabilities([80, 60, 60, 60, 60, 60, 60, 40])
    expect(p[0]).toBeGreaterThan(p[1])
    expect(p[1]).toBeGreaterThan(p[7])
  })
})

describe('dice', () => {
  it('pass line wins ≈ 244/495', () => {
    const rng = new Rng(13)
    let w = 0
    const N = 100_000
    for (let i = 0; i < N; i++) if (playPassLine(rng).win) w++
    expect(Math.abs(w / N - PASS_LINE_WIN_P)).toBeLessThan(0.006)
  })

  it('over/under 7 house edge ≈ 16.7%', () => {
    expect((15 / 36) * (SEVENS_PAYOUT.under + 1) - 1).toBeCloseTo(-1 / 6, 10)
    expect((6 / 36) * (SEVENS_PAYOUT.seven + 1) - 1).toBeCloseTo(-1 / 6, 10)
    const rng = new Rng(17)
    let ret = 0
    const N = 100_000
    for (let i = 0; i < N; i++) ret += playSevens(rng, 'over', 1).payout
    expect(Math.abs(ret / N - 5 / 6)).toBeLessThan(0.015)
  })
})

describe('casino bookkeeping', () => {
  it('settleBet moves money and tracks won/lost', () => {
    const life = makeLife(1000)
    settleBet(life, hero, 100, 0)
    expect(life.money).toBe(900)
    expect(life.casino.lost).toBe(100)
    settleBet(life, hero, 100, 250)
    expect(life.money).toBe(1050)
    expect(life.casino.won).toBe(150)
    expect(life.casino.addiction).toBeGreaterThan(0)
  })

  it('daily loss limit blocks further bets until the day resets', () => {
    const life = makeLife(10_000)
    setLossLimit(life, 300)
    expect(canBet(life, 200).ok).toBe(true)
    settleBet(life, hero, 200, 0)
    expect(canBet(life, 200).ok).toBe(false)
    expect(canBet(life, 100).ok).toBe(true)
    resetCasinoDay(life)
    expect(canBet(life, 200).ok).toBe(true)
    expect(canBet(life, 20_000).ok).toBe(false)
    expect(canBet(life, -5).ok).toBe(false)
  })

  it('Poker Face perk slows addiction; weekly tick decays it', () => {
    const a = makeLife(1e6)
    const b = makeLife(1e6)
    const pf = { ...hero, perks: ['poker_face'] } as Hero
    for (let i = 0; i < 100; i++) {
      settleBet(a, hero, 100, 0)
      settleBet(b, pf, 100, 0)
    }
    expect(b.casino.addiction).toBeLessThan(a.casino.addiction)
    const before = a.casino.addiction
    weeklyCasinoTick(a)
    expect(a.casino.addiction).toBe(before - 5)
  })

  it('in-season visits can be spotted, hurting discipline and making news', () => {
    const rng = new Rng(1)
    let spotted = 0
    for (let i = 0; i < 200; i++) {
      const life = makeLife()
      const v = visitCasino(rng, life, hero, { calendar: { season: 2026, week: 3, day: 4, slot: 2 }, inSeason: true, matchTomorrow: true })
      expect(v.triggerTags).toContain('casino')
      if (v.spotted) {
        spotted++
        expect(life.discipline).toBe(58)
        expect(life.news.length).toBe(1)
        expect(v.triggerTags).toContain('gambling_seen')
      }
    }
    expect(spotted).toBeGreaterThan(40)
    // Off-season: never spotted.
    const life = makeLife()
    for (let i = 0; i < 50; i++) expect(visitCasino(rng, life, hero, { calendar: { season: 2026, week: 0, day: 0, slot: 2 }, inSeason: false }).spotted).toBe(false)
  })
})
