import { Rng } from '../../core/rng'
import type { AssetCategory, Calendar, Hero, Investment, Life } from '../../core/types'
import { ASSETS, ASSET_BY_ID, assetsByCategory } from '../../data/assets'
import { createHero, createLife } from '../career/createHero'
import {
  INVESTMENT_KINDS, amortizedPayment, assetHappiness, bankruptcyGuard, buyAsset, deposit, invest, maxLoan, netWorth,
  repayLoan, resaleValue, sellAsset, sellInvestment, stepInvestment, takeLoan, weeklyEconomy, withdraw,
} from './economy'

const APPEARANCE = { skin: 0, hairStyle: 0, hairColor: 0, beard: 0, eyeColor: 0, face: 0, accessory: 0 }

function setup(seed = 1): { rng: Rng; hero: Hero; life: Life } {
  const rng = new Rng(seed)
  const hero = createHero(rng, {
    firstName: 'Deniz', lastName: 'Kaya', nickname: 'Deniz', nationality: 'TR', position: 'ST', foot: 'R',
    appearance: APPEARANCE, role: 'runner', background: 'street', birthYear: 2009,
  })
  const life = createLife(rng, hero, 'street')
  return { rng, hero, life }
}

const cal = (season: number, week: number): Calendar => ({ season, week, day: 0, slot: 0 })

function contract(hero: Hero, wage: number): void {
  hero.contract = { clubId: 'c1', wage, untilSeason: 2040, signingBonus: 0, goalBonus: 0, assistBonus: 0, releaseClause: null, role: 'starter' }
}

function allFinite(life: Life): boolean {
  const nums = [life.money, life.bank.savings, life.bank.creditScore, ...life.bank.investments.flatMap((i) => [i.value, i.amount])]
  if (life.bank.loan) nums.push(life.bank.loan.remaining, life.bank.loan.weeklyPayment, life.bank.loan.rate)
  return nums.every(Number.isFinite)
}

function simulate(rng: Rng, hero: Hero, life: Life, seasons: number, each?: (s: number, w: number) => void): void {
  for (let s = 0; s < seasons; s++) {
    for (let w = 0; w < 44; w++) {
      each?.(2026 + s, w)
      const r = weeklyEconomy(rng, life, hero, { calendar: cal(2026 + s, w) })
      expect(Number.isFinite(r.net)).toBe(true)
      for (const v of Object.values(r.breakdown)) expect(Number.isFinite(v)).toBe(true)
      expect(allFinite(life)).toBe(true)
      expect(life.bank.creditScore).toBeGreaterThanOrEqual(300)
      expect(life.bank.creditScore).toBeLessThanOrEqual(850)
    }
  }
}

describe('asset catalogue', () => {
  const CATS: AssetCategory[] = ['house', 'car', 'watch', 'fashion', 'tech', 'pet', 'boat', 'jet', 'art', 'island', 'business', 'facility']
  const KEYS = new Set(['recovery', 'xp_bonus', 'travel_fatigue', 'happiness_partner', 'stress_relief', 'rent_income', 'business_income', 'followers', 'sleep', 'injury_resist', 'security', 'collector'])

  it('has ≥80 items covering every category with unique ids', () => {
    expect(ASSETS.length).toBeGreaterThanOrEqual(80)
    expect(new Set(ASSETS.map((a) => a.id)).size).toBe(ASSETS.length)
    for (const c of CATS) expect(assetsByCategory(c).length).toBeGreaterThan(0)
  })
  it('spans scooter to private island prices', () => {
    const prices = ASSETS.map((a) => a.price)
    expect(Math.min(...prices)).toBeLessThanOrEqual(1_500)
    expect(Math.max(...assetsByCategory('island').map((a) => a.price))).toBeGreaterThanOrEqual(50_000_000)
  })
  it('uses only contract effect keys and sane fields', () => {
    for (const a of ASSETS) {
      if (a.effect) expect(KEYS.has(a.effect.key)).toBe(true)
      expect(a.price).toBeGreaterThan(0)
      expect(a.upkeep).toBeGreaterThanOrEqual(0)
      // Big-ticket items stay < 1%/week; cheap pets/sneakers may cost more to feed than to buy.
      if (a.price >= 50_000) expect(a.upkeep).toBeLessThan(a.price * 0.01)
      expect(a.resale).toBeGreaterThanOrEqual(0)
      expect(a.resale).toBeLessThanOrEqual(1.3)
      expect(a.name.tr.length).toBeGreaterThan(0)
      expect(a.name.en.length).toBeGreaterThan(0)
    }
  })
  it('gates luxury tiers by reputation more as price rises', () => {
    for (const a of ASSETS) if (a.price >= 5_000_000) expect(a.minReputation ?? 0).toBeGreaterThanOrEqual(40)
  })
  it('has the required signature effects', () => {
    const has = (k: string, c: AssetCategory) => ASSETS.some((a) => a.category === c && a.effect?.key === k)
    expect(has('travel_fatigue', 'jet')).toBe(true)
    expect(has('recovery', 'facility')).toBe(true)
    expect(has('xp_bonus', 'facility')).toBe(true)
    expect(has('happiness_partner', 'house')).toBe(true)
    expect(has('business_income', 'business')).toBe(true)
  })
})

describe('resale curve', () => {
  it('cars drop immediately then slide toward resale and keep depreciating', () => {
    const def = ASSET_BY_ID.car_kestrel_gt!
    const o = { defId: def.id, boughtSeason: 2026, boughtWeek: 0, pricePaid: def.price }
    const v0 = resaleValue(o, def!, cal(2026, 0))
    const v1 = resaleValue(o, def!, cal(2027, 0))
    const v3 = resaleValue(o, def!, cal(2029, 0))
    expect(v0).toBeCloseTo(def.price * 0.87, -1)
    expect(v1).toBeCloseTo(def.price * def.resale, -1)
    expect(v3).toBeLessThan(v1)
    expect(v3).toBeGreaterThan(0)
  })
  it('blue-chip art appreciates over years (capped)', () => {
    const def = ASSET_BY_ID.art_masterpiece!
    const o = { defId: def.id, boughtSeason: 2026, boughtWeek: 0, pricePaid: def.price }
    expect(resaleValue(o, def!, cal(2026, 0))).toBeLessThan(def.price)
    expect(resaleValue(o, def!, cal(2028, 0))).toBeGreaterThan(def.price)
    expect(resaleValue(o, def!, cal(2050, 0))).toBe(resaleValue(o, def!, cal(2040, 0)))
  })
  it('houses keep ~resale value', () => {
    const def = ASSET_BY_ID.house_flat!
    const o = { defId: def.id, boughtSeason: 2026, boughtWeek: 0, pricePaid: def.price }
    expect(resaleValue(o, def!, cal(2030, 0))).toBeCloseTo(def.price * def.resale, -2)
  })
})

describe('buy / sell / happiness', () => {
  it('blocks unaffordable and reputation-gated items; buys and sells', () => {
    const { hero, life } = setup()
    life.money = 1_000
    expect(buyAsset(life, hero, 'car_kestrel_gt', cal(2026, 0))[0]!.en).toMatch(/afford/)
    life.money = 10_000_000
    expect(buyAsset(life, hero, 'car_spectra_hyper', cal(2026, 0))[0]!.en).toMatch(/famous/)
    buyAsset(life, hero, 'car_kestrel_gt', cal(2026, 0))
    expect(life.assets).toHaveLength(1)
    expect(buyAsset(life, hero, 'car_kestrel_gt', cal(2026, 0))[0]!.en).toMatch(/already/)
    const before = life.money
    const r = sellAsset(life, 'car_kestrel_gt', cal(2026, 10))
    expect(r.amount).toBeGreaterThan(0)
    expect(life.money).toBe(before + r.amount)
    expect(life.assets).toHaveLength(0)
  })
  it('fame bump diminishes with reputation', () => {
    const a = setup(2), b = setup(3)
    a.life.money = b.life.money = 1e8
    a.hero.reputation = 50; b.hero.reputation = 90
    buyAsset(a.life, a.hero, 'house_villa', cal(2026, 0))
    buyAsset(b.life, b.hero, 'house_villa', cal(2026, 0))
    expect(a.hero.reputation - 50).toBeGreaterThan(b.hero.reputation - 90)
  })
  it('asset happiness has diminishing returns', () => {
    const { hero, life } = setup()
    life.money = 1e9; hero.reputation = 100
    buyAsset(life, hero, 'watch_kronos_diver', cal(2026, 0))
    const one = assetHappiness(life)
    for (const id of ['watch_tik_sport', 'watch_valmont_chrono', 'watch_helvetia_royal', 'watch_duval_tourbillon', 'watch_orbis_grand']) buyAsset(life, hero, id, cal(2026, 0))
    const sum = life.assets.reduce((s, o) => s + ASSET_BY_ID[o.defId]!.happiness, 0)
    expect(assetHappiness(life)).toBeGreaterThan(one)
    expect(assetHappiness(life)).toBeLessThan(sum)
  })
})

describe('bank & loans', () => {
  it('deposit/withdraw move money and savings earn interest', () => {
    const { rng, hero, life } = setup()
    life.money = 10_000
    deposit(life, 8_000)
    expect(life.money).toBe(2_000)
    expect(life.bank.savings).toBe(8_000)
    weeklyEconomy(rng, life, hero, { calendar: cal(2026, 1) })
    expect(life.bank.savings).toBeGreaterThan(8_000)
    withdraw(life, 1e9)
    expect(life.bank.savings).toBe(0)
  })
  it('amortized loan is paid off on schedule', () => {
    const { rng, hero, life } = setup()
    contract(hero, 20_000)
    life.bank.creditScore = 750
    expect(maxLoan(life, hero)).toBeGreaterThan(100_000)
    takeLoan(life, hero, 100_000, 52)
    expect(life.bank.loan).not.toBeNull()
    const pay = amortizedPayment(100_000, life.bank.loan!.rate, 52)
    expect(pay * 52).toBeGreaterThan(100_000)
    const credit0 = life.bank.creditScore
    for (let w = 0; w < 53 && life.bank.loan; w++) weeklyEconomy(rng, life, hero, { calendar: cal(2026, w) })
    expect(life.bank.loan).toBeNull()
    expect(life.bank.creditScore).toBeGreaterThan(credit0)
  })
  it('refuses loans beyond limits and second loans', () => {
    const { hero, life } = setup()
    contract(hero, 1_000)
    expect(takeLoan(life, hero, 10_000_000, 52)[0]!.en).toMatch(/at most/)
    takeLoan(life, hero, 1_000, 52)
    expect(takeLoan(life, hero, 1_000, 52)[0]!.en).toMatch(/current loan/)
    expect(repayLoan(life)[0]!.en).toMatch(/repaid/)
  })
  it('missed payments hurt credit', () => {
    const { rng, hero, life } = setup()
    life.bank.loan = { principal: 50_000, remaining: 50_000, weeklyPayment: 2_000, rate: 0.1 }
    life.money = 0
    const c0 = life.bank.creditScore
    weeklyEconomy(rng, life, hero, { calendar: cal(2026, 0) })
    expect(life.bank.creditScore).toBeLessThan(c0)
    expect(life.bank.loan!.remaining).toBeGreaterThan(50_000)
  })
})

describe('investments', () => {
  function runYear(kind: Investment['kind'], n: number): number[] {
    const rng = new Rng(`inv-${kind}`)
    const out: number[] = []
    for (let i = 0; i < n; i++) {
      const inv: Investment = { id: 'x', kind, name: INVESTMENT_KINDS[kind].name, amount: 1000, value: 1000 }
      for (let w = 0; w < 52; w++) stepInvestment(rng, inv)
      out.push(inv.value / 1000)
    }
    return out
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) }

  it('index drifts up ~7%/yr with ~15% volatility', () => {
    const r = runYear('index', 4000)
    expect(mean(r)).toBeGreaterThan(1.04); expect(mean(r)).toBeLessThan(1.10)
    expect(sd(r)).toBeGreaterThan(0.11); expect(sd(r)).toBeLessThan(0.2)
  })
  it('bonds are low-variance positive', () => {
    const r = runYear('bonds', 2000)
    expect(mean(r)).toBeGreaterThan(1.015); expect(mean(r)).toBeLessThan(1.045)
    expect(sd(r)).toBeLessThan(0.05)
  })
  it('property is steady', () => {
    const r = runYear('property', 2000)
    expect(mean(r)).toBeGreaterThan(1.01); expect(sd(r)).toBeLessThan(0.1)
  })
  it('crypto is very volatile and the median investor loses', () => {
    const r = runYear('crypto', 4000)
    expect(sd(r)).toBeGreaterThan(0.6)
    expect(median(r)).toBeLessThan(1)
  })
  it('startups bust sometimes and are high variance', () => {
    const r = runYear('startup', 4000)
    expect(r.filter((x) => x < 0.05).length / r.length).toBeGreaterThan(0.08)
    expect(sd(r)).toBeGreaterThan(0.4)
  })
  it('invest and sell round-trip with fees', () => {
    const { rng, life } = setup()
    life.money = 50_000
    invest(life, 'index', 20_000, rng)
    expect(life.money).toBe(30_000)
    const id = life.bank.investments[0]!.id
    const r = sellInvestment(life, id)
    expect(r.amount).toBe(Math.round(20_000 * 0.995))
    expect(invest(life, 'crypto', 10, rng)[0]!.en).toMatch(/Minimum/)
  })
})

describe('weekly economy over 10 seasons', () => {
  it('poor youth stays finite', () => {
    const { rng, hero, life } = setup(11)
    contract(hero, 400)
    simulate(rng, hero, life, 10)
    expect(life.money).toBeGreaterThan(0)
  })

  it('rich star with assets, investments, loan, sponsors and trainer stays finite', () => {
    const { rng, hero, life } = setup(12)
    contract(hero, 250_000)
    hero.reputation = 95
    life.money = 300_000_000
    life.agent = { name: 'Ajan', quality: 5, commission: 0.1 }
    life.trainer = { name: 'Hoca', group: 'technical', weeklyFee: 5_000 }
    life.sponsors = [{ id: 's', brand: 'Volt', category: 'boots', weekly: 40_000, untilSeason: 2030, minReputation: 50 }]
    for (const a of ASSETS) if (a.price < 20_000_000) buyAsset(life, hero, a.id, cal(2026, 0))
    for (const k of Object.keys(INVESTMENT_KINDS) as Investment['kind'][]) invest(life, k, 2_000_000, rng)
    life.bank.creditScore = 800
    takeLoan(life, hero, 1_000_000, 200)
    simulate(rng, hero, life, 10)
    expect(life.sponsors).toHaveLength(0) // expired after 2030
    expect(netWorth(life, cal(2036, 0))).toBeGreaterThan(0)
  })

  it('broke gambler gets liquidated by the bankruptcy guard', () => {
    const { rng, hero, life } = setup(13)
    contract(hero, 2_000)
    hero.reputation = 100
    life.money = 40_000_000
    buyAsset(life, hero, 'boat_azure45', cal(2026, 0))
    buyAsset(life, hero, 'art_popart', cal(2026, 0))
    buyAsset(life, hero, 'car_furia_v12', cal(2026, 0))
    life.money = 50_000
    deposit(life, 50_000)
    const lines: string[] = []
    simulate(rng, hero, life, 10, (s, w) => {
      life.money -= 20_000 // weekly casino losses
      if (life.money < 0 && w === 0) lines.push(...bankruptcyGuard(life, cal(s, w)).lines.map((l) => l.en))
    })
    expect(life.assets.length).toBe(0)
    expect(life.bank.savings).toBe(0)
    expect(life.flags.bankrupt).toBe(true)
    expect(life.bank.creditScore).toBeLessThan(600)
  })

  it('guard sells smallest-loss assets first', () => {
    const { hero, life } = setup(14)
    hero.reputation = 100
    life.money = 1e7
    buyAsset(life, hero, 'car_furia_v12', cal(2026, 0))
    buyAsset(life, hero, 'art_popart', cal(2026, 0))
    life.money = -10_000
    bankruptcyGuard(life, cal(2028, 0))
    expect(life.assets.map((a) => a.defId)).toEqual(['car_furia_v12'])
    expect(life.money).toBeGreaterThanOrEqual(0)
  })
})

describe('bankruptcy flag hygiene', () => {
  it('a rookie overdraft inside the grace is not bankruptcy', () => {
    const { life } = setup()
    life.assets = []
    life.bank.savings = 0
    life.money = -600
    bankruptcyGuard(life, cal(2026, 3), 300)
    expect(life.flags.bankrupt).not.toBe(true)
  })
  it('a big hole with nothing to sell is bankruptcy', () => {
    const { life } = setup()
    life.assets = []
    life.bank.savings = 0
    life.money = -50_000
    bankruptcyGuard(life, cal(2026, 3), 300)
    expect(life.flags.bankrupt).toBe(true)
  })
  it('recovered cash clears a stale flag on the next weekly tick', () => {
    const { rng, hero, life } = setup()
    contract(hero, 5_000)
    life.flags.bankrupt = true
    life.money = 20_000
    weeklyEconomy(rng, life, hero, { calendar: cal(2026, 5) } as never)
    expect(life.flags.bankrupt).toBe(false)
  })
})

describe('low-cash warning (2.5#109)', () => {
  it('warns once before forced sales, then rate-limits', () => {
    const { rng, hero, life } = setup(3)
    hero.contract = null
    life.sponsors = []
    life.assets = [{ defId: ASSETS[0]!.id, boughtSeason: 2026, boughtWeek: 0, pricePaid: ASSETS[0]!.price }]
    life.money = 1500
    life.trainer = { name: 'T', group: 'technical', weeklyFee: 1000 }
    const warn = (w: number) =>
      weeklyEconomy(rng, life, hero, { calendar: cal(2026, w) }).lines.some((l) => l.en.includes('Cash is draining'))
    expect(warn(1)).toBe(true)
    life.money = 1500
    expect(warn(2)).toBe(false)
    life.money = 1500
    expect(warn(6)).toBe(true)
  })
  it('does not warn when there is nothing to sell or flow is positive', () => {
    const { rng, hero, life } = setup(4)
    life.assets = []
    life.bank.investments = []
    life.businesses = []
    life.money = 10
    expect(weeklyEconomy(rng, life, hero, { calendar: cal(2026, 1) }).lines.some((l) => l.en.includes('Cash is draining'))).toBe(false)
  })
})

describe('basic living costs (2.5#15)', () => {
  it('scale with the wage inside a floor and a cap, and show up in the weekly statement', async () => {
    const { livingCost, LIVING_MIN, LIVING_MAX, LIVING_RATE } = await import('./economy')
    expect(livingCost(0)).toBe(LIVING_MIN)
    expect(livingCost(1000)).toBe(Math.round(1000 * LIVING_RATE))
    expect(livingCost(10_000_000)).toBe(LIVING_MAX)
    expect(Number.isFinite(livingCost(Number.NaN))).toBe(true)
  })

  it('every contract covers its basics: net after tax, agent and living costs stays positive', async () => {
    const { livingCost, INCOME_TAX } = await import('./economy')
    for (const wage of [150, 300, 860, 5_000, 80_000, 400_000]) {
      const net = wage * (1 - INCOME_TAX - 0.3) - livingCost(wage)
      expect(net).toBeGreaterThan(0)
    }
  })
})

describe('top-end brackets (Tur 3b)', () => {
  it('leave normal incomes alone and bite only the slices above each threshold', async () => {
    const { topBracketTax, lifestyleCost, TAX_BRACKETS, LIFESTYLE_FROM } = await import('./economy')
    expect(topBracketTax(50_000)).toBe(0)
    expect(topBracketTax(TAX_BRACKETS[0]!.from)).toBe(0)
    expect(topBracketTax(200_000)).toBeCloseTo(8_000, 5)
    const rich = topBracketTax(500_000)
    expect(rich).toBeCloseTo(18_000 + 40_000, 5)
    expect(rich / 500_000).toBeLessThan(0.15) // a surcharge, never a confiscation
    expect(lifestyleCost(LIFESTYLE_FROM)).toBe(0)
    expect(lifestyleCost(400_000)).toBeGreaterThan(15_000)
  })
})
