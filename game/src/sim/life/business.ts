/**
 * Business ownership v1 (GDD v2 "işletme sahibi olmak", first solid slice).
 *
 * Three kinds — restaurant, gym, clothing label — each with a weekly profit &
 * loss: revenue driven by the hero's fame, the brand's own reputation and
 * weekly noise; fixed costs (rent, staff), variable costs (stock), an optional
 * general manager, and random incidents (good and bad). Owners can upgrade
 * (3 levels), hire/fire a manager and sell.
 *
 * Tuning intent: a well-run business pays back in roughly 1–2 seasons; an
 * unmanaged one is a real side job (owner stress, more incidents, wilder
 * weeks). Clothing scales hardest with fame, the gym is the steady earner, the
 * restaurant sits in between and has the juiciest incidents.
 *
 * All state lives in `life.businesses` (plain data); the weekly tick runs
 * inside `weeklyEconomy` so its cash flow lands in the economy breakdown.
 */
import type { Business, BusinessKind, BusinessPnl, Calendar, Hero, LText, Life } from '../../core/types'
import type { Rng } from '../../core/rng'
import { absWeek, clamp, fill, fmtMoney, lt, meter, type Lines } from '../career/common'
import { addStress } from './wellbeing'

export interface BusinessDef {
  kind: BusinessKind
  name: LText
  desc: LText
  icon: string
  price: number
  minReputation: number
  /** Weekly revenue at level 1 for a neutral brand and mid fame. */
  baseRevenue: number
  rent: number
  staff: number
  /** Variable cost as a share of revenue. */
  stockShare: number
  /** How much hero fame drives demand (0..1.5). */
  fameSens: number
  /** Weekly revenue noise (sd). */
  sd: number
  /** Default shop names (the player can rename). */
  names: readonly string[]
}

export const BUSINESS_DEFS: Readonly<Record<BusinessKind, BusinessDef>> = {
  restaurant: {
    kind: 'restaurant', icon: '🍽️', price: 250_000, minReputation: 10,
    name: lt('Restoran', 'Restaurant'),
    desc: lt('Ünlü sahibin adı masaları doldurur; mutfak kazaları da manşetleri.', 'A famous owner fills the tables; kitchen disasters fill the headlines.'),
    baseRevenue: 16_000, rent: 2_400, staff: 3_200, stockShare: 0.32, fameSens: 0.9, sd: 0.22,
    names: ['Köşe Lokanta', 'Sahil Ocakbaşı', 'Mavi Tabak', 'Serçe Bistro'],
  },
  gym: {
    kind: 'gym', icon: '🏋️', price: 400_000, minReputation: 15,
    name: lt('Spor Salonu', 'Gym'),
    desc: lt('Aylık üyelikler, sakin ve düzenli gelir. Bozulan koşu bandı en büyük dramın.', 'Monthly memberships, calm steady income. A broken treadmill is your biggest drama.'),
    baseRevenue: 16_000, rent: 3_400, staff: 2_600, stockShare: 0.06, fameSens: 0.5, sd: 0.1,
    names: ['Ter Atölyesi', 'Kas Kulübü', 'Nefes Fit', 'Demir Salon'],
  },
  clothing: {
    kind: 'clothing', icon: '👕', price: 600_000, minReputation: 25,
    name: lt('Giyim Markası', 'Clothing Label'),
    desc: lt('Adın etikette. Şöhretin kadar satar, bir tasarım hatası kadar batar.', 'Your name on the label. Sells as far as your fame, sinks as fast as a bad design.'),
    baseRevenue: 18_000, rent: 1_600, staff: 3_800, stockShare: 0.38, fameSens: 1.4, sd: 0.3,
    names: ['Kenar Çizgisi', 'Onbir', 'Sol Kanat', 'Ofsayt Studio'],
  },
}
export const BUSINESS_KINDS: readonly BusinessKind[] = ['restaurant', 'gym', 'clothing']

/** Revenue / fixed-cost multipliers per level. */
export const LEVEL_REVENUE = [0, 1, 1.85, 3] as const
export const LEVEL_FIXED = [0, 1, 1.6, 2.4] as const
/** Upgrade price as a share of the purchase price, to reach level 2 / 3. */
export const UPGRADE_SHARE = [0, 0, 0.8, 1.5] as const
/** Weekly wage of a general manager per level. */
export const MANAGER_WAGE = 1_500
export const HISTORY_WEEKS = 8
/** Weekly incident chance without / with a manager. */
export const INCIDENT_P = { owner: 0.1, managed: 0.05 } as const

export const businesses = (life: Life): Business[] => life.businesses ?? (life.businesses = [])

export const upgradeCost = (b: Pick<Business, 'kind' | 'level'>): number | null =>
  b.level >= 3 ? null : Math.round(BUSINESS_DEFS[b.kind].price * UPGRADE_SHARE[b.level + 1]!)

/** Sale value: what you put in, scaled by how good the brand became (50%..100%). */
export const businessValue = (b: Pick<Business, 'invested' | 'brand'>): number =>
  Math.round(b.invested * (0.5 + clamp(b.brand, 0, 100) / 200))

export const managerWage = (b: Pick<Business, 'level'>): number => MANAGER_WAGE * b.level

export interface BizResult {
  ok: boolean
  lines: Lines
  business?: Business
}

const fail = (text: LText): BizResult => ({ ok: false, lines: [text] })

/** Open a new business (one per kind). */
export function openBusiness(life: Life, hero: Pick<Hero, 'reputation'>, kind: BusinessKind, cal: Calendar, name?: string): BizResult {
  const def = BUSINESS_DEFS[kind]
  if (!def) return fail(lt('Böyle bir işletme yok.', 'No such business.'))
  if (businesses(life).some((b) => b.kind === kind)) return fail(lt('Bu türde zaten bir işletmen var.', 'You already own one of these.'))
  if (hero.reputation < def.minReputation) return fail(fill(lt('Bu iş için şöhret {n} gerekli.', 'You need reputation {n} for this.'), { n: def.minReputation }))
  if (life.money < def.price) return fail(lt('Yeterli nakdin yok.', 'Not enough cash.'))
  life.money -= def.price
  const w = absWeek(cal)
  const nm = (name ?? '').trim().slice(0, 28) || def.names[w % def.names.length]
  const b: Business = {
    id: `biz_${kind}_${w}`, kind, name: nm!, level: 1, manager: false, brand: 40, openedWeek: w,
    invested: def.price, totalProfit: 0, history: [],
  }
  businesses(life).push(b)
  return { ok: true, business: b, lines: [fill(lt('{i} {n} kapılarını açtı! Hayırlı olsun.', '{i} {n} is open for business!'), { i: def.icon, n: nm! })] }
}

export function upgradeBusiness(life: Life, id: string): BizResult {
  const b = businesses(life).find((x) => x.id === id)
  if (!b) return fail(lt('İşletme bulunamadı.', 'Business not found.'))
  const cost = upgradeCost(b)
  if (cost === null) return fail(lt('Zaten en üst seviyede.', 'Already at the top level.'))
  if (life.money < cost) return fail(lt('Yeterli nakdin yok.', 'Not enough cash.'))
  life.money -= cost
  b.invested += cost
  b.level = (b.level + 1) as 2 | 3
  return { ok: true, business: b, lines: [fill(lt('{n} büyüdü: seviye {l}.', '{n} expanded to level {l}.'), { n: b.name, l: b.level })] }
}

export function setBusinessManager(life: Life, id: string, hire: boolean): BizResult {
  const b = businesses(life).find((x) => x.id === id)
  if (!b) return fail(lt('İşletme bulunamadı.', 'Business not found.'))
  if (b.manager === hire) return fail(hire ? lt('Zaten bir müdürün var.', 'You already have a manager.') : lt('Müdürün yok.', 'You have no manager.'))
  b.manager = hire
  return {
    ok: true, business: b,
    lines: [hire
      ? fill(lt('{n} için genel müdür işe alındı ({m}/hafta).', 'Hired a general manager for {n} ({m}/week).'), { n: b.name, m: fmtMoney(managerWage(b)) })
      : fill(lt('{n} müdürü ile yollarını ayırdın. Artık her şey sende.', 'You let the manager of {n} go. It\'s all on you now.'), { n: b.name })],
  }
}

export function sellBusiness(life: Life, id: string): BizResult & { amount: number } {
  const list = businesses(life)
  const i = list.findIndex((x) => x.id === id)
  if (i < 0) return { ...fail(lt('İşletme bulunamadı.', 'Business not found.')), amount: 0 }
  const b = list[i]!
  const amount = businessValue(b!)
  list.splice(i, 1)
  life.money += amount
  return { ok: true, amount, lines: [fill(lt('{n} satıldı: {m}.', '{n} sold for {m}.'), { n: b.name, m: fmtMoney(amount) })] }
}

interface Incident {
  p: number
  /** Cost (positive) or windfall (negative), as a share of the week's revenue. */
  cost: number
  revenueMult: number
  brand: number
  note: LText
}

const INCIDENTS: Readonly<Record<BusinessKind, readonly Incident[]>> = {
  restaurant: [
    { p: 1, cost: 0.6, revenueMult: 0.7, brand: -8, note: lt('Gıda denetimi: ceza ve kötü bir haber.', 'Health inspection: a fine and a bad write-up.') },
    { p: 1, cost: 0, revenueMult: 1.6, brand: 10, note: lt('Ünlü bir yemek eleştirmeni bayıldı. Sıra kapıya kadar.', 'A famous food critic loved it. Queue out the door.') },
    { p: 0.6, cost: 1.2, revenueMult: 0.4, brand: -3, note: lt('Mutfakta küçük bir yangın. Kimse yaralanmadı, ocaklar yenilendi.', 'A small kitchen fire. Nobody hurt, new stoves needed.') },
    { p: 0.8, cost: 0, revenueMult: 1.3, brand: 4, note: lt('Takım arkadaşların doğum gününü burada kutladı.', 'Your teammates held a birthday dinner here.') },
  ],
  gym: [
    { p: 1, cost: 0.4, revenueMult: 1, brand: -2, note: lt('Koşu bantları bozuldu, tamir ücreti.', 'Treadmills broke down: repair bill.') },
    { p: 1, cost: 0, revenueMult: 1.35, brand: 8, note: lt('Bir fenomen burada antrenman videosu çekti. Üyelik patladı.', 'An influencer filmed a workout here. Sign-ups exploded.') },
    { p: 0.7, cost: 0.25, revenueMult: 0.85, brand: -5, note: lt('Duşlar soğuk akıyor, şikâyet yağıyor.', 'Cold showers, angry reviews.') },
    { p: 0.6, cost: 0, revenueMult: 1.2, brand: 5, note: lt('Yeni yıl kararlıları kapıda.', 'New-year resolution crowd at the door.') },
  ],
  clothing: [
    { p: 1, cost: 0.5, revenueMult: 0.6, brand: -10, note: lt('Sahte ürünler piyasaya düştü; avukat masrafı.', 'Counterfeits flood the market; legal fees.') },
    { p: 1, cost: 0, revenueMult: 2, brand: 12, note: lt('Yeni koleksiyon bir saatte tükendi!', 'The new drop sold out in an hour!') },
    { p: 0.7, cost: 0.4, revenueMult: 0.75, brand: -6, note: lt('Bir tasarım alay konusu oldu, stok elde kaldı.', 'A design got roasted online; unsold stock.') },
    { p: 0.6, cost: 0, revenueMult: 1.4, brand: 6, note: lt('Gol sevincinde formanın altından logon göründü.', 'Your logo flashed under your shirt in a goal celebration.') },
  ],
}

/** Expected weekly revenue before noise and incidents (UI preview). */
export function expectedRevenue(b: Pick<Business, 'kind' | 'level' | 'brand' | 'manager'>, reputation: number): number {
  const d = BUSINESS_DEFS[b.kind]
  const fame = 0.55 + (clamp(reputation, 0, 100) / 100) * d.fameSens
  const brand = 0.7 + (clamp(b.brand, 0, 100) / 100) * 0.6
  return Math.round(d.baseRevenue * LEVEL_REVENUE[b.level] * fame * brand * (b.manager ? 1.05 : 1))
}

/** Income ceiling (2.5#53): fame can lift a business to at most 3x its level's base revenue per week. */
export const BUSINESS_REVENUE_CAP_MULT = 3
export const businessRevenueCap = (b: Pick<Business, 'kind' | 'level'>): number =>
  BUSINESS_DEFS[b.kind].baseRevenue * LEVEL_REVENUE[b.level] * BUSINESS_REVENUE_CAP_MULT

/** Weekly P&L of one business (mutates the business: history, brand, totals). */
export function businessWeek(rng: Rng, b: Business, reputation: number, week: number): BusinessPnl {
  const d = BUSINESS_DEFS[b.kind]
  const sd = d.sd * (b.manager ? 0.6 : 1)
  let revenue = expectedRevenue(b, reputation) * Math.max(0.2, 1 + rng.normal(0, sd))
  let incidentCost = 0
  let note: LText | undefined
  if (rng.chance(b.manager ? INCIDENT_P.managed : INCIDENT_P.owner)) {
    const inc = rng.weighted(INCIDENTS[b.kind], (x) => x.p)
    revenue *= inc.revenueMult
    incidentCost = Math.round(inc.cost * d.baseRevenue * LEVEL_REVENUE[b.level] * 0.5)
    b.brand = meter(b.brand + inc.brand)
    note = inc.note
  }
  if (b.boost) {
    revenue *= b.boost.mult
    if (--b.boost.weeks <= 0) delete b.boost
  }
  revenue = Math.round(Math.min(revenue, businessRevenueCap(b)))
  const rent = Math.round(d.rent * LEVEL_FIXED[b.level])
  const staff = Math.round(d.staff * LEVEL_FIXED[b.level])
  const manager = b.manager ? managerWage(b) : 0
  const stock = Math.round(revenue * d.stockShare)
  const profit = revenue - rent - staff - manager - stock - incidentCost
  // Brand drifts up slowly while the place runs well, down when it bleeds.
  b.brand = meter(b.brand + (profit > 0 ? 0.6 : -0.8) + (b.manager ? 0.2 : 0))
  const pnl: BusinessPnl = { w: week, revenue, rent, staff, manager, stock, incident: incidentCost, profit, ...(note ? { note } : {}) }
  b.history.unshift(pnl)
  if (b.history.length > HISTORY_WEEKS) b.history.length = HISTORY_WEEKS
  b.totalProfit += profit
  return pnl
}

/**
 * Weekly tick of all businesses: returns the total profit (cash is moved by
 * the caller, weeklyEconomy) and notable lines. Unmanaged businesses cost the
 * owner +1.5 stress each.
 */
export function weeklyBusinessTick(rng: Rng, life: Life, hero: Hero, cal: Calendar): { net: number; lines: Lines } {
  const list = life.businesses ?? []
  const lines: Lines = []
  let net = 0
  const w = absWeek(cal)
  for (const b of list) {
    const p = businessWeek(rng, b, hero.reputation, w)
    net += p.profit
    if (p.note) lines.push(fill(lt('{i} {n}: {t}', '{i} {n}: {t}'), { i: BUSINESS_DEFS[b.kind].icon, n: b.name, t: p.note }))
    if (!b.manager) addStress(life, hero, 1.5)
    // Butterfly: a week in the red keeps the owner awake (half as much with a manager in charge).
    if (p.profit < 0) {
      const scale = Math.max(1000, hero.contract?.wage ?? 1000)
      const d = addStress(life, hero, clamp((-p.profit / scale) * 2, 0.5, 4) * (b.manager ? 0.5 : 1))
      if (d >= 1) lines.push(fill(lt('📉 {n} zararda: uykuların kaçıyor (stres +{d}).', '📉 {n} is losing money: you are losing sleep (stress +{d}).'), { n: b.name, d: d.toFixed(1) }))
    }
  }
  if (list.length > 0) {
    lines.push(fill(lt('İşletmelerin bu hafta: {m}', 'Your businesses this week: {m}'), { m: fmtMoney(net) }))
  }
  return { net, lines }
}

/** Total resale value of all businesses (net worth). */
export const businessesValue = (life: Life): number => (life.businesses ?? []).reduce((s, b) => s + businessValue(b), 0)
