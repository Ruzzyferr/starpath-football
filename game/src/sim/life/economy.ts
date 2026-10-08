/**
 * Personal economy (GDD 4.3 / 4.4): weekly cash flow, assets with a resale
 * curve, bank savings, loans with a credit score, investments with a random
 * walk per asset class, and a bankruptcy guard.
 *
 * Every function is pure-ish: it mutates the passed Life/Hero and returns
 * localized feedback lines; randomness comes only from the passed Rng.
 */
import type { AssetDef, Calendar, Hero, Investment, Life, OwnedAsset, TermDeposit } from '../../core/types'
import type { Rng } from '../../core/rng'
import { absWeek, clamp, fill, finite, fmtMoney, lt, type Lines } from '../career/common'
import { ASSET_BY_ID } from '../../data/assets'
import { ownedAssetDefs } from './assetEffects'
import { businessesValue, sellBusiness, weeklyBusinessTick } from './business'
import { projectsValue, weeklyProjectsTick } from './projects'

// ───────────────────────── Tuning ─────────────────────────

/**
 * Flat income tax on wage + sponsor income. 35% approximates a top-bracket
 * European footballer once deductions are averaged in; flat keeps the weekly
 * statement readable for players.
 */
export const INCOME_TAX = 0.35
/** Country income-tax rates (fiction-calibrated 27-40%; the table mean stays near {@link INCOME_TAX}). */
export const COUNTRY_TAX: Readonly<Record<string, number>> = {
  TR: 0.27, EN: 0.4, ES: 0.38, DE: 0.38, IT: 0.38, FR: 0.38, PT: 0.28, NL: 0.35, BR: 0.27, AR: 0.3, US: 0.36, JP: 0.4,
}
/** Income-tax rate for the club's country (flat default when unknown). */
/**
 * Top-end brackets (Tur 3b): a star's weekly gross (wage + sponsors) is taxed
 * extra on the slices above each threshold, on top of the country rate. Early
 * and mid careers (weekly gross below the first threshold) are untouched; this
 * is what keeps a 26-year-old star's fortune in the 8-20M band.
 */
export const TAX_BRACKETS: readonly { from: number; extra: number }[] = [{ from: 120_000, extra: 0.1 }, { from: 300_000, extra: 0.2 }]
export function topBracketTax(weeklyGross: number): number {
  let t = 0
  for (let i = 0; i < TAX_BRACKETS.length; i++) {
    const lo = TAX_BRACKETS[i]!.from
    const hi = TAX_BRACKETS[i + 1]?.from ?? Infinity
    t += Math.max(0, Math.min(weeklyGross, hi) - lo) * TAX_BRACKETS[i]!.extra
  }
  return t
}
export const incomeTaxRate = (countryId?: string | null): number => (countryId ? COUNTRY_TAX[countryId] : undefined) ?? INCOME_TAX
/** Tax on passive rent/business profit (lower: deductions, corporate wrappers). */
export const PASSIVE_TAX = 0.2
/** Annual savings interest: low but safe — beats a mattress, loses to the index fund. */
export const SAVINGS_RATE = 0.025
/** Weeks per year used for annual→weekly conversions (calendar year, not league length). */
export const WEEKS_PER_YEAR = 52

/** Credit score bounds (FICO-like). */
export const CREDIT_MIN = 300
export const CREDIT_MAX = 850
/** Credit score drifts toward this with no loan (clean history builds slowly). */
const CREDIT_IDLE_TARGET = 700

/** Loan APR: 3% for perfect credit, 20% at the floor (linear). */
export function loanRate(creditScore: number): number {
  const s = clamp(creditScore, CREDIT_MIN, CREDIT_MAX)
  return 0.03 + ((CREDIT_MAX - s) / (CREDIT_MAX - CREDIT_MIN)) * 0.17
}

/**
 * Investment classes: annual arithmetic mean return `mu`, annual volatility
 * `sigma`, optional jump events and cash yield. Weekly step is lognormal with
 * log-drift (mu − σ²/2)/52 so the *mean* return equals mu while the *median*
 * investor in a volatile asset does worse (crypto: median loses).
 *  - index:    +7%/yr, σ 15%   — the sensible default.
 *  - bonds:    +3%/yr, σ 3%    — parking money.
 *  - property: +4%/yr, σ 6%, plus 4%/yr rent paid in cash.
 *  - startup:  +3%/yr diffusion, σ 45%; weekly 0.3% bust (→2% of value, ~15%/yr)
 *              and 0.04% exit (×10, ~2%/yr) — lottery-ticket feel, EV ≈ index.
 *  - crypto:   +5%/yr, σ 90%   — wild ride, median investor loses money.
 */
export const INVESTMENT_KINDS: Readonly<Record<Investment['kind'], {
  mu: number; sigma: number; cashYield: number; bust: number; exit: number; sellFee: number; name: { tr: string; en: string }
}>> = {
  index: { mu: 0.07, sigma: 0.15, cashYield: 0, bust: 0, exit: 0, sellFee: 0.005, name: lt('Küresel Endeks Fonu', 'Global Index Fund') },
  bonds: { mu: 0.03, sigma: 0.03, cashYield: 0, bust: 0, exit: 0, sellFee: 0.002, name: lt('Devlet Tahvili', 'Government Bonds') },
  property: { mu: 0.04, sigma: 0.06, cashYield: 0.04, bust: 0, exit: 0, sellFee: 0.03, name: lt('Gayrimenkul Fonu', 'Property Fund') },
  startup: { mu: 0.03, sigma: 0.45, cashYield: 0, bust: 0.003, exit: 0.0004, sellFee: 0.1, name: lt('Girişim Hissesi', 'Startup Equity') },
  crypto: { mu: 0.05, sigma: 0.9, cashYield: 0, bust: 0, exit: 0, sellFee: 0.01, name: lt('Kripto Sepeti', 'Crypto Basket') },
}
/**
 * Basic weekly living costs (rent, food, transport, basic care; 2.5#15):
 * 6 % of the gross wage, never below 25 or above 3 000. Covered by any
 * contract by construction (the ratio stays far below the 100 % - tax - agent
 * share), so only luxury spending (assets, trainer, casino) can create debt.
 */
export const LIVING_RATE = 0.06
export const LIVING_MIN = 25
export const LIVING_MAX = 3_000
/** Lifestyle upkeep of the very rich (staff, security, travel): a share of the wage above this line. */
export const LIFESTYLE_FROM = 80_000
export const LIFESTYLE_RATE = 0.06
export const lifestyleCost = (weeklyWage: number): number => Math.round(Math.max(0, finite(weeklyWage) - LIFESTYLE_FROM) * LIFESTYLE_RATE)
export const livingCost = (weeklyWage: number): number => Math.round(clamp(finite(weeklyWage) * LIVING_RATE, LIVING_MIN, LIVING_MAX))

/** Minimum investment ticket. */
export const MIN_INVESTMENT = 1_000

/** Weekly noise on business income (±60% sd): a café can have a losing week. */
const BUSINESS_SD = 0.6

/**
 * Depreciation per year AFTER the first year, by category (first year follows
 * the def's `resale`). Cars/tech keep sliding, property/art/business hold.
 */
const LATER_DEPRECIATION: Readonly<Record<AssetDef['category'], number>> = {
  car: 0.85, tech: 0.6, fashion: 0.8, watch: 0.98, pet: 1, boat: 0.9, jet: 0.9,
  house: 1, island: 1, art: 1, business: 1, facility: 0.9,
}
/** Immediate drive-off-the-lot drop: worth at most 87% of the price the day after. */
const IMMEDIATE_RESALE = 0.87
/** Appreciating items: dealer cut on immediate resale, growth capped after 5 years. */
const ART_DEALER_CUT = 0.9
const ART_MAX_YEARS = 5

// ───────────────────────── Assets ─────────────────────────

const ownedAge = (o: OwnedAsset, cal: Pick<Calendar, 'season' | 'week'>): number =>
  Math.max(0, absWeek(cal) - absWeek({ season: o.boughtSeason, week: o.boughtWeek }))

/**
 * Current resale value of an owned asset.
 *  - Depreciating (resale < 1): instant drop to min(87%, …) — or straight to
 *    `resale` if that is higher (property) — then linear slide to `resale` at
 *    one year, then the category's yearly depreciation (floor 5%).
 *  - Appreciating (resale ≥ 1, e.g. blue-chip art): 90% on day one (dealer
 *    cut), rising to `resale` after a year and compounding for up to 5 years.
 * Deterministic: no Rng, so the shop UI can preview it.
 */
export function resaleValue(owned: OwnedAsset, def: AssetDef, cal: Pick<Calendar, 'season' | 'week'>): number {
  const years = ownedAge(owned, cal) / WEEKS_PER_YEAR
  let f: number
  if (def.resale >= 1) {
    if (years <= 1) f = ART_DEALER_CUT + (def.resale - ART_DEALER_CUT) * years
    else f = def.resale ** Math.min(years, ART_MAX_YEARS)
  } else {
    const f0 = Math.max(def.resale, IMMEDIATE_RESALE)
    if (years <= 1) f = f0 + (def.resale - f0) * years
    else f = def.resale > 0 ? Math.max(0.05, def.resale * LATER_DEPRECIATION[def.category] ** (years - 1)) : 0
  }
  return Math.max(0, Math.round(finite(owned.pricePaid * f)))
}

/**
 * Passive weekly happiness from owned assets with diminishing returns: items
 * sorted by happiness, the i-th counts ×0.75^i. Ten watches ≈ 4× one watch.
 * The wellbeing system caps the contribution at +12.
 */
export function assetHappiness(life: Life): number {
  const hs = ownedAssetDefs(life).map((d) => d.happiness).sort((p, q) => q - p)
  let s = 0
  for (let i = 0; i < hs.length; i++) s += hs[i]! * 0.75 ** i
  return finite(s)
}

/** Weekly upkeep of all owned assets. */
export const assetUpkeep = (life: Life): number => ownedAssetDefs(life).reduce((s, d) => s + d.upkeep, 0)

/** Why a purchase is blocked (null = allowed). */
export function purchaseBlock(life: Life, hero: Pick<Hero, 'reputation'>, defId: string): 'unknown' | 'owned' | 'reputation' | 'money' | null {
  const def = ASSET_BY_ID[defId]
  if (!def) return 'unknown'
  if (life.assets.some((o) => o.defId === defId)) return 'owned'
  if (def.minReputation !== undefined && hero.reputation < def.minReputation) return 'reputation'
  if (life.money < def.price) return 'money'
  return null
}

/**
 * Buy an asset for cash. Fame bump is diminishing: `fame × (1 − rep/100)`, so a
 * supercar makes a youngster famous but barely registers for a global star.
 */
export function buyAsset(life: Life, hero: Hero, defId: string, cal: Calendar): Lines {
  const def = ASSET_BY_ID[defId]
  const block = purchaseBlock(life, hero, defId)
  if (!def || block === 'unknown') return [lt('Böyle bir ürün bulunamadı.', 'No such item.')]
  if (block === 'owned') return [fill(lt('{n} zaten sende var.', 'You already own the {n}.'), { n: def.name })]
  if (block === 'reputation') return [fill(lt('{n} için henüz yeterince ünlü değilsin (şöhret {r} gerekli).', 'You are not famous enough for the {n} yet (reputation {r} needed).'), { n: def.name, r: def.minReputation ?? 0 })]
  if (block === 'money') return [fill(lt('{n} için paran yetmiyor ({p}).', 'You cannot afford the {n} ({p}).'), { n: def.name, p: fmtMoney(def.price) })]
  life.money -= def.price
  life.assets.push({ defId, boughtSeason: cal.season, boughtWeek: cal.week, pricePaid: def.price })
  const lines: Lines = [fill(lt('{i} {n} satın aldın ({p}).', '{i} You bought the {n} ({p}).'), { i: def.icon, n: def.name, p: fmtMoney(def.price) })]
  if (def.fame > 0) {
    const bump = def.fame * (1 - clamp(hero.reputation, 0, 100) / 100)
    hero.reputation = clamp(hero.reputation + bump, 0, 100)
    if (bump >= 0.5) lines.push(fill(lt('Şöhret +{f}', 'Reputation +{f}'), { f: bump.toFixed(1) }))
  }
  return lines
}

/** Sell an owned asset (by index in life.assets or by defId) at its resale value. */
export function sellAsset(life: Life, which: number | string, cal: Pick<Calendar, 'season' | 'week'>): { amount: number; lines: Lines } {
  const idx = typeof which === 'number' ? which : life.assets.findIndex((o) => o.defId === which)
  const owned = life.assets[idx]
  const def = owned ? ASSET_BY_ID[owned.defId] : undefined
  if (!owned || !def) return { amount: 0, lines: [lt('Satılacak eşya bulunamadı.', 'Nothing to sell.')] }
  const amount = resaleValue(owned, def, cal)
  life.assets.splice(idx, 1)
  life.money += amount
  return { amount, lines: [fill(lt('{i} {n} satıldı: {p}', '{i} Sold the {n}: {p}'), { i: def.icon, n: def.name, p: fmtMoney(amount) })] }
}

// ───────────────────────── Bank ─────────────────────────

/** Move cash into savings. */
export function deposit(life: Life, amount: number): Lines {
  const a = Math.min(Math.max(0, finite(amount)), Math.max(0, life.money))
  if (a <= 0) return [lt('Yatırılacak nakit yok.', 'No cash to deposit.')]
  life.money -= a
  life.bank.savings += a
  return [fill(lt('Mevduata {p} yatırdın.', 'Deposited {p} into savings.'), { p: fmtMoney(a) })]
}

/** Move savings into cash. */
export function withdraw(life: Life, amount: number): Lines {
  const a = Math.min(Math.max(0, finite(amount)), life.bank.savings)
  if (a <= 0) return [lt('Çekilecek birikim yok.', 'No savings to withdraw.')]
  life.bank.savings -= a
  life.money += a
  return [fill(lt('Mevduattan {p} çektin.', 'Withdrew {p} from savings.'), { p: fmtMoney(a) })]
}

/** Image-rights clause: the player keeps the rights, sponsor income +15%. */
export const IMAGE_RIGHTS_BONUS = 1.15

// ───────────────────────── Term deposits (GDD 4.4) ─────────────────────────

/** Annual rate by term length: 13 weeks 3.5%, 26 weeks 4.5%, 52 weeks 6% (savings: 2.5%). */
export const TERM_OPTIONS: readonly { weeks: number; rate: number }[] = [
  { weeks: 13, rate: 0.035 }, { weeks: 26, rate: 0.045 }, { weeks: 52, rate: 0.06 },
]
/** Breaking a term deposit early forfeits all interest plus this share of the principal. */
export const TERM_BREAK_FEE = 0.01

export const termInterest = (d: Pick<TermDeposit, 'amount' | 'rate' | 'weeks'>): number => d.amount * d.rate * (d.weeks / WEEKS_PER_YEAR)

/** Lock cash in a term deposit. */
export function openTermDeposit(life: Life, amount: number, weeks: number, cal: Pick<Calendar, 'season' | 'week'>): Lines {
  const opt = TERM_OPTIONS.find((o) => o.weeks === weeks)
  const a = Math.min(Math.floor(Math.max(0, finite(amount))), Math.floor(Math.max(0, life.money)))
  if (!opt) return [lt('Geçersiz vade.', 'Invalid term.')]
  if (a < 1000) return [lt('Vadeli mevduat için en az 1.000 gerekir.', 'A term deposit needs at least 1,000.')]
  life.money -= a
  const list = (life.bank.termDeposits ??= [])
  list.push({ id: `td${absWeek(cal)}_${list.length}_${Math.round(a)}`, amount: a, rate: opt.rate, weeks, maturesAt: absWeek(cal) + weeks })
  return [fill(lt('{p} vadeli mevduata kilitlendi: {w} hafta, %{r}.', 'Locked {p} in a term deposit: {w} weeks at {r}%.'), { p: fmtMoney(a), w: weeks, r: +(opt.rate * 100).toFixed(1) })]
}

/** Break a term deposit early: principal back minus the fee, no interest. */
export function breakTermDeposit(life: Life, id: string): Lines {
  const list = life.bank.termDeposits ?? []
  const i = list.findIndex((d) => d.id === id)
  if (i < 0) return [lt('Vadeli mevduat bulunamadı.', 'Term deposit not found.')]
  const d = list[i]!
  list.splice(i, 1)
  const back = Math.round(d.amount * (1 - TERM_BREAK_FEE))
  life.money += back
  return [fill(lt('Vadeli mevduat erken bozuldu: {p} geri geldi (faiz yok, %1 ceza).', 'Term deposit broken early: {p} back (no interest, 1% fee).'), { p: fmtMoney(back) })]
}

/** Total locked principal (net worth / UI). */
export const termDepositsValue = (life: Life): number => (life.bank.termDeposits ?? []).reduce((s, d) => s + d.amount, 0)

/** Pay out matured term deposits into cash. */
function matureTermDeposits(life: Life, cal: Pick<Calendar, 'season' | 'week'>): Lines {
  const list = life.bank.termDeposits
  if (!list?.length) return []
  const now = absWeek(cal)
  const lines: Lines = []
  life.bank.termDeposits = list.filter((d) => {
    if (d.maturesAt > now) return true
    const pay = Math.round(d.amount + termInterest(d))
    life.money += pay
    lines.push(fill(lt('🏦 Vadeli mevduat vadesi doldu: {p} (faiz {i}).', '🏦 Term deposit matured: {p} (interest {i}).'), { p: fmtMoney(pay), i: fmtMoney(Math.round(termInterest(d))) }))
    return false
  })
  return lines
}

/** Gross weekly income the bank counts for affordability (wage + sponsors). */
export function weeklyIncome(life: Life, hero: Pick<Hero, 'contract' | 'retired'>): number {
  const wage = !hero.retired && hero.contract ? hero.contract.wage : 0
  return wage + life.sponsors.reduce((s, d) => s + d.weekly, 0)
}

/**
 * Maximum loan principal: two years of gross income scaled by credit
 * (score 400 → 0, 600 → 0.5×, 800+ → 1×), and the payment may not exceed
 * 40% of net income (affordability rule, checked in takeLoan).
 */
export function maxLoan(life: Life, hero: Pick<Hero, 'contract' | 'retired'>): number {
  const factor = clamp((life.bank.creditScore - 400) / 400, 0, 1)
  return Math.floor(weeklyIncome(life, hero) * WEEKS_PER_YEAR * 2 * factor)
}

/** Amortized weekly payment for principal `p`, APR `rate`, `weeks` payments. */
export function amortizedPayment(p: number, rate: number, weeks: number): number {
  const n = Math.max(1, Math.round(weeks))
  const r = rate / WEEKS_PER_YEAR
  if (r <= 0) return p / n
  return (p * r) / (1 - (1 + r) ** -n)
}

/** Take a loan (one at a time). Rate from credit score; capped by {@link maxLoan} and the 40% rule. */
export function takeLoan(life: Life, hero: Pick<Hero, 'contract' | 'retired'>, amount: number, weeks: number, _cal?: Calendar): Lines {
  const p = Math.round(finite(amount))
  if (life.bank.loan && life.bank.loan.remaining > 0) return [lt('Önce mevcut kredini kapatmalısın.', 'Pay off your current loan first.')]
  if (p <= 0) return [lt('Geçersiz tutar.', 'Invalid amount.')]
  const max = maxLoan(life, hero)
  if (p > max) return [fill(lt('Banka en fazla {m} kredi verebilir.', 'The bank will lend at most {m}.'), { m: fmtMoney(max) })]
  const rate = loanRate(life.bank.creditScore)
  const n = clamp(Math.round(weeks), 4, WEEKS_PER_YEAR * 10)
  const pay = amortizedPayment(p, rate, n)
  const netIncome = weeklyIncome(life, hero) * (1 - INCOME_TAX)
  if (pay > netIncome * 0.4) return [lt('Taksit gelirinin %40’ını aşıyor; banka reddetti.', 'The payment would exceed 40% of your income; the bank declined.')]
  life.bank.loan = { principal: p, remaining: p, weeklyPayment: Math.round(pay * 100) / 100, rate }
  life.money += p
  return [fill(lt('{p} kredi çektin (%{r} faiz, haftalık {w}).', 'Took a {p} loan ({r}% APR, {w}/week).'), { p: fmtMoney(p), r: (rate * 100).toFixed(1), w: fmtMoney(pay) })]
}

/** Extra repayment (default: full payoff). Early payoff improves credit. */
export function repayLoan(life: Life, amount?: number): Lines {
  const loan = life.bank.loan
  if (!loan || loan.remaining <= 0) return [lt('Ödenecek kredin yok.', 'You have no loan to repay.')]
  const a = Math.min(Math.max(0, finite(amount ?? loan.remaining)), loan.remaining, Math.max(0, life.money))
  if (a <= 0) return [lt('Ödeme için nakit yok.', 'No cash for a repayment.')]
  life.money -= a
  loan.remaining = Math.max(0, loan.remaining - a)
  if (loan.remaining < 0.01) {
    life.bank.loan = null
    life.bank.creditScore = clamp(life.bank.creditScore + 10, CREDIT_MIN, CREDIT_MAX)
    return [lt('🎉 Kredini tamamen kapattın!', '🎉 Loan fully repaid!')]
  }
  return [fill(lt('Krediye {p} ek ödeme yaptın.', 'Paid {p} extra off your loan.'), { p: fmtMoney(a) })]
}

// ───────────────────────── Investments ─────────────────────────

/** Put cash into an investment. */
export function invest(life: Life, kind: Investment['kind'], amount: number, rng: Rng): Lines {
  const a = Math.round(finite(amount))
  if (a < MIN_INVESTMENT) return [fill(lt('En az {m} yatırmalısın.', 'Minimum investment is {m}.'), { m: fmtMoney(MIN_INVESTMENT) })]
  if (a > life.money) return [lt('Bu yatırım için nakdin yetmiyor.', 'Not enough cash for this investment.')]
  const k = INVESTMENT_KINDS[kind]
  life.money -= a
  life.bank.investments.push({ id: rng.id('inv'), kind, name: k.name, amount: a, value: a })
  return [fill(lt('{n} yatırımı: {p}', 'Invested {p} in {n}'), { n: k.name, p: fmtMoney(a) })]
}

/** Sell an investment by id (sale fee by kind; startups are illiquid: 10%). */
export function sellInvestment(life: Life, id: string): { amount: number; lines: Lines } {
  const idx = life.bank.investments.findIndex((i) => i.id === id)
  if (idx < 0) return { amount: 0, lines: [lt('Yatırım bulunamadı.', 'Investment not found.')] }
  const inv = life.bank.investments[idx]!
  const amount = Math.max(0, Math.round(finite(inv.value * (1 - INVESTMENT_KINDS[inv.kind].sellFee))))
  life.bank.investments.splice(idx, 1)
  life.money += amount
  const pl = amount - inv.amount
  return {
    amount,
    lines: [fill(lt('{n} satıldı: {p} (kâr/zarar {d})', 'Sold {n}: {p} (P/L {d})'), { n: inv.name, p: fmtMoney(amount), d: fmtMoney(pl) })],
  }
}

/** One weekly step of an investment's value; returns cash yield paid (property rent). */
export function stepInvestment(rng: Rng, inv: Investment): { cash: number; event: 'bust' | 'exit' | null } {
  const k = INVESTMENT_KINDS[inv.kind]
  const wSigma = k.sigma / Math.sqrt(WEEKS_PER_YEAR)
  const wDrift = (k.mu - (k.sigma * k.sigma) / 2) / WEEKS_PER_YEAR
  let v = inv.value * Math.exp(rng.normal(wDrift, wSigma))
  let event: 'bust' | 'exit' | null = null
  if (k.bust > 0 && rng.chance(k.bust)) { v *= 0.02; event = 'bust' }
  else if (k.exit > 0 && rng.chance(k.exit)) { v *= 10; event = 'exit' }
  inv.value = Math.max(0, finite(v, inv.value))
  return { cash: finite(inv.value * (k.cashYield / WEEKS_PER_YEAR)), event }
}

// ───────────────────────── Net worth ─────────────────────────

/** Cash + savings + investments + asset resale − loan. */
export function netWorth(life: Life, cal: Pick<Calendar, 'season' | 'week'>): number {
  let w = life.money + life.bank.savings
  for (const i of life.bank.investments) w += i.value
  for (const o of life.assets) {
    const d = ASSET_BY_ID[o.defId]
    if (d) w += resaleValue(o, d, cal)
  }
  w += businessesValue(life) + termDepositsValue(life) + projectsValue(life)
  if (life.bank.loan) w -= life.bank.loan.remaining
  return finite(w)
}

// ───────────────────────── Weekly tick ─────────────────────────

export interface EconomyContext {
  calendar: Calendar
  /** Income-tax rate of the hero's club country (default {@link INCOME_TAX}). */
  taxRate?: number
}

/** Itemized weekly statement (positive = income, negative = expense). */
export interface EconomyBreakdown {
  wage: number
  sponsors: number
  tax: number
  agentFee: number
  trainer: number
  upkeep: number
  /** Basic living costs: rent, food, transport, basic care (2.5#15). Negative. */
  living: number
  rent: number
  business: number
  investmentYield: number
  loanPayment: number
  savingsInterest: number
  /** Unrealized change of investment values (not cash). */
  investmentChange: number
  /** Cash raised by the bankruptcy guard. */
  forcedSales: number
}

export interface EconomyResult {
  lines: Lines
  /** Net cash flow this week (excludes unrealized investment moves and forced sales). */
  net: number
  breakdown: EconomyBreakdown
}

/**
 * Weekly economy tick. Order:
 *  1. income (wage, sponsors, rent, business, investment yield) and taxes/fees
 *  2. expenses (trainer, upkeep)
 *  3. loan payment (from cash, then savings; else missed: −25 credit, 2% late fee)
 *  4. savings interest, investment random walk
 *  5. credit drift, sponsor expiry
 *  6. bankruptcy guard: savings → investments → assets until cash ≥ 0
 */
export function weeklyEconomy(rng: Rng, life: Life, hero: Hero, ctx: EconomyContext): EconomyResult {
  const cal = ctx.calendar
  const lines: Lines = []
  const b: EconomyBreakdown = {
    wage: 0, sponsors: 0, tax: 0, agentFee: 0, trainer: 0, upkeep: 0, living: 0, rent: 0, business: 0,
    investmentYield: 0, loanPayment: 0, savingsInterest: 0, investmentChange: 0, forcedSales: 0,
  }

  // 1. Income.
  b.wage = !hero.retired && hero.contract ? Math.max(0, finite(hero.contract.wage)) : 0
  // Expired sponsor deals end after their final season.
  const expired = life.sponsors.filter((s) => s.untilSeason < cal.season)
  if (expired.length) {
    life.sponsors = life.sponsors.filter((s) => s.untilSeason >= cal.season)
    for (const s of expired) lines.push(fill(lt('{b} sponsorluğu sona erdi.', 'Your {b} sponsorship has ended.'), { b: s.brand }))
  }
  b.sponsors = life.sponsors.reduce((s, d) => s + Math.max(0, finite(d.weekly)), 0)
  if (hero.contract?.imageRights && !hero.retired) b.sponsors = Math.round(b.sponsors * IMAGE_RIGHTS_BONUS)
  b.tax = -(b.wage + b.sponsors) * (ctx.taxRate ?? INCOME_TAX) - topBracketTax(b.wage + b.sponsors)
  b.agentFee = life.agent ? -(b.wage + b.sponsors) * clamp(finite(life.agent.commission), 0, 0.3) : 0

  for (const d of ownedAssetDefs(life)) {
    if (d.effect?.key === 'rent_income') b.rent += d.effect.value
    if (d.effect?.key === 'business_income') b.business += d.effect.value * (1 + rng.normal(0, BUSINESS_SD))
  }
  // Owned businesses (life/business): weekly P&L, profit or loss.
  if (life.businesses?.length) {
    const biz = weeklyBusinessTick(rng, life, hero, cal)
    b.business += biz.net
    lines.push(...biz.lines)
  }
  // Legacy projects (life/projects): club-stake dividend now, running costs with the other upkeep below.
  const proj = weeklyProjectsTick(life, hero, cal)
  b.business += proj.income
  lines.push(...proj.lines)
  b.business = Math.round(finite(b.business))

  // Investments: random walk + cash yield.
  for (const inv of life.bank.investments) {
    const before = inv.value
    const { cash, event } = stepInvestment(rng, inv)
    b.investmentYield += cash
    b.investmentChange += inv.value - before
    if (event === 'bust') lines.push(fill(lt('📉 {n} battı! Yatırımın neredeyse sıfırlandı.', '📉 {n} went bust! Your stake is almost wiped out.'), { n: inv.name }))
    if (event === 'exit') lines.push(fill(lt('🚀 {n} satın alındı! Yatırımın 10 katına çıktı.', '🚀 {n} got acquired! Your stake is worth 10×.'), { n: inv.name }))
  }
  const passive = b.rent + b.business + b.investmentYield
  // Passive tax only on profit (a loss-making business week is not taxed).
  if (passive > 0) b.tax -= passive * PASSIVE_TAX

  // 2. Expenses.
  b.trainer = life.trainer ? -Math.max(0, finite(life.trainer.weeklyFee)) : 0
  lines.push(...tickTrainerContract(life))
  b.upkeep = -assetUpkeep(life) - proj.upkeep
  b.living = -(livingCost(b.wage) + lifestyleCost(b.wage))

  const flow = b.wage + b.sponsors + b.tax + b.agentFee + b.rent + b.business + b.investmentYield + b.trainer + b.upkeep + b.living
  life.money = finite(life.money + flow)

  // 3. Loan.
  const loan = life.bank.loan
  if (loan && loan.remaining > 0) {
    const interest = loan.remaining * (loan.rate / WEEKS_PER_YEAR)
    const due = Math.min(loan.weeklyPayment, loan.remaining + interest)
    let paid = 0
    if (life.money >= due) { life.money -= due; paid = due }
    else if (life.money + life.bank.savings >= due) {
      // Bank sweeps the shortfall (and any overdraft) from savings.
      life.bank.savings -= due - life.money
      life.money = 0
      paid = due
    }
    if (paid > 0) {
      b.loanPayment = -paid
      loan.remaining = Math.max(0, finite(loan.remaining + interest - paid))
      life.bank.creditScore += 1 // on-time payment history
      if (loan.remaining < 0.01) {
        life.bank.loan = null
        life.bank.creditScore += 20
        lines.push(lt('🎉 Kredinin son taksitini ödedin!', '🎉 You made the final loan payment!'))
      }
    } else {
      loan.remaining = finite(loan.remaining + interest + due * 0.02)
      life.bank.creditScore -= 25
      lines.push(lt('⚠️ Kredi taksitini ödeyemedin! Kredi notun düştü.', '⚠️ You missed a loan payment! Your credit score dropped.'))
    }
  } else if (loan) {
    life.bank.loan = null
  }

  // 4. Savings interest.
  b.savingsInterest = finite(life.bank.savings * (SAVINGS_RATE / WEEKS_PER_YEAR))
  life.bank.savings = finite(life.bank.savings + b.savingsInterest)

  lines.push(...matureTermDeposits(life, cal))

  // 5. Credit drift with no loan: clean history slowly builds toward 700.
  if (!life.bank.loan) {
    const s = life.bank.creditScore
    if (s < CREDIT_IDLE_TARGET) life.bank.creditScore = s + 0.5
  }

  // 6. Bankruptcy guard.
  if (life.money < 0) {
    const g = bankruptcyGuard(life, cal, b.wage)
    b.forcedSales = g.raised
    lines.push(...g.lines)
  }
  // Early warning (2.5#109): cash is running out and there are holdings the guard would sell.
  if (lowCashWarning(life, flow, cal)) {
    lines.push(lt('⚠️ Nakit hızla eriyor: birkaç hafta içinde alacaklılar varlıklarını zorla sattırabilir. Harcamayı kıs ya da gelir bul.', '⚠️ Cash is draining fast: within a few weeks creditors may force a sale of your holdings. Cut spending or raise income.'))
  }
  // Recovered cash clears a stale bankruptcy flag (the guard only runs while cash is negative).
  if (life.money >= 0 && life.flags.bankrupt) life.flags.bankrupt = false
  life.bank.creditScore = clamp(Math.round(finite(life.bank.creditScore, 600) * 10) / 10, CREDIT_MIN, CREDIT_MAX)
  life.money = Math.round(finite(life.money) * 100) / 100

  const net = finite(flow + b.loanPayment + b.savingsInterest)
  if (Math.abs(net) >= 1) {
    lines.unshift(fill(lt('Haftalık bakiye: {n}', 'Weekly balance: {n}'), { n: fmtMoney(net) }))
  }
  return { lines, net, breakdown: b }
}

/** Personal-trainer contract length in weeks (2.5#11). */
export const TRAINER_CONTRACT_WEEKS = 44
/** Weeks before the end when the trainer warns that the deal is expiring. */
export const TRAINER_WARN_WEEKS = 4

/** Count the trainer contract down one week; warns near the end and releases the trainer at 0. */
export function tickTrainerContract(life: Life): Lines {
  const t = life.trainer
  if (!t || t.weeksLeft === undefined) return []
  t.weeksLeft -= 1
  if (t.weeksLeft <= 0) {
    life.trainer = null
    return [fill(lt('{n} ile sözleşmen bitti; yeni antrenör tutabilirsin.', "Your contract with {n} has ended; you can hire a new trainer."), { n: t.name })]
  }
  if (t.weeksLeft === TRAINER_WARN_WEEKS) {
    return [fill(lt('{n} ile sözleşmen {w} hafta sonra bitiyor.', 'Your contract with {n} ends in {w} weeks.'), { n: t.name, w: TRAINER_WARN_WEEKS })]
  }
  return []
}

/** life.flags key: season*100+week of the last low-cash warning (so it does not repeat every week). */
export const LOW_CASH_WARN_FLAG = 'low_cash_warn_week'

/** True when weekly cash flow is negative and cash covers fewer than 4 weeks of it, with sellable holdings. */
export function lowCashRisk(life: Life, flow: number): boolean {
  if (life.money < 0 || flow >= 0) return false
  const sellable = life.assets.length > 0 || life.bank.investments.length > 0 || (life.businesses?.length ?? 0) > 0
  return sellable && life.money < -flow * 4
}

/** Rate-limited (once per 4 weeks) low-cash warning check; records the week when it fires. */
function lowCashWarning(life: Life, flow: number, cal: Pick<Calendar, 'season' | 'week'>): boolean {
  if (!lowCashRisk(life, flow)) return false
  const wk = cal.season * 100 + cal.week
  const last = life.flags[LOW_CASH_WARN_FLAG]
  if (typeof last === 'number' && wk - last < 4 && wk >= last) return false
  life.flags[LOW_CASH_WARN_FLAG] = wk
  return true
}

/**
 * Raise cash until money ≥ 0: savings first, then investments (largest
 * first, sale fees apply), then assets — selling those with the smallest
 * relative loss first (sell the art before the 60%-loss supercar). Each forced
 * asset sale costs 15 credit points; if everything is gone and cash is still
 * negative, the hero is flagged bankrupt (events system hook).
 */
export function bankruptcyGuard(life: Life, cal: Pick<Calendar, 'season' | 'week'>, wage = 0): { raised: number; lines: Lines } {
  const lines: Lines = []
  let raised = 0
  if (life.money >= 0) return { raised, lines }
  if (life.bank.savings > 0) {
    const a = Math.min(life.bank.savings, -life.money)
    life.bank.savings -= a
    life.money += a
    raised += a
    lines.push(fill(lt('Borçları kapatmak için mevduattan {p} çekildi.', '{p} was taken from savings to cover debts.'), { p: fmtMoney(a) }))
  }
  if (life.money < 0) {
    const sorted = [...life.bank.investments].sort((p, q) => q.value - p.value)
    for (const inv of sorted) {
      if (life.money >= 0) break
      const r = sellInvestment(life, inv.id)
      raised += r.amount
      lines.push(fill(lt('Zorunlu satış: {n}', 'Forced sale: {n}'), { n: inv.name }))
    }
  }
  if (life.money < 0 && life.businesses?.length) {
    // Loss-makers go first.
    const ranked = [...life.businesses].sort((p, q) => (p.history[0]?.profit ?? 0) - (q.history[0]?.profit ?? 0))
    for (const bz of ranked) {
      if (life.money >= 0) break
      const r = sellBusiness(life, bz.id)
      raised += r.amount
      life.bank.creditScore -= 10
      lines.push(fill(lt('⚠️ Alacaklılar yüzünden işletmeni sattın: {n}', '⚠️ Creditors forced you to sell your business: {n}'), { n: bz.name }))
    }
  }
  if (life.money < 0 && life.assets.length) {
    const ranked = life.assets
      .map((o) => {
        const d = ASSET_BY_ID[o.defId]
        const v = d ? resaleValue(o, d, cal) : 0
        return { o, v, loss: o.pricePaid > 0 ? (o.pricePaid - v) / o.pricePaid : 0 }
      })
      .sort((p, q) => p.loss - q.loss)
    for (const r of ranked) {
      if (life.money >= 0) break
      const idx = life.assets.indexOf(r.o)
      if (idx < 0) continue
      const s = sellAsset(life, idx, cal)
      raised += s.amount
      life.bank.creditScore -= 15
      lines.push(fill(lt('⚠️ Alacaklılar yüzünden elden çıkardın: {l}', '⚠️ Creditors forced a sale: {l}'), { l: s.lines[0]! }))
    }
  }
  if (life.money < -overdraftGrace(wage)) {
    life.flags.bankrupt = true
    life.bank.creditScore -= 30
    lines.push(lt('💸 İflasın eşiğindesin! Satacak bir şeyin kalmadı.', '💸 You are on the brink of bankruptcy! Nothing left to sell.'))
  } else if (life.flags.bankrupt) {
    life.flags.bankrupt = false
  }
  return { raised, lines }
}

/** Small overdraft the bank tolerates (a rookie's first-week overspend is not bankruptcy). */
export const overdraftGrace = (wage = 0): number => Math.max(1_500, Math.max(0, wage) * 3)
